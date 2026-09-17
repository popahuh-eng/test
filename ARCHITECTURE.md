# Architecture & System Design

## 1. System Architecture Overview

The Trading Signal Platform is composed of decoupled, specialized services operating asynchronously around a transactional PostgreSQL store and an in-memory Redis message bus.

```
                  +-------------------------+
                  | React / Vite Dashboard  |
                  | (Square Terminal Style) |
                  +------------+------------+
                               | (REST / WebSocket)
                               v
                  +-------------------------+
                  |  Fastify Node.js Core   |
                  |  Auth / Risk / Signals  |
                  +-----+-------------+-----+
                        |             |
           (DB queries) |             | (Job queues)
                        v             v
       +--------------------+      +--------------------+
       | PostgreSQL 16      |      | Redis 7 (BullMQ)   |
       | 18 Tables + Audit  |      | Workers & Locks    |
       +--------------------+      +----------+---------+
                                              |
                                              | (HTTP /predict)
                                              v
                                   +--------------------+
                                   | FastAPI ML Engine  |
                                   | XGBoost Classifiers|
                                   +--------------------+
```

---

## 2. Core Subsystems

### A. Data Providers & Ingestion (`apps/backend/src/providers/`)
- **Abstract Interfaces**: `MarketDataProvider`, `NewsProvider`, `SocialProvider`, `MacroProvider`.
- **Implementations**:
  - `TwelveDataProvider`: Twelve Data API with rate limiting and exponential backoff.
  - `NewsApiProvider`: NewsAPI.org ingestion with deduplication.
  - `DemoMarketDataProvider`: Geometric Brownian Motion (GBM) generator for synthetic OHLCV when keys are missing. Clearly marked with `isDemo: true`.
- **Idempotency**: All candles enforced via `UNIQUE(symbol, timeframe, timestamp)` constraint.

### B. Causal Feature Engineering (`apps/ml/src/features/`)
- **No Look-Ahead Guarantee**: Features at index $i$ only compute on values $\le i$.
- **Indicators**: SMA, EMA, RSI, MACD, ATR, ADX, Bollinger Bands, Stochastic, OBV.
- **Verification**: Verified by automated test `apps/ml/tests/test_no_leakage.py`.

### C. Machine Learning Engine (`apps/ml/`)
- **Direction Model**: 3-class XGBoost classifier ($UP = 1$, $NEUTRAL = 0$, $DOWN = -1$).
- **Volatility Model**: XGBoost regressor predicting normalized future ATR.
- **Market Regime Model**: Classification into `TREND_UP`, `TREND_DOWN`, `RANGE`, `HIGH_VOLATILITY`, `LOW_VOLATILITY`.
- **Temporal Splitting**: Chronological 70% Train, 15% Validation, 15% Test.

### D. Signal Engine & Risk Management (`apps/backend/src/signal/` & `src/risk/`)
- **Signal Filters**:
  - Minimum Confidence Threshold (e.g. $\ge 0.70$).
  - Minimum Risk/Reward Ratio (e.g. $\ge 2.0x$).
  - Data Quality Health Filter (OHLC validation, gap check).
  - Cooldown Window & Hourly Symbol Limits.
- **Instrument-Specific Position Sizing**:
  - Forex: Lot sizes calculated with pip values.
  - Crypto: Sizing in base currency with precision rounding.
  - Commodities (Gold): Troy ounce contract multiplier (100 oz/lot).

### E. Paper Trading Execution (`apps/backend/src/paper/`)
- Purely virtual accounts and simulated execution.
- Real-time intra-bar SL/TP execution monitoring on price ticks.

### F. Telegram Alerts (`apps/backend/src/telegram/`)
- Non-blocking notification dispatch with probabilistic disclosures and action buttons.
