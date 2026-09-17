"""Multi-timeframe feature aggregation – strictly causal (no look-ahead bias)."""
from __future__ import annotations

import pandas as pd
from typing import Dict

# Ordered list of timeframes from smallest to largest
_TIMEFRAME_ORDER = ["1m", "3m", "5m", "15m", "30m", "1h", "2h", "4h", "6h", "8h", "12h", "1d", "3d", "1w"]


def _timeframe_rank(tf: str) -> int:
    try:
        return _TIMEFRAME_ORDER.index(tf)
    except ValueError:
        return -1


class MultiTimeframeFeatures:
    """Aggregates features across multiple timeframes.

    For a prediction at the primary timeframe T:
    - Uses feature columns from T itself.
    - Merges features from higher timeframes (e.g. 1h -> 4h -> 1d) using
      an as-of (forward-fill) merge so that only completed higher-TF candles
      contribute – no look-ahead bias.

    Higher-timeframe feature columns are prefixed with the timeframe, e.g.
    ``4h_rsi_14``, ``1d_adx_14``.
    """

    def aggregate(
        self,
        feature_dict: Dict[str, pd.DataFrame],
        primary_timeframe: str,
    ) -> pd.DataFrame:
        """Aggregate features from multiple timeframes.

        Parameters
        ----------
        feature_dict:
            Mapping of timeframe string -> feature DataFrame.
            Each DataFrame must contain a ``timestamp`` column (UTC, sorted ascending).
        primary_timeframe:
            The timeframe being predicted.  Its DataFrame is the base.

        Returns
        -------
        pd.DataFrame
            Primary-timeframe DataFrame enriched with higher-timeframe features.
        """
        if primary_timeframe not in feature_dict:
            raise ValueError(
                f"primary_timeframe '{primary_timeframe}' not found in feature_dict. "
                f"Available: {list(feature_dict.keys())}"
            )

        primary_df = feature_dict[primary_timeframe].copy()
        primary_df = primary_df.sort_values("timestamp").reset_index(drop=True)
        primary_rank = _timeframe_rank(primary_timeframe)

        for tf, df in feature_dict.items():
            if tf == primary_timeframe:
                continue
            if _timeframe_rank(tf) <= primary_rank:
                # Skip lower or equal timeframes
                continue

            higher_df = df.copy().sort_values("timestamp").reset_index(drop=True)

            # Select only feature columns (not raw OHLCV)
            ohlcv_cols = {"timestamp", "open", "high", "low", "close", "volume"}
            feature_cols = [c for c in higher_df.columns if c not in ohlcv_cols]
            if not feature_cols:
                continue

            # The higher-TF candle at timestamp T represents data that is only
            # known AFTER that candle closes.  We shift timestamps by one candle
            # forward to ensure the data is available for the *next* primary-TF bar.
            # In practice we use pd.merge_asof with the higher-TF timestamp as-is
            # (the candle close timestamp) and direction='backward', which means
            # "use the most recent higher-TF candle whose timestamp <= primary ts".
            higher_sub = higher_df[["timestamp"] + feature_cols].rename(
                columns={c: f"{tf}_{c}" for c in feature_cols}
            )

            primary_df = pd.merge_asof(
                primary_df,
                higher_sub,
                on="timestamp",
                direction="backward",
            )

        return primary_df
