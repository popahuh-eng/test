// ============================================================
// Configuration — load and validate all environment variables
// ============================================================

function requireEnv(key: string): string {
  const val = process.env[key];
  if (!val || val.trim() === '') {
    throw new Error(`Missing required environment variable: ${key}`);
  }
  return val.trim();
}

function optionalEnv(key: string, defaultValue: string): string {
  return (process.env[key] ?? '').trim() || defaultValue;
}

function optionalBool(key: string, defaultValue: boolean): boolean {
  const val = (process.env[key] ?? '').trim().toLowerCase();
  if (val === 'true' || val === '1') return true;
  if (val === 'false' || val === '0') return false;
  return defaultValue;
}

function optionalNumber(key: string, defaultValue: number): number {
  const val = process.env[key];
  if (!val) return defaultValue;
  const n = Number(val);
  return isNaN(n) ? defaultValue : n;
}

export const config = {
  // App
  nodeEnv: optionalEnv('NODE_ENV', 'development'),
  port: optionalNumber('PORT', 5000),
  frontendUrl: optionalEnv('FRONTEND_URL', 'http://localhost:3000'),

  // Database
  databaseUrl: requireEnv('DATABASE_URL'),

  // Redis
  redisUrl: optionalEnv('REDIS_URL', 'redis://localhost:6379'),

  // ML Service
  mlServiceUrl: optionalEnv('ML_SERVICE_URL', 'http://localhost:8000'),

  // Market Data
  marketDataProvider: optionalEnv('MARKET_DATA_PROVIDER', 'demo'),
  marketDataApiKey: optionalEnv('MARKET_DATA_API_KEY', ''),

  // News
  newsProvider: optionalEnv('NEWS_PROVIDER', 'demo'),
  newsApiKey: optionalEnv('NEWS_API_KEY', ''),

  // Social
  socialProvider: optionalEnv('SOCIAL_PROVIDER', 'disabled'),
  xApiKey: optionalEnv('X_API_KEY', ''),
  xApiSecret: optionalEnv('X_API_SECRET', ''),
  xAccessToken: optionalEnv('X_ACCESS_TOKEN', ''),
  xAccessTokenSecret: optionalEnv('X_ACCESS_TOKEN_SECRET', ''),
  xBearerToken: optionalEnv('X_BEARER_TOKEN', ''),

  // Telegram
  telegramBotToken: optionalEnv('TELEGRAM_BOT_TOKEN', ''),
  telegramWebhookUrl: optionalEnv('TELEGRAM_WEBHOOK_URL', ''),

  // Auth
  jwtSecret: requireEnv('JWT_SECRET'),
  jwtRefreshSecret: requireEnv('JWT_REFRESH_SECRET'),
  jwtExpiresIn: optionalEnv('JWT_EXPIRES_IN', '15m'),
  jwtRefreshExpiresIn: optionalEnv('JWT_REFRESH_EXPIRES_IN', '7d'),

  // Trading Safety
  liveTradingEnabled: optionalBool('LIVE_TRADING_ENABLED', false),

  // Default Settings
  defaultRiskPerTrade: optionalNumber('DEFAULT_RISK_PER_TRADE', 1),
  defaultMinConfidence: optionalNumber('DEFAULT_MIN_CONFIDENCE', 0.70),
  defaultMinRR: optionalNumber('DEFAULT_MIN_RR', 2.0),

  // Signal Engine
  signalCooldownMinutes: optionalNumber('SIGNAL_COOLDOWN_MINUTES', 60),
  maxSignalsPerSymbolPerHour: optionalNumber('MAX_SIGNALS_PER_SYMBOL_PER_HOUR', 2),

  // Data Retention
  newsRetentionDays: optionalNumber('NEWS_RETENTION_DAYS', 90),
  socialRetentionDays: optionalNumber('SOCIAL_RETENTION_DAYS', 30),
  candleRetentionDays: optionalNumber('CANDLE_RETENTION_DAYS', 730),

  // Demo
  demoMode: optionalBool('DEMO_MODE', false),

  get isDev(): boolean {
    return this.nodeEnv === 'development';
  },

  get isProd(): boolean {
    return this.nodeEnv === 'production';
  },
} as const;

export type Config = typeof config;
