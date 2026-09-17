"""Feature engineering pipeline – strictly causal (no look-ahead bias)."""
from __future__ import annotations

import numpy as np
import pandas as pd
from typing import Dict, List, Optional, Tuple

from .indicators import (
    sma, ema, rsi, macd, atr, adx, stochastic, obv, roc,
    bollinger_bands, support_resistance_levels,
)

FEATURES_VERSION = "v1"

_REQUIRED_OHLCV = {"timestamp", "open", "high", "low", "close", "volume"}


class FeatureEngineer:
    """Generates feature vectors from OHLCV data.

    CRITICAL: No look-ahead bias.  All features are computed using only
    historical data available at the prediction timestamp.
    Every rolling/shift operation uses data at index <=i to compute feature[i].
    """

    def __init__(self, features_version: str = FEATURES_VERSION) -> None:
        self.features_version = features_version
        self._feature_names: List[str] = []

    # ------------------------------------------------------------------
    # Public API
    # ------------------------------------------------------------------

    def compute_features(
        self,
        df: pd.DataFrame,
        symbol: str,
        timeframe: str,
    ) -> pd.DataFrame:
        """Compute all features for a candle DataFrame.

        Parameters
        ----------
        df:
            Must have columns: timestamp, open, high, low, close, volume.
            Rows must be sorted ascending by timestamp.
        symbol:
            Trading symbol (e.g. 'XAUUSD') – stored as metadata.
        timeframe:
            Candle timeframe string (e.g. '1h') – stored as metadata.

        Returns
        -------
        pd.DataFrame
            Original columns plus all feature columns.
            Leading NaN rows (indicator warm-up) are expected and should be
            dropped before training.
        """
        missing = _REQUIRED_OHLCV - set(df.columns)
        if missing:
            raise ValueError(f"Missing required columns: {missing}")

        df = df.copy().reset_index(drop=True)
        df = df.sort_values("timestamp").reset_index(drop=True)

        df = self._price_features(df)
        df = self._trend_features(df)
        df = self._momentum_features(df)
        df = self._volatility_features(df)
        df = self._volume_features(df)
        df = self._market_structure_features(df)

        # Cache feature names from first call
        if not self._feature_names:
            excluded = set(_REQUIRED_OHLCV)
            self._feature_names = [c for c in df.columns if c not in excluded]

        return df

    def get_feature_names(self) -> List[str]:
        """Return list of all feature column names (populated after first call to compute_features)."""
        return list(self._feature_names)

    def validate_no_lookahead(self, df: pd.DataFrame) -> bool:
        """Validate that no feature uses future data by comparing truncated vs full computation.

        Returns True if validation passes, raises AssertionError otherwise.
        """
        if len(df) < 60:
            raise ValueError("Need at least 60 rows to validate no-lookahead")
        cutoff = len(df) // 2
        features_full = self.compute_features(df.copy(), "VAL", "1h")
        features_trunc = self.compute_features(df.iloc[:cutoff].copy(), "VAL", "1h")

        leaking: List[str] = []
        for col in self.get_feature_names():
            if col not in features_trunc.columns:
                continue
            v_trunc = features_trunc[col].iloc[-1]
            v_full = features_full[col].iloc[cutoff - 1]
            if pd.isna(v_trunc) and pd.isna(v_full):
                continue
            if pd.isna(v_trunc) or pd.isna(v_full):
                continue
            if abs(float(v_trunc) - float(v_full)) > 1e-8:
                leaking.append(f"{col}: trunc={v_trunc}, full={v_full}")

        assert len(leaking) == 0, f"Look-ahead bias detected: {leaking}"
        return True

    # ------------------------------------------------------------------
    # Private helpers
    # ------------------------------------------------------------------

    def _price_features(self, df: pd.DataFrame) -> pd.DataFrame:
        """Compute raw price / candle-body features."""
        c = df["close"]
        o = df["open"]
        h = df["high"]
        lo = df["low"]
        rng = (h - lo).replace(0, np.nan)

        df["returns"] = c.pct_change()
        df["log_returns"] = np.log(c / c.shift(1))
        df["candle_body"] = (c - o).abs() / rng
        df["upper_wick"] = (h - pd.concat([o, c], axis=1).max(axis=1)) / rng
        df["lower_wick"] = (pd.concat([o, c], axis=1).min(axis=1) - lo) / rng
        df["range"] = (h - lo) / c
        df["gap"] = (o - c.shift(1)) / c.shift(1)
        return df

    def _trend_features(self, df: pd.DataFrame) -> pd.DataFrame:
        """Compute trend / moving-average features."""
        c = df["close"]

        df["sma_20"] = sma(c, 20)
        df["sma_50"] = sma(c, 50)
        df["sma_200"] = sma(c, 200)
        df["ema_20"] = ema(c, 20)
        df["ema_50"] = ema(c, 50)
        df["ema_200"] = ema(c, 200)

        df["price_vs_sma20"] = (c - df["sma_20"]) / df["sma_20"].replace(0, np.nan)
        df["price_vs_ema20"] = (c - df["ema_20"]) / df["ema_20"].replace(0, np.nan)
        df["ema20_slope"] = (
            (df["ema_20"] - df["ema_20"].shift(5)) / df["ema_20"].shift(5).replace(0, np.nan)
        )

        adx_df = adx(df["high"], df["low"], c, period=14)
        df["adx_14"] = adx_df["adx"]
        df["plus_di_14"] = adx_df["plus_di"]
        df["minus_di_14"] = adx_df["minus_di"]

        df["trend_direction"] = np.where(
            df["ema_20"] > df["ema_50"], 1,
            np.where(df["ema_20"] < df["ema_50"], -1, 0),
        ).astype(float)
        return df

    def _momentum_features(self, df: pd.DataFrame) -> pd.DataFrame:
        """Compute momentum oscillator features."""
        c = df["close"]

        df["rsi_14"] = rsi(c, 14)
        df["rsi_7"] = rsi(c, 7)

        macd_df = macd(c, fast=12, slow=26, signal=9)
        df["macd_line"] = macd_df["macd"]
        df["macd_signal"] = macd_df["signal"]
        df["macd_histogram"] = macd_df["histogram"]

        # MACD crossover: +1 when macd crosses above signal, -1 below, 0 otherwise
        prev_above = (df["macd_line"].shift(1) > df["macd_signal"].shift(1))
        curr_above = df["macd_line"] > df["macd_signal"]
        df["macd_crossover"] = np.where(
            (~prev_above) & curr_above, 1.0,
            np.where(prev_above & (~curr_above), -1.0, 0.0),
        )

        df["roc_10"] = roc(c, 10)
        df["roc_20"] = roc(c, 20)

        stoch_df = stochastic(df["high"], df["low"], c, k_period=14, d_period=3)
        df["stoch_k"] = stoch_df["k"]
        df["stoch_d"] = stoch_df["d"]
        return df

    def _volatility_features(self, df: pd.DataFrame) -> pd.DataFrame:
        """Compute volatility features."""
        c = df["close"]
        ret = df["returns"]

        df["atr_14"] = atr(df["high"], df["low"], c, period=14)
        df["atr_14_pct"] = df["atr_14"] / c.replace(0, np.nan)

        df["rolling_std_20"] = ret.rolling(window=20, min_periods=20).std(ddof=1)
        # Annualised realised vol (252 trading days; scale by sqrt(bars_per_day) for sub-daily)
        df["realized_vol_20"] = df["rolling_std_20"] * np.sqrt(252)

        df["high_low_vol"] = (
            (df["high"] - df["low"]) / c.replace(0, np.nan)
        ).rolling(window=20, min_periods=20).mean()

        bb_df = bollinger_bands(c, period=20, std_dev=2.0)
        df["bb_width"] = bb_df["width"]
        df["bb_pct_b"] = bb_df["pct_b"]
        return df

    def _volume_features(self, df: pd.DataFrame) -> pd.DataFrame:
        """Compute volume-based features."""
        v = df["volume"]

        df["volume_change"] = v.pct_change()
        df["rolling_volume_20"] = v.rolling(window=20, min_periods=20).mean()
        roll_std = v.rolling(window=20, min_periods=20).std(ddof=1)
        df["volume_zscore"] = (
            (v - df["rolling_volume_20"]) / roll_std.replace(0, np.nan)
        )
        raw_obv = obv(df["close"], v)
        # Normalise OBV by its own rolling mean to make it scale-invariant
        obv_mean = raw_obv.rolling(window=20, min_periods=20).mean()
        df["obv_norm"] = (raw_obv - obv_mean) / obv_mean.replace(0, np.nan)
        df["volume_ratio"] = v / df["rolling_volume_20"].replace(0, np.nan)
        return df

    def _market_structure_features(self, df: pd.DataFrame) -> pd.DataFrame:
        """Compute market-structure / support-resistance features."""
        c = df["close"]
        h = df["high"]
        lo = df["low"]

        sr = support_resistance_levels(h, lo, c, window=20)
        df["swing_high"] = sr["swing_high"].astype(float)
        df["swing_low"] = sr["swing_low"].astype(float)

        # Distance to nearest swing high above price (resistance)
        resistance = h.where(sr["swing_high"], other=np.nan)
        # Forward-fill is look-ahead; use cummax of past swing highs instead
        # We want the most recent swing high that is ABOVE the current close.
        # Compute rolling max of resistance levels seen so far.
        past_resistance = resistance.expanding().max()
        df["dist_to_nearest_resistance"] = (
            (past_resistance - c) / c.replace(0, np.nan)
        ).clip(lower=0)

        # Distance to nearest swing low below price (support)
        support = lo.where(sr["swing_low"], other=np.nan)
        past_support = support.expanding().min()
        df["dist_to_nearest_support"] = (
            (c - past_support) / c.replace(0, np.nan)
        ).clip(lower=0)

        # Breakout: price exceeds the rolling 20-period high/low set BEFORE the current bar
        roll_high_prev = h.shift(1).rolling(window=20, min_periods=20).max()
        roll_low_prev = lo.shift(1).rolling(window=20, min_periods=20).min()
        df["breakout_up"] = (c > roll_high_prev).astype(float)
        df["breakout_down"] = (c < roll_low_prev).astype(float)

        # Consolidation: rolling std of returns is below the median rolling std
        roll_ret_std = df["returns"].rolling(window=20, min_periods=20).std(ddof=1)
        threshold = roll_ret_std.expanding().median()
        df["consolidation"] = (roll_ret_std < threshold).astype(float)
        return df
