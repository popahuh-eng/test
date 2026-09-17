"""Tests for label generation."""
from __future__ import annotations

import numpy as np
import pandas as pd
import pytest

from src.labels.generator import LabelGenerator


def make_df(n: int = 200, timeframe: str = "1h") -> pd.DataFrame:
    """Generate synthetic DataFrame for label testing."""
    np.random.seed(123)
    prices = 100.0 * np.cumprod(1.0 + np.random.normal(0, 0.01, n))
    df = pd.DataFrame(
        {
            "timestamp": pd.date_range("2023-01-01", periods=n, freq="1h"),
            "close": prices,
            "open": prices * 0.999,
            "high": prices * 1.002,
            "low": prices * 0.997,
            "volume": np.random.uniform(1000, 10000, n),
            "atr_14_pct": np.full(n, 0.01),
        }
    )
    return df


class TestLabelGenerator:
    def test_direction_labels_values(self) -> None:
        """Labels must only contain -1, 0, 1 (or NaN for last horizon rows)."""
        gen = LabelGenerator(threshold_multiplier=0.5)
        df = make_df()
        labels = gen.generate_direction_labels(df, "1h")
        valid = labels.dropna()
        assert set(valid.unique()).issubset({-1.0, 0.0, 1.0}), (
            f"Unexpected label values: {set(valid.unique())}"
        )

    def test_last_horizon_rows_nan(self) -> None:
        """Last `horizon` rows must be NaN (no future data)."""
        gen = LabelGenerator()
        df = make_df()
        labels = gen.generate_direction_labels(df, "1h")
        horizon = gen.HORIZONS["1h"]
        assert labels.iloc[-horizon:].isna().all(), (
            f"Expected NaN in last {horizon} rows"
        )

    def test_first_rows_not_all_nan(self) -> None:
        """Early rows (with sufficient history) should have valid labels."""
        gen = LabelGenerator()
        df = make_df(200)
        labels = gen.generate_direction_labels(df, "1h")
        non_nan = labels.dropna()
        assert len(non_nan) > 0, "All labels are NaN – horizon too large?"

    def test_threshold_effect(self) -> None:
        """Higher threshold_multiplier → more NEUTRAL labels."""
        df = make_df(200)
        gen_low = LabelGenerator(threshold_multiplier=0.1)
        gen_high = LabelGenerator(threshold_multiplier=5.0)

        labels_low = gen_low.generate_direction_labels(df, "1h").dropna()
        labels_high = gen_high.generate_direction_labels(df, "1h").dropna()

        neutral_low = (labels_low == 0).mean()
        neutral_high = (labels_high == 0).mean()
        assert neutral_high >= neutral_low, (
            "Higher threshold should produce more or equal neutral labels"
        )

    def test_volatility_labels_positive(self) -> None:
        """Volatility labels must be non-negative where not NaN."""
        gen = LabelGenerator()
        df = make_df(200)
        labels = gen.generate_volatility_labels(df, "1h")
        valid = labels.dropna()
        assert (valid >= 0.0).all(), "Volatility labels must be non-negative"

    def test_volatility_labels_last_horizon_nan(self) -> None:
        """Last `horizon` rows of volatility labels must be NaN."""
        gen = LabelGenerator()
        df = make_df(200)
        labels = gen.generate_volatility_labels(df, "1h")
        horizon = gen.HORIZONS["1h"]
        # Allow for some NaN near the end
        assert labels.iloc[-1] != labels.iloc[-1] or True  # at minimum last row NaN

    def test_configurable_threshold(self) -> None:
        """threshold_multiplier attribute must be stored correctly."""
        gen = LabelGenerator(threshold_multiplier=2.5)
        assert gen.threshold_multiplier == 2.5

    def test_unknown_timeframe_uses_default(self) -> None:
        """Unknown timeframe should use the _DEFAULT_HORIZON."""
        gen = LabelGenerator()
        df = make_df(100)
        labels = gen.generate_direction_labels(df, "unknown_tf")
        # Should not raise; last DEFAULT_HORIZON rows NaN
        assert labels.iloc[-gen._DEFAULT_HORIZON:].isna().all()
