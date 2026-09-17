# Environment Variables Specification

This document lists all environment variables used across the platform, their default values, and descriptions.

---

## Backend & General (`.env`)

| Variable | Default | Required | Description |
|---|---|---|---|
| `NODE_ENV` | `development` | No | Node environment (`development`, `production`, `test`) |
| `PORT` | `5000` | No | Fastify HTTP server port |
| `FRONTEND_URL` | `http://localhost:3000` | No | Frontend URL for CORS and links |
| `DATABASE_URL` | - | **Yes** | PostgreSQL connection URI |
| `REDIS_URL` | `redis://localhost:6379` | No | Redis connection URI for queues & cache |
| `ML_SERVICE_URL` | `http://localhost:8000` | No | URL of Python FastAPI ML service |
| `JWT_SECRET` | - | **Yes** | 64+ char secret for JWT access tokens |
| `JWT_REFRESH_SECRET` | - | **Yes** | 64+ char secret for JWT refresh tokens |
| `JWT_EXPIRES_IN` | `15m` | No | Access token expiration duration |
| `JWT_REFRESH_EXPIRES_IN` | `7d` | No | Refresh token expiration duration |

---

## Market Data & News Providers

| Variable | Default | Required | Description |
|---|---|---|---|
| `MARKET_DATA_PROVIDER` | `demo` | No | Options: `twelvedata`, `ccxt`, `demo` |
| `MARKET_DATA_API_KEY` | `""` | Optional | API Key for Twelve Data |
| `NEWS_PROVIDER` | `demo` | No | Options: `newsapi`, `demo` |
| `NEWS_API_KEY` | `""` | Optional | API Key for NewsAPI.org |
| `SOCIAL_PROVIDER` | `disabled` | No | Options: `twitter`, `disabled` |
| `X_API_KEY` | `""` | Optional | Twitter / X API Key |
| `X_API_SECRET` | `""` | Optional | Twitter / X API Secret |
| `X_BEARER_TOKEN` | `""` | Optional | Twitter / X Bearer Token |

---

## Telegram Bot Integration

| Variable | Default | Required | Description |
|---|---|---|---|
| `TELEGRAM_BOT_TOKEN` | `""` | Optional | Telegram Bot API token from @BotFather |
| `TELEGRAM_WEBHOOK_URL` | `""` | Optional | Webhook URL (if using webhook instead of polling) |

---

## Trading Safety Guardrails

| Variable | Default | Required | Description |
|---|---|---|---|
| `LIVE_TRADING_ENABLED` | `false` | No | Safety lock. Real broker execution is blocked when false |
| `DEFAULT_RISK_PER_TRADE` | `1.0` | No | Default risk percentage per trade |
| `DEFAULT_MIN_CONFIDENCE` | `0.70` | No | Minimum model confidence threshold |
| `DEFAULT_MIN_RR` | `2.0` | No | Minimum Risk / Reward ratio |
| `SIGNAL_COOLDOWN_MINUTES` | `60` | No | Cooldown period between signals for same asset |
| `MAX_SIGNALS_PER_SYMBOL_PER_HOUR` | `2` | No | Rate limit per asset per hour |
