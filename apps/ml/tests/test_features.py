"""Tests for technical indicators and feature engineering."""
from __future__ import annotations

import numpy as np
import pandas as pd
import pytest

from src.features.indicators import atr, ema, macd, rsi, sma
from src.features.engineering import FeatureEngineer


def make_ohlcv(n: int = 300) -> pd.DataFrame:
    """Generate synthetic OHLCV data for testing."""
    np.random.seed(42)
    price = 100.0
    prices = []
    for _ in range(n):
        price *= 1.0 + np.random.normal(0, 0.01)
        prices.append(price)
    closes = pd.Series(prices)
    df = pd.DataFrame(
        {
            "timestamp": pd.date_range("2023-01-01", periods=n, freq="1h"),
            "open": closes.shift(1).fillna(closes.iloc[0]),
            "high": closes * (1.0 + np.abs(np.random.normal(0, 0.005, n))),
            "low": closes * (1.0 - np.abs(np.random.normal(0, 0.005, n))),
            "close": closes,
            "volume": np.random.uniform(1000, 10000, n),
        }
    )
    # Ensure OHLC consistency
    df["high"] = df[["open", "high", "close"]].max(axis=1)
    df["low"] = df[["open", "low", "close"]].min(axis=1)
    return df.reset_index(drop=True)


# ---------------------------------------------------------------------------
# Indicator tests
# ---------------------------------------------------------------------------

class TestIndicators:
    def test_sma_length(self) -> None:
        df = make_ohlcv()
        result = sma(df["close"], 20)
        assert len(result) == len(df)

    def test_sma_nan_at_start(self) -> None:
        df = make_ohlcv()
        result = sma(df["close"], 20)
        assert result.iloc[:19].isna().all(), "First 19 values should be NaN"
        assert not result.iloc[19:].isna().any(), "Values from index 19 onward should not be NaN"

    def test_sma_value(self) -> None:
        s = pd.Series([1.0, 2.0, 3.0, 4.0, 5.0])
        result = sma(s, 3)
        assert pd.isna(result.iloc[0])
        assert pd.isna(result.iloc[1])
        assert abs(result.iloc[2] - 2.0) < 1e-10
        assert abs(result.iloc[4] - 4.0) < 1e-10

    def test_ema_length(self) -> None:
        df = make_ohlcv()
        result = ema(df["close"], 20)
        assert len(result) == len(df)

    def test_rsi_bounds(self) -> None:
        df = make_ohlcv()
        result = rsi(df["close"], 14)
        valid = result.dropna()
        assert len(valid) > 0
        assert (valid >= 0.0).all(), "RSI must be >= 0"
        assert (valid <= 100.0).all(), "RSI must be <= 100"

    def test_rsi_nan_warmup(self) -> None:
        df = make_ohlcv()
        result = rsi(df["close"], 14)
        # First 14 values should be NaN (min_periods in ewm)
        assert result.iloc[:14].isna().all()

    def test_macd_columns(self) -> None:
        df = make_ohlcv()
        result = macd(df["close"])
        assert set(result.columns) == {"macd", "signal", "histogram"}
        assert len(result) == len(df)

    def test_macd_histogram_identity(self) -> None:
        df = make_ohlcv(300)
        result = macd(df["close"])
        diff = (result["macd"] - result["signal"] - result["histogram"]).abs()
        assert (diff.dropna() < 1e-10).all(), "histogram must equal macd - signal"

    def test_atr_positive(self) -> None:
        df = make_ohlcv()
        result = atr(df["high"], df["low"], df["close"], 14)
        valid = result.dropna()
        assert (valid > 0).all(), "ATR must be positive"

    def test_atr_length(self) -> None:
        df = make_ohlcv()
        result = atr(df["high"], df["low"], df["close"], 14)
        assert len(result) == len(df)


# ---------------------------------------------------------------------------
# Feature engineering tests
# ---------------------------------------------------------------------------

class TestFeatureEngineering:
    def test_no_lookahead(self) -> None:
        """CRITICAL: features at row i must not use data from row i+1 onward."""
        df = make_ohlcv(300)
        engineer = FeatureEngineer()
        features_full = engineer.compute_features(df.copy(), "TEST", "1h")
        features_trunc = engineer.compute_features(df.iloc[:100].copy(), "TEST", "1h")

        leaking: list = []
        for col in engineer.get_feature_names():
            if col not in features_trunc.columns:
                continue
            v_trunc = features_trunc[col].iloc[-1]
            v_full = features_full[col].iloc[99]
            if pd.isna(v_trunc) and pd.isna(v_full):
                continue
            if pd.isna(v_trunc) or pd.isna(v_full):
                continue
            if abs(float(v_trunc) - float(v_full)) > 1e-8:
                leaking.append(f"{col}: trunc={v_trunc:.8f}, full={v_full:.8f}")

        assert len(leaking) == 0, f"Look-ahead bias detected in features: {leaking}"

    def test_feature_count(self) -> None:
        df = make_ohlcv(300)
        engineer = FeatureEngineer()
        engineer.compute_features(df, "TEST", "1h")
        feature_names = engineer.get_feature_names()
        assert len(feature_names) > 30, f"Expected >30 features, got {len(feature_names)}"

    def test_required_columns_preserved(self) -> None:
        df = make_ohlcv(300)
        engineer = FeatureEngineer()
        result = engineer.compute_features(df.copy(), "TEST", "1h")
        for col in ("timestamp", "open", "high", "low", "close", "volume"):
            assert col in result.columns, f"Column {col} missing from result"

    def test_probability_bounds(self) -> None:
        """Pydantic schema enforces probability bounds [0, 1]."""
        from pydantic import ValidationError
        from src.models.schemas import PredictResponse

        # Valid response
        response = PredictResponse(
            symbol="XAUUSD",
            timeframe="1h",
            timestamp=pd.Timestamp.now(tz="UTC"),
            probability_up=0.6,
            probability_down=0.3,
            probability_neutral=0.1,
            confidence=0.6,
            expected_volatility=0.015,
            market_regime="TREND_UP",
            model_version="direction_v1",
            features_version="v1",
            is_demo=True,
        )
        total = response.probability_up + response.probability_down + response.probability_neutral
        assert abs(total - 1.0) < 0.01, f"Probabilities must sum to ~1.0, got {total}"

        # Invalid: probability > 1 must raise ValidationError
        with pytest.raises(ValidationError):
            PredictResponse(
                symbol="XAUUSD",
                timeframe="1h",
                timestamp=pd.Timestamp.now(tz="UTC"),
                probability_up=1.5,
                probability_down=0.3,
                probability_neutral=0.1,
                confidence=0.6,
                expected_volatility=None,
                market_regime="TREND_UP",
                model_version="v1",
                features_version="v1",
                is_demo=True,
            )
