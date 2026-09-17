# REST & WebSocket API Reference

The backend exposes a documented REST API powered by Fastify and Swagger.
Interactive documentation is accessible at `http://localhost:5000/docs`.

---

## Authentication Endpoints

### `POST /api/auth/register`
Register a new trader account.
- **Request Body**:
  ```json
  {
    "email": "trader@domain.com",
    "password": "SecurePassword123!"
  }
  ```
- **Response**: Returns `{ accessToken, refreshToken, user }`.

### `POST /api/auth/login`
Authenticate with email and password.
- **Request Body**:
  ```json
  {
    "email": "trader@domain.com",
    "password": "SecurePassword123!"
  }
  ```

### `POST /api/auth/refresh`
Refresh an expired access token using a valid refresh token.

### `GET /api/auth/me` *(Protected)*
Fetch profile information for authenticated session.

---

## Market & Instruments Endpoints

### `GET /api/instruments`
Returns array of all active traded instruments (XAU/USD, BTC/USDT, ETH/USDT, EUR/USD).

### `GET /api/market/:symbol?timeframe=1h&limit=200`
Fetch historic OHLCV candle records for specified symbol and timeframe.

### `GET /api/market/:symbol/snapshot`
Fetch latest market price, 24h change, and volume.

---

## Signals & Predictions Endpoints

### `GET /api/signals?symbol=XAUUSD&limit=20`
Fetch AI trading signals with reason codes and probabilistic distributions.

### `GET /api/signals/:id`
Fetch single signal detail by ID.

---

## Paper Trading Endpoints *(Protected)*

### `GET /api/paper/account`
Fetch or automatically initialize current user's virtual paper account.

### `GET /api/paper/trades`
List all paper trades (open and closed).

### `POST /api/paper/trades`
Manually open a paper trade.

### `PATCH /api/paper/trades/:id/close`
Close an open paper trade with exit price and reason.

---

## Backtesting Endpoints *(Protected)*

### `GET /api/backtests`
List all user backtest simulations.

### `GET /api/backtests/:id`
Fetch backtest result including equity curve and executed trade log.

### `POST /api/backtests`
Enqueue a backtest simulation job.
- **Request Body**:
  ```json
  {
    "symbol": "XAUUSD",
    "timeframe": "1h",
    "startDate": "2024-01-01T00:00:00Z",
    "endDate": "2024-02-01T00:00:00Z",
    "startingBalance": 10000,
    "riskPerTrade": 1.0,
    "modelVersion": "baseline_v1",
    "commission": 0.0002,
    "slippage": 0.0001,
    "spreadPips": 1
  }
  ```

---

## WebSocket Stream

Connect to `ws://localhost:5000/ws?token=<JWT_TOKEN>`.
Receives real-time events:
- `candle`: Live candle updates
- `signal`: New AI trading alerts
- `paper_trade`: Positions opened or closed
