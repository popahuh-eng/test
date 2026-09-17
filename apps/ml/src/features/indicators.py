"""Technical indicators implemented with pandas/numpy only – no TA-Lib.

IMPORTANT: every function is strictly causal (no look-ahead bias).
All rolling windows use ``min_periods`` equal to the full window length so
that partial results are NaN rather than subtly wrong.
"""
from __future__ import annotations

import numpy as np
import pandas as pd
from typing import Optional


# ---------------------------------------------------------------------------
# Moving averages
# ---------------------------------------------------------------------------

def sma(series: pd.Series, period: int) -> pd.Series:
    """Simple Moving Average."""
    return series.rolling(window=period, min_periods=period).mean()


def ema(series: pd.Series, period: int) -> pd.Series:
    """Exponential Moving Average (Wilder/pandas default: adjust=False)."""
    return series.ewm(span=period, adjust=False, min_periods=period).mean()


# ---------------------------------------------------------------------------
# Momentum
# ---------------------------------------------------------------------------

def rsi(series: pd.Series, period: int = 14) -> pd.Series:
    """Relative Strength Index in [0, 100].

    Uses Wilder smoothing (equivalent to EMA with alpha=1/period).
    """
    delta = series.diff()
    gain = delta.clip(lower=0)
    loss = (-delta).clip(lower=0)
    avg_gain = gain.ewm(alpha=1.0 / period, adjust=False, min_periods=period).mean()
    avg_loss = loss.ewm(alpha=1.0 / period, adjust=False, min_periods=period).mean()
    rs = avg_gain / avg_loss.replace(0, np.nan)
    return 100.0 - (100.0 / (1.0 + rs))


def macd(
    series: pd.Series,
    fast: int = 12,
    slow: int = 26,
    signal: int = 9,
) -> pd.DataFrame:
    """MACD indicator.

    Returns a DataFrame with columns: ``macd``, ``signal``, ``histogram``.
    """
    ema_fast = ema(series, fast)
    ema_slow = ema(series, slow)
    macd_line = ema_fast - ema_slow
    signal_line = macd_line.ewm(span=signal, adjust=False, min_periods=signal).mean()
    histogram = macd_line - signal_line
    return pd.DataFrame(
        {"macd": macd_line, "signal": signal_line, "histogram": histogram},
        index=series.index,
    )


def roc(series: pd.Series, period: int = 10) -> pd.Series:
    """Rate of Change: (price / price[n] - 1) * 100."""
    return (series / series.shift(period) - 1.0) * 100.0


def stochastic(
    high: pd.Series,
    low: pd.Series,
    close: pd.Series,
    k_period: int = 14,
    d_period: int = 3,
) -> pd.DataFrame:
    """Stochastic Oscillator.

    Returns a DataFrame with columns: ``k``, ``d``.
    """
    lowest_low = low.rolling(window=k_period, min_periods=k_period).min()
    highest_high = high.rolling(window=k_period, min_periods=k_period).max()
    denom = (highest_high - lowest_low).replace(0, np.nan)
    k = 100.0 * (close - lowest_low) / denom
    d = k.rolling(window=d_period, min_periods=d_period).mean()
    return pd.DataFrame({"k": k, "d": d}, index=close.index)


# ---------------------------------------------------------------------------
# Volatility
# ---------------------------------------------------------------------------

def atr(
    high: pd.Series,
    low: pd.Series,
    close: pd.Series,
    period: int = 14,
) -> pd.Series:
    """Average True Range using Wilder smoothing."""
    prev_close = close.shift(1)
    tr = pd.concat(
        [
            high - low,
            (high - prev_close).abs(),
            (low - prev_close).abs(),
        ],
        axis=1,
    ).max(axis=1)
    return tr.ewm(alpha=1.0 / period, adjust=False, min_periods=period).mean()


def bollinger_bands(
    series: pd.Series,
    period: int = 20,
    std_dev: float = 2.0,
) -> pd.DataFrame:
    """Bollinger Bands.

    Returns a DataFrame with columns:
    ``upper``, ``middle``, ``lower``, ``width``, ``pct_b``.
    """
    middle = sma(series, period)
    std = series.rolling(window=period, min_periods=period).std(ddof=1)
    upper = middle + std_dev * std
    lower = middle - std_dev * std
    width = (upper - lower) / middle.replace(0, np.nan)
    pct_b = (series - lower) / (upper - lower).replace(0, np.nan)
    return pd.DataFrame(
        {"upper": upper, "middle": middle, "lower": lower, "width": width, "pct_b": pct_b},
        index=series.index,
    )


# ---------------------------------------------------------------------------
# Trend
# ---------------------------------------------------------------------------

def adx(
    high: pd.Series,
    low: pd.Series,
    close: pd.Series,
    period: int = 14,
) -> pd.DataFrame:
    """Average Directional Index.

    Returns a DataFrame with columns: ``adx``, ``plus_di``, ``minus_di``.
    """
    prev_high = high.shift(1)
    prev_low = low.shift(1)
    prev_close = close.shift(1)

    # True Range
    tr = pd.concat(
        [
            high - low,
            (high - prev_close).abs(),
            (low - prev_close).abs(),
        ],
        axis=1,
    ).max(axis=1)

    # Directional movement
    up_move = high - prev_high
    down_move = prev_low - low

    plus_dm = np.where((up_move > down_move) & (up_move > 0), up_move, 0.0)
    minus_dm = np.where((down_move > up_move) & (down_move > 0), down_move, 0.0)

    plus_dm_s = pd.Series(plus_dm, index=high.index)
    minus_dm_s = pd.Series(minus_dm, index=high.index)

    # Wilder smoothing
    atr_s = tr.ewm(alpha=1.0 / period, adjust=False, min_periods=period).mean()
    plus_dm_smooth = plus_dm_s.ewm(alpha=1.0 / period, adjust=False, min_periods=period).mean()
    minus_dm_smooth = minus_dm_s.ewm(alpha=1.0 / period, adjust=False, min_periods=period).mean()

    safe_atr = atr_s.replace(0, np.nan)
    plus_di = 100.0 * plus_dm_smooth / safe_atr
    minus_di = 100.0 * minus_dm_smooth / safe_atr

    dx = 100.0 * (plus_di - minus_di).abs() / (plus_di + minus_di).replace(0, np.nan)
    adx_s = dx.ewm(alpha=1.0 / period, adjust=False, min_periods=period).mean()

    return pd.DataFrame(
        {"adx": adx_s, "plus_di": plus_di, "minus_di": minus_di},
        index=close.index,
    )


# ---------------------------------------------------------------------------
# Volume
# ---------------------------------------------------------------------------

def obv(close: pd.Series, volume: pd.Series) -> pd.Series:
    """On-Balance Volume."""
    direction = np.sign(close.diff())
    direction.iloc[0] = 0
    return (direction * volume).cumsum()


# ---------------------------------------------------------------------------
# Market structure
# ---------------------------------------------------------------------------

def support_resistance_levels(
    high: pd.Series,
    low: pd.Series,
    close: pd.Series,
    window: int = 20,
) -> pd.DataFrame:
    """Identify swing highs and swing lows.

    A swing high at index ``i`` is where ``high[i]`` equals the rolling max
    over the *past* ``window`` bars (causal).  Similarly for swing lows.

    Returns a DataFrame with boolean columns: ``swing_high``, ``swing_low``.
    """
    roll_high = high.rolling(window=window, min_periods=window).max()
    roll_low = low.rolling(window=window, min_periods=window).min()

    swing_high = high == roll_high
    swing_low = low == roll_low

    return pd.DataFrame(
        {"swing_high": swing_high, "swing_low": swing_low},
        index=close.index,
    )
