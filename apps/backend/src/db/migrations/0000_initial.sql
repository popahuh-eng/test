-- ============================================================
-- Trading Signal Platform — Initial Schema Migration
-- ============================================================

CREATE EXTENSION IF NOT EXISTS "pgcrypto";

-- ── Users ──
CREATE TABLE IF NOT EXISTS users (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  email VARCHAR(255) UNIQUE NOT NULL,
  password_hash VARCHAR(255) NOT NULL,
  telegram_chat_id VARCHAR(100),
  timezone VARCHAR(50) DEFAULT 'UTC',
  default_risk NUMERIC(5, 2) DEFAULT 1.0,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- ── User Settings ──
CREATE TABLE IF NOT EXISTS user_settings (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID UNIQUE NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  symbols TEXT[] DEFAULT ARRAY[]::TEXT[],
  timeframes TEXT[] DEFAULT ARRAY[]::TEXT[],
  risk_per_trade NUMERIC(5, 2) DEFAULT 1.0,
  min_confidence NUMERIC(5, 4) DEFAULT 0.7000,
  min_rr NUMERIC(5, 2) DEFAULT 2.0,
  news_enabled BOOLEAN DEFAULT TRUE,
  social_enabled BOOLEAN DEFAULT FALSE,
  telegram_alerts BOOLEAN DEFAULT TRUE,
  signal_cooldown_minutes INTEGER DEFAULT 60,
  max_signals_per_symbol_per_hour INTEGER DEFAULT 2,
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- ── Instruments ──
CREATE TABLE IF NOT EXISTS instruments (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  symbol VARCHAR(20) UNIQUE NOT NULL,
  display_name VARCHAR(100) NOT NULL,
  asset_type VARCHAR(20) NOT NULL,
  base_asset VARCHAR(20) NOT NULL,
  quote_asset VARCHAR(20) NOT NULL,
  exchange VARCHAR(50),
  provider VARCHAR(50),
  currency VARCHAR(10),
  tick_size NUMERIC(20, 10),
  lot_size NUMERIC(20, 10),
  contract_size NUMERIC(20, 10),
  minimum_order_size NUMERIC(20, 10),
  price_precision INTEGER,
  quantity_precision INTEGER,
  is_active BOOLEAN DEFAULT TRUE,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

-- ── Candles ──
CREATE TABLE IF NOT EXISTS candles (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  symbol VARCHAR(20) NOT NULL,
  timeframe VARCHAR(5) NOT NULL,
  timestamp TIMESTAMPTZ NOT NULL,
  open NUMERIC(30, 10) NOT NULL,
  high NUMERIC(30, 10) NOT NULL,
  low NUMERIC(30, 10) NOT NULL,
  close NUMERIC(30, 10) NOT NULL,
  volume NUMERIC(30, 10),
  source VARCHAR(50),
  is_demo BOOLEAN DEFAULT FALSE,
  CONSTRAINT candles_symbol_tf_ts_unique UNIQUE (symbol, timeframe, timestamp)
);
CREATE INDEX IF NOT EXISTS idx_candles_symbol_tf_ts ON candles (symbol, timeframe, timestamp DESC);

-- ── News ──
CREATE TABLE IF NOT EXISTS news (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  external_id VARCHAR(255) UNIQUE,
  timestamp TIMESTAMPTZ NOT NULL,
  source VARCHAR(100),
  title TEXT NOT NULL,
  summary TEXT,
  url TEXT,
  language VARCHAR(10) DEFAULT 'en',
  symbols TEXT[] DEFAULT ARRAY[]::TEXT[],
  topics TEXT[] DEFAULT ARRAY[]::TEXT[],
  raw_text TEXT,
  sentiment NUMERIC(5, 4),
  relevance NUMERIC(5, 4),
  impact_score NUMERIC(5, 4),
  is_demo BOOLEAN DEFAULT FALSE,
  created_at TIMESTAMPTZ DEFAULT NOW()
);
CREATE INDEX IF NOT EXISTS idx_news_timestamp ON news (timestamp DESC);

-- ── Social Posts ──
CREATE TABLE IF NOT EXISTS social_posts (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  external_id VARCHAR(255) UNIQUE,
  platform VARCHAR(50),
  timestamp TIMESTAMPTZ,
  author VARCHAR(255),
  text TEXT,
  engagement INTEGER DEFAULT 0,
  sentiment NUMERIC(5, 4),
  relevance NUMERIC(5, 4),
  impact_score NUMERIC(5, 4),
  symbols TEXT[] DEFAULT ARRAY[]::TEXT[],
  is_demo BOOLEAN DEFAULT FALSE,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

-- ── Macro Events ──
CREATE TABLE IF NOT EXISTS macro_events (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  external_id VARCHAR(255) UNIQUE,
  timestamp TIMESTAMPTZ,
  country VARCHAR(10),
  currency VARCHAR(10),
  event_name VARCHAR(255),
  event_type VARCHAR(50),
  importance VARCHAR(10),
  forecast NUMERIC(20, 6),
  previous NUMERIC(20, 6),
  actual NUMERIC(20, 6),
  source VARCHAR(100),
  is_released BOOLEAN DEFAULT FALSE,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

-- ── Features ──
CREATE TABLE IF NOT EXISTS features (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  symbol VARCHAR(20),
  timeframe VARCHAR(5),
  timestamp TIMESTAMPTZ,
  features_version VARCHAR(50),
  feature_vector JSONB,
  is_demo BOOLEAN DEFAULT FALSE,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  CONSTRAINT features_unique_entry UNIQUE (symbol, timeframe, timestamp, features_version)
);
CREATE INDEX IF NOT EXISTS idx_features_lookup ON features (symbol, timeframe, timestamp DESC);

-- ── Predictions ──
CREATE TABLE IF NOT EXISTS predictions (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  symbol VARCHAR(20),
  timeframe VARCHAR(5),
  timestamp TIMESTAMPTZ,
  probability_up NUMERIC(10, 8),
  probability_down NUMERIC(10, 8),
  probability_neutral NUMERIC(10, 8),
  confidence NUMERIC(10, 8),
  expected_volatility NUMERIC(20, 10),
  market_regime VARCHAR(30),
  model_version VARCHAR(100),
  features_version VARCHAR(50),
  horizon VARCHAR(10),
  is_demo BOOLEAN DEFAULT FALSE,
  created_at TIMESTAMPTZ DEFAULT NOW()
);
CREATE INDEX IF NOT EXISTS idx_predictions_lookup ON predictions (symbol, timeframe, timestamp DESC);

-- ── Model Versions ──
CREATE TABLE IF NOT EXISTS model_versions (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  model_name VARCHAR(100) NOT NULL,
  version VARCHAR(50) NOT NULL,
  artifact_path VARCHAR(500),
  features_version VARCHAR(50),
  training_start TIMESTAMPTZ,
  training_end TIMESTAMPTZ,
  validation_metrics JSONB,
  test_metrics JSONB,
  hyperparameters JSONB,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  is_active BOOLEAN DEFAULT FALSE,
  CONSTRAINT model_versions_unique_name_ver UNIQUE (model_name, version)
);

-- ── Signals ──
CREATE TABLE IF NOT EXISTS signals (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID REFERENCES users(id) ON DELETE SET NULL,
  symbol VARCHAR(20) NOT NULL,
  timestamp TIMESTAMPTZ NOT NULL,
  direction VARCHAR(10) NOT NULL,
  entry NUMERIC(30, 10) NOT NULL,
  stop_loss NUMERIC(30, 10) NOT NULL,
  take_profit NUMERIC(30, 10) NOT NULL,
  position_size NUMERIC(20, 10) NOT NULL,
  risk_percent NUMERIC(5, 2) NOT NULL,
  risk_reward NUMERIC(10, 4) NOT NULL,
  confidence NUMERIC(10, 8) NOT NULL,
  probability_up NUMERIC(10, 8) NOT NULL,
  probability_down NUMERIC(10, 8) NOT NULL,
  market_regime VARCHAR(30),
  news_sentiment NUMERIC(5, 4),
  social_sentiment NUMERIC(5, 4),
  model_version VARCHAR(100),
  reason_codes TEXT[] DEFAULT ARRAY[]::TEXT[],
  prediction_id UUID REFERENCES predictions(id) ON DELETE SET NULL,
  is_demo BOOLEAN DEFAULT FALSE,
  created_at TIMESTAMPTZ DEFAULT NOW()
);
CREATE INDEX IF NOT EXISTS idx_signals_symbol_ts ON signals (symbol, timestamp DESC);

-- ── Paper Accounts ──
CREATE TABLE IF NOT EXISTS paper_accounts (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID REFERENCES users(id) ON DELETE CASCADE,
  name VARCHAR(100) DEFAULT 'Paper Account',
  balance NUMERIC(20, 2) DEFAULT 10000.00,
  initial_balance NUMERIC(20, 2) DEFAULT 10000.00,
  total_pnl NUMERIC(20, 2) DEFAULT 0.00,
  is_active BOOLEAN DEFAULT TRUE,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- ── Paper Trades ──
CREATE TABLE IF NOT EXISTS paper_trades (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  account_id UUID REFERENCES paper_accounts(id) ON DELETE CASCADE,
  signal_id UUID REFERENCES signals(id) ON DELETE SET NULL,
  symbol VARCHAR(20) NOT NULL,
  direction VARCHAR(10) NOT NULL,
  entry_price NUMERIC(30, 10) NOT NULL,
  stop_loss NUMERIC(30, 10) NOT NULL,
  take_profit NUMERIC(30, 10) NOT NULL,
  position_size NUMERIC(20, 10) NOT NULL,
  risk_percent NUMERIC(5, 2) NOT NULL,
  fees NUMERIC(20, 10) DEFAULT 0,
  pnl NUMERIC(20, 10),
  status VARCHAR(20) DEFAULT 'OPEN',
  opened_at TIMESTAMPTZ DEFAULT NOW(),
  closed_at TIMESTAMPTZ,
  close_price NUMERIC(30, 10),
  close_reason VARCHAR(100),
  is_demo BOOLEAN DEFAULT TRUE
);

-- ── Backtests ──
CREATE TABLE IF NOT EXISTS backtests (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID REFERENCES users(id) ON DELETE CASCADE,
  config JSONB NOT NULL,
  status VARCHAR(20) DEFAULT 'PENDING',
  total_trades INTEGER,
  win_rate NUMERIC(10, 8),
  profit_factor NUMERIC(10, 4),
  net_pnl NUMERIC(20, 2),
  max_drawdown NUMERIC(10, 8),
  average_trade NUMERIC(20, 10),
  largest_win NUMERIC(20, 10),
  largest_loss NUMERIC(20, 10),
  sharpe_ratio NUMERIC(10, 4),
  starting_balance NUMERIC(20, 2),
  final_balance NUMERIC(20, 2),
  equity_curve JSONB,
  error TEXT,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- ── Backtest Trades ──
CREATE TABLE IF NOT EXISTS backtest_trades (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  backtest_id UUID REFERENCES backtests(id) ON DELETE CASCADE,
  timestamp TIMESTAMPTZ NOT NULL,
  symbol VARCHAR(20) NOT NULL,
  direction VARCHAR(10) NOT NULL,
  entry_price NUMERIC(30, 10) NOT NULL,
  exit_price NUMERIC(30, 10) NOT NULL,
  stop_loss NUMERIC(30, 10) NOT NULL,
  take_profit NUMERIC(30, 10) NOT NULL,
  position_size NUMERIC(20, 10) NOT NULL,
  pnl NUMERIC(20, 10) NOT NULL,
  fees NUMERIC(20, 10) DEFAULT 0,
  slippage NUMERIC(20, 10) DEFAULT 0,
  exit_reason VARCHAR(50),
  duration INTEGER
);

-- ── Provider Status ──
CREATE TABLE IF NOT EXISTS provider_status (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  name VARCHAR(100) UNIQUE NOT NULL,
  status VARCHAR(20) NOT NULL,
  last_check TIMESTAMPTZ DEFAULT NOW(),
  message TEXT,
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- ── Audit Logs ──
CREATE TABLE IF NOT EXISTS audit_logs (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID,
  action VARCHAR(100) NOT NULL,
  entity_type VARCHAR(50),
  entity_id VARCHAR(255),
  input_snapshot JSONB,
  output_snapshot JSONB,
  metadata JSONB,
  created_at TIMESTAMPTZ DEFAULT NOW()
);
