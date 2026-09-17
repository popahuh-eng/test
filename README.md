# Trading Signal Platform — Quantitative AI Analytics & Paper Trading

Production-style full-stack quantitative analytics platform featuring multi-asset market data ingestion, causal ML direction models, financial news sentiment NLP, an autonomous signal engine with risk-adjusted position sizing, backtesting, simulated paper trading, an interactive dark terminal dashboard, and Telegram bot alerts.

---

## Safety & Core Principles

> **IMPORTANT DISCLAIMER:**
> This software is an algorithmic research and simulation platform. All signals and outputs are **probabilistic AI estimates** and **never a guarantee of profit**. Never risk capital you cannot afford to lose.

- **Paper-First Safety**: `LIVE_TRADING_ENABLED=false` is enforced by default. Live execution is disconnected from the broker execution layer.
- **Zero Look-Ahead Bias**: Predictions at timestamp $T$ never utilize candles, news, social posts, or unreleased macro figures published after $T$. Verified automatically by `test_no_leakage.py`.
- **Modular Pipeline**: Decoupled ingestion $\rightarrow$ features $\rightarrow$ ML models $\rightarrow$ signal filters $\rightarrow$ risk manager $\rightarrow$ paper trading / alerts.
- **Zero Secrets in Git**: All configuration is managed via `.env` with comprehensive `.env.example` templates.

---

## Architectural Flow

```
+--------------------------+    +-----------------------+
| Market Data (1m/1h/1d)   |    | News & Macro Events   |
| Twelve Data / CCXT / Demo|    | NewsAPI / NLP Scorer  |
+------------+-------------+    +-----------+-----------+
             |                              |
             +--------------+---------------+
                            |
             +--------------v---------------+
             | Causal Feature Pipeline      |
             | Price, Trend, Mom, Vol, OBV  |
             +--------------+---------------+
                            |
             +--------------v---------------+
             | ML Direction & Regime Engine |
             | Calibrated XGBoost Classif.  |
             +--------------+---------------+
                            |
             +--------------v---------------+
             | Autonomous Signal Engine     |
             | Confidence, Regime, Filters  |
             +--------------+---------------+
                            |
             +--------------v---------------+
             | Mathematical Risk Manager    |
             | ATR Stop, TP, Lot Size Calc  |
             +--------------+---------------+
                            |
             +--------------+---------------+
             |                              |
      +------v------+                +------v-------+
      | Web UI      |                | Telegram Bot |
      | TV Charts   |                | Push Alerts  |
      | Paper Trade |                | Fast Action  |
      +-------------+                +--------------+
```

---

## Quick Start (Local Development)

### 1. Prerequisites
- **Node.js**: v20+ with `pnpm`
- **Python**: v3.11+
- **Docker & Docker Compose**: (PostgreSQL 16, Redis 7)

### 2. Environment Configuration
```bash
cp .env.example .env
```

### 3. Start Infrastructure via Docker Compose
```bash
docker compose up -d postgres redis
```

### 4. Database Setup & Migrations
```bash
pnpm install
pnpm --filter backend migrate
pnpm --filter backend seed:demo
```

### 5. Start Application Services
```bash
# Terminal 1: Backend API & Background Workers
pnpm --filter backend dev

# Terminal 2: ML Python Service
cd apps/ml
pip install -r requirements.txt
uvicorn main:app --host 0.0.0.0 --port 8000 --reload

# Terminal 3: React Terminal Frontend
pnpm --filter frontend dev
```
Open **http://localhost:3000** in your browser.

---

## Verification & Testing

Run unit tests across backend, ML causal tests, and risk math:

```bash
# ML Feature & Critical No-Leakage Automated Tests
cd apps/ml
pytest tests/test_no_leakage.py tests/test_features.py -v

# Backend Risk, Signal, & Backtest Tests
pnpm --filter backend test
```

---

## Telegram Bot Integration

1. Create a bot using [@BotFather](https://t.me/BotFather) and copy your API Token.
2. In your `.env`:
   ```env
   TELEGRAM_BOT_TOKEN=your_token_here
   ```
3. Restart the backend service.
4. Send `/start` to your bot in Telegram to receive your `Chat ID`.
5. Enter your Chat ID in the Web Dashboard under **Settings**.
6. Available bot commands:
   - `/status` — System health & data providers
   - `/signals` — Latest AI trading signals
   - `/paper` — Virtual paper account overview
   - `/performance` — Win rate & statistics
   - `/instruments` — Supported asset directory

---

## Production Deployment on Render

Full deployment guide is documented in [`DEPLOYMENT.md`](./DEPLOYMENT.md).
1. Push code to your GitHub repository.
2. Link your repository in Render Dashboard.
3. Use the provided Dockerfiles (`docker/backend.Dockerfile`, `docker/frontend.Dockerfile`, `docker/ml.Dockerfile`).
4. Provision Managed PostgreSQL and Redis on Render.
