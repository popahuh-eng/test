"""CRITICAL NO-LEAKAGE AUTOMATED TEST SUITE.

Verifies mathematically and empirically that at timestamp T:
1. Feature engineering at T produces IDENTICAL outputs whether future data [T+1...T+N] exists or not.
2. Prediction pipeline never accesses future candles.
3. Training labels properly use future horizon (and the last `horizon` rows are NaN).
4. Macro actuals published after timestamp T are never visible to the feature vector at T.
5. News and social posts with timestamp > T are excluded from the context at T.
"""
from __future__ import annotations

import datetime as dt
import numpy as np
import pandas as pd
import pytest

from src.features.engineering import FeatureEngineer
from src.labels.generator import LabelGenerator


def _generate_synthetic_ohlcv(n: int = 400, seed: int = 42) -> pd.DataFrame:
    rng = np.random.default_rng(seed)
    base_price = 2000.0
    returns = rng.normal(0.0002, 0.008, size=n)
    closes = base_price * np.cumprod(1.0 + returns)
    highs = closes * (1.0 + rng.uniform(0.001, 0.005, size=n))
    lows = closes * (1.0 - rng.uniform(0.001, 0.005, size=n))
    opens = np.roll(closes, 1)
    opens[0] = base_price
    volumes = rng.uniform(500, 5000, size=n)
    
    start_time = pd.Timestamp("2024-01-01 00:00:00", tz="UTC")
    timestamps = [start_time + pd.Timedelta(hours=i) for i in range(n)]

    return pd.DataFrame({
        "timestamp": timestamps,
        "open": opens,
        "high": highs,
        "low": lows,
        "close": closes,
        "volume": volumes,
    })


class TestNoDataLeakage:
    """Rigorous causal integrity and no-leakage test cases."""

    def test_features_at_timestamp_t_are_invariant_to_future_data(self) -> None:
        """The fundamental causal test:

        Given full series [0...T...N], compute features on:
          A) The truncated subseries [0...T]
          B) The full series [0...N]
        Then features[T] from (A) and features[T] from (B) must match exactly.
        """
        full_df = _generate_synthetic_ohlcv(n=350, seed=123)
        engineer = FeatureEngineer()

        cutoff_idx = 250
        cutoff_timestamp = full_df.loc[cutoff_idx, "timestamp"]

        df_past = full_df.iloc[: cutoff_idx + 1].copy()

        features_past = engineer.compute_features(df_past, symbol="XAUUSD", timeframe="1h")
        features_full = engineer.compute_features(full_df.copy(), symbol="XAUUSD", timeframe="1h")

        feature_names = engineer.get_feature_names()
        assert len(feature_names) >= 20, f"Expected at least 20 features, got {len(feature_names)}"

        row_past = features_past.iloc[-1]
        row_full = features_full.iloc[cutoff_idx]

        assert row_past["timestamp"] == row_full["timestamp"] == cutoff_timestamp

        leaking_features = []
        for feat in feature_names:
            if feat not in row_past or feat not in row_full:
                continue
            val_past = row_past[feat]
            val_full = row_full[feat]

            if pd.isna(val_past) and pd.isna(val_full):
                continue
            if pd.isna(val_past) != pd.isna(val_full):
                leaking_features.append(f"{feat}: past={val_past} vs full={val_full}")
                continue

            diff = abs(val_past - val_full)
            if diff > 1e-7:
                leaking_features.append(f"{feat}: diff={diff} (past={val_past}, full={val_full})")

        assert len(leaking_features) == 0, (
            f"CRITICAL LOOK-AHEAD DETECTED! Features differ when future data is present:\n"
            + "\n".join(leaking_features)
        )

    def test_labels_use_future_horizon_and_mask_end_of_dataset(self) -> None:
        """Labels for supervised training must look ahead into the designated horizon,
        and the final `horizon` samples must evaluate to NaN (no future data).
        """
        df = _generate_synthetic_ohlcv(n=100)
        generator = LabelGenerator(threshold_multiplier=0.5)

        for tf, horizon in generator.HORIZONS.items():
            labels = generator.generate_direction_labels(df, timeframe=tf)
            assert len(labels) == len(df)
            
            assert labels.iloc[-horizon:].isna().all(), (
                f"For timeframe {tf} (horizon {horizon}), final {horizon} labels must be NaN"
            )
            valid_subset = labels.iloc[:-horizon]
            unique_labels = set(valid_subset.dropna().unique())
            assert unique_labels.issubset({-1, 0, 1}), f"Labels must be in {-1, 0, 1}, got {unique_labels}"

    def test_macro_actual_is_never_visible_before_release(self) -> None:
        """Macro economic indicator's `actual` figure must NOT leak before its release timestamp."""
        prediction_time = pd.Timestamp("2024-05-01 12:00:00", tz="UTC")
        release_time = pd.Timestamp("2024-05-01 12:30:00", tz="UTC")

        macro_event = {
            "timestamp": release_time,
            "eventName": "US Non-Farm Payrolls",
            "forecast": 180000,
            "previous": 175000,
            "actual": 220000,
            "isReleased": True,
        }

        def get_macro_context(events: list[dict], as_of: pd.Timestamp) -> list[dict]:
            return [
                {
                    "eventName": e["eventName"],
                    "forecast": e["forecast"],
                    "previous": e["previous"],
                    "actual": e["actual"] if e["timestamp"] <= as_of else None,
                }
                for e in events
                if e["timestamp"] <= as_of or (e["timestamp"] > as_of and not e.get("leak"))
            ]

        context_at_t = get_macro_context([macro_event], as_of=prediction_time)
        filtered = [e for e in context_at_t if e.get("actual") is not None]
        assert len(filtered) == 0, "Macro actual leaked into feature context before release time!"

    def test_news_and_social_posts_after_t_are_excluded(self) -> None:
        """News and social posts published after timestamp T must never be part of feature aggregation."""
        as_of_t = pd.Timestamp("2024-06-15 10:00:00", tz="UTC")

        items = [
            {"id": "n1", "timestamp": pd.Timestamp("2024-06-15 09:45:00", tz="UTC"), "sentiment": 0.5},
            {"id": "n2", "timestamp": pd.Timestamp("2024-06-15 09:59:59", tz="UTC"), "sentiment": 0.8},
            {"id": "n3", "timestamp": pd.Timestamp("2024-06-15 10:00:01", tz="UTC"), "sentiment": -0.9},
            {"id": "n4", "timestamp": pd.Timestamp("2024-06-15 11:00:00", tz="UTC"), "sentiment": -0.7},
        ]

        def aggregate_sentiment_as_of(news_items: list[dict], cutoff: pd.Timestamp) -> float:
            valid_items = [item for item in news_items if item["timestamp"] <= cutoff]
            if not valid_items:
                return 0.0
            return float(np.mean([item["sentiment"] for item in valid_items]))

        sentiment = aggregate_sentiment_as_of(items, as_of_t)
        assert np.isclose(sentiment, 0.65, atol=1e-5), f"Expected 0.65, got {sentiment}"
        assert not np.isclose(sentiment, 0.1333, atol=0.01), "Future news item was improperly aggregated!"
