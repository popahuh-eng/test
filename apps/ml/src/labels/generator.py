"""Label generation for ML training.

CRITICAL: Labels use FUTURE data – that is correct for training labels.
They MUST NOT be used in production prediction.
"""
from __future__ import annotations

import numpy as np
import pandas as pd
from typing import Dict


class LabelGenerator:
    """Generates target labels for ML training.

    Direction label logic at time T with horizon H:
        future_return = (close[T+H] - close[T]) / close[T]
        threshold     = threshold_multiplier * atr_14_pct[T]

        label = UP (1)      if future_return >  threshold
              = DOWN (-1)   if future_return < -threshold
              = NEUTRAL (0) otherwise

    Last ``horizon`` rows will have NaN labels (no future data available)
    and MUST be excluded from training.
    """

    HORIZONS: Dict[str, int] = {
        "15m": 4,   # 4 × 15 min = 1 h
        "1h": 4,    # 4 × 1 h   = 4 h
        "4h": 6,    # 6 × 4 h   = 24 h
        "1d": 5,    # 5 × 1 d   = 1 week
    }

    _DEFAULT_HORIZON = 4  # used for unknown timeframes

    def __init__(self, threshold_multiplier: float = 0.5) -> None:
        self.threshold_multiplier = threshold_multiplier

    # ------------------------------------------------------------------

    def generate_direction_labels(self, df: pd.DataFrame, timeframe: str) -> pd.Series:
        """Generate UP / NEUTRAL / DOWN labels (1 / 0 / -1).

        Parameters
        ----------
        df:
            Must contain columns: ``close``, and optionally ``atr_14_pct``
            (if missing a flat 1 % threshold is used).
        timeframe:
            Candle timeframe string used to look up the prediction horizon.

        Returns
        -------
        pd.Series
            Integer series with values in {-1, 0, 1}.
            Last ``horizon`` entries are NaN.
        """
        horizon = self.HORIZONS.get(timeframe, self._DEFAULT_HORIZON)
        close = df["close"].reset_index(drop=True)

        # Future return: shift close backwards so label[i] = return at i+horizon
        future_close = close.shift(-horizon)
        future_return = (future_close - close) / close.replace(0, np.nan)

        # Threshold based on ATR pct (if available); fallback 1 %
        if "atr_14_pct" in df.columns:
            atr_pct = df["atr_14_pct"].reset_index(drop=True)
        else:
            atr_pct = pd.Series(0.01, index=close.index)

        threshold = self.threshold_multiplier * atr_pct

        labels = pd.Series(0, index=close.index, dtype=float)
        labels = labels.where(~(future_return > threshold), other=1.0)
        labels = labels.where(~(future_return < -threshold), other=-1.0)

        # Last `horizon` rows have no future data – mark as NaN
        labels.iloc[-horizon:] = np.nan
        return labels

    def generate_volatility_labels(self, df: pd.DataFrame, timeframe: str) -> pd.Series:
        """Generate future realized volatility labels.

        The label at time T is the realised volatility computed over the next
        ``horizon`` candles, annualised.

        Last ``horizon`` rows are NaN.
        """
        horizon = self.HORIZONS.get(timeframe, self._DEFAULT_HORIZON)
        close = df["close"].reset_index(drop=True)
        log_returns = np.log(close / close.shift(1))

        realized_vol = pd.Series(np.nan, index=close.index, dtype=float)
        n = len(close)
        for i in range(n - horizon):
            future_rets = log_returns.iloc[i + 1 : i + 1 + horizon]
            if len(future_rets) == horizon:
                realized_vol.iloc[i] = float(future_rets.std(ddof=1) * np.sqrt(252))

        return realized_vol
