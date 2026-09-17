// ============================================================
// Drizzle ORM Schema — Trading Signal Platform
// ============================================================
import {
  pgTable,
  uuid,
  varchar,
  text,
  boolean,
  integer,
  timestamp,
  decimal,
  jsonb,
  uniqueIndex,
  index,
} from 'drizzle-orm/pg-core';
import { sql } from 'drizzle-orm';

// ── Users ────────────────────────────────────────────────────
export const users = pgTable('users', {
  id: uuid('id').primaryKey().default(sql`gen_random_uuid()`),
  email: varchar('email', { length: 255 }).unique().notNull(),
  passwordHash: varchar('password_hash', { length: 255 }).notNull(),
  telegramChatId: varchar('telegram_chat_id', { length: 100 }),
  timezone: varchar('timezone', { length: 50 }).default('UTC'),
  defaultRisk: decimal('default_risk', { precision: 5, scale: 2 }).default('1.0'),
  createdAt: timestamp('created_at', { withTimezone: true }).defaultNow(),
  updatedAt: timestamp('updated_at', { withTimezone: true }).defaultNow(),
});

// ── User Settings ─────────────────────────────────────────────
export const userSettings = pgTable('user_settings', {
  id: uuid('id').primaryKey().default(sql`gen_random_uuid()`),
  userId: uuid('user_id').references(() => users.id, { onDelete: 'cascade' }).unique().notNull(),
  symbols: text('symbols').array().default(sql`ARRAY[]::text[]`),
  timeframes: text('timeframes').array().default(sql`ARRAY[]::text[]`),
  riskPerTrade: decimal('risk_per_trade', { precision: 5, scale: 2 }).default('1.0'),
  minConfidence: decimal('min_confidence', { precision: 5, scale: 4 }).default('0.7000'),
  minRR: decimal('min_rr', { precision: 5, scale: 2 }).default('2.0'),
  newsEnabled: boolean('news_enabled').default(true),
  socialEnabled: boolean('social_enabled').default(false),
  telegramAlerts: boolean('telegram_alerts').default(true),
  signalCooldownMinutes: integer('signal_cooldown_minutes').default(60),
  maxSignalsPerSymbolPerHour: integer('max_signals_per_symbol_per_hour').default(2),
  updatedAt: timestamp('updated_at', { withTimezone: true }).defaultNow(),
});

// ── Instruments ──────────────────────────────────────────────
export const instruments = pgTable('instruments', {
  id: uuid('id').primaryKey().default(sql`gen_random_uuid()`),
  symbol: varchar('symbol', { length: 20 }).unique().notNull(),
  displayName: varchar('display_name', { length: 100 }).notNull(),
  assetType: varchar('asset_type', { length: 20 }).notNull(),
  baseAsset: varchar('base_asset', { length: 20 }).notNull(),
  quoteAsset: varchar('quote_asset', { length: 20 }).notNull(),
  exchange: varchar('exchange', { length: 50 }),
  provider: varchar('provider', { length: 50 }),
  currency: varchar('currency', { length: 10 }),
  tickSize: decimal('tick_size', { precision: 20, scale: 10 }),
  lotSize: decimal('lot_size', { precision: 20, scale: 10 }),
  contractSize: decimal('contract_size', { precision: 20, scale: 10 }),
  minimumOrderSize: decimal('minimum_order_size', { precision: 20, scale: 10 }),
  pricePrecision: integer('price_precision'),
  quantityPrecision: integer('quantity_precision'),
  isActive: boolean('is_active').default(true),
  createdAt: timestamp('created_at', { withTimezone: true }).defaultNow(),
});

// ── Candles ──────────────────────────────────────────────────
export const candles = pgTable(
  'candles',
  {
    id: uuid('id').primaryKey().default(sql`gen_random_uuid()`),
    symbol: varchar('symbol', { length: 20 }).notNull(),
    timeframe: varchar('timeframe', { length: 5 }).notNull(),
    timestamp: timestamp('timestamp', { withTimezone: true }).notNull(),
    open: decimal('open', { precision: 30, scale: 10 }).notNull(),
    high: decimal('high', { precision: 30, scale: 10 }).notNull(),
    low: decimal('low', { precision: 30, scale: 10 }).notNull(),
    close: decimal('close', { precision: 30, scale: 10 }).notNull(),
    volume: decimal('volume', { precision: 30, scale: 10 }),
    source: varchar('source', { length: 50 }),
    isDemo: boolean('is_demo').default(false),
  },
  (table) => ({
    symbolTimeframeTsUniq: uniqueIndex('candles_symbol_timeframe_ts_uniq').on(
      table.symbol,
      table.timeframe,
      table.timestamp,
    ),
    symbolTimeframeTsIdx: index('candles_symbol_timeframe_ts_idx').on(
      table.symbol,
      table.timeframe,
      table.timestamp,
    ),
  }),
);

// ── News ─────────────────────────────────────────────────────
export const news = pgTable(
  'news',
  {
    id: uuid('id').primaryKey().default(sql`gen_random_uuid()`),
    externalId: varchar('external_id', { length: 255 }).unique(),
    timestamp: timestamp('timestamp', { withTimezone: true }).notNull(),
    source: varchar('source', { length: 100 }),
    title: text('title').notNull(),
    summary: text('summary'),
    url: text('url'),
    language: varchar('language', { length: 10 }),
    symbols: text('symbols').array(),
    topics: text('topics').array(),
    rawText: text('raw_text'),
    sentiment: decimal('sentiment', { precision: 5, scale: 4 }),
    relevance: decimal('relevance', { precision: 5, scale: 4 }),
    impactScore: decimal('impact_score', { precision: 5, scale: 4 }),
    isDemo: boolean('is_demo').default(false),
    createdAt: timestamp('created_at', { withTimezone: true }).defaultNow(),
  },
  (table) => ({
    tsIdx: index('news_ts_idx').on(table.timestamp),
  }),
);

// ── Social Posts ─────────────────────────────────────────────
export const socialPosts = pgTable('social_posts', {
  id: uuid('id').primaryKey().default(sql`gen_random_uuid()`),
  externalId: varchar('external_id', { length: 255 }).unique(),
  platform: varchar('platform', { length: 50 }),
  timestamp: timestamp('timestamp', { withTimezone: true }),
  author: varchar('author', { length: 255 }),
  text: text('text'),
  engagement: integer('engagement'),
  sentiment: decimal('sentiment', { precision: 5, scale: 4 }),
  relevance: decimal('relevance', { precision: 5, scale: 4 }),
  impactScore: decimal('impact_score', { precision: 5, scale: 4 }),
  symbols: text('symbols').array(),
  isDemo: boolean('is_demo'),
  createdAt: timestamp('created_at', { withTimezone: true }).defaultNow(),
});

// ── Macro Events ─────────────────────────────────────────────
export const macroEvents = pgTable('macro_events', {
  id: uuid('id').primaryKey().default(sql`gen_random_uuid()`),
  externalId: varchar('external_id', { length: 255 }).unique(),
  timestamp: timestamp('timestamp', { withTimezone: true }),
  country: varchar('country', { length: 10 }),
  currency: varchar('currency', { length: 10 }),
  eventName: varchar('event_name', { length: 255 }),
  eventType: varchar('event_type', { length: 50 }),
  importance: varchar('importance', { length: 10 }),
  forecast: decimal('forecast', { precision: 20, scale: 6 }),
  previous: decimal('previous', { precision: 20, scale: 6 }),
  actual: decimal('actual', { precision: 20, scale: 6 }),
  source: varchar('source', { length: 100 }),
  isReleased: boolean('is_released').default(false),
  createdAt: timestamp('created_at', { withTimezone: true }).defaultNow(),
});

// ── Features ─────────────────────────────────────────────────
export const features = pgTable(
  'features',
  {
    id: uuid('id').primaryKey().default(sql`gen_random_uuid()`),
    symbol: varchar('symbol', { length: 20 }),
    timeframe: varchar('timeframe', { length: 5 }),
    timestamp: timestamp('timestamp', { withTimezone: true }),
    featuresVersion: varchar('features_version', { length: 50 }),
    featureVector: jsonb('feature_vector'),
    isDemo: boolean('is_demo'),
    createdAt: timestamp('created_at', { withTimezone: true }).defaultNow(),
  },
  (table) => ({
    uniqSymbolTimeframeTsVersion: uniqueIndex('features_symbol_tf_ts_version_uniq').on(
      table.symbol,
      table.timeframe,
      table.timestamp,
      table.featuresVersion,
    ),
    symbolTimeframeTsIdx: index('features_symbol_tf_ts_idx').on(
      table.symbol,
      table.timeframe,
      table.timestamp,
    ),
  }),
);

// ── Predictions ──────────────────────────────────────────────
export const predictions = pgTable(
  'predictions',
  {
    id: uuid('id').primaryKey().default(sql`gen_random_uuid()`),
    symbol: varchar('symbol', { length: 20 }),
    timeframe: varchar('timeframe', { length: 5 }),
    timestamp: timestamp('timestamp', { withTimezone: true }),
    probabilityUp: decimal('probability_up', { precision: 10, scale: 8 }),
    probabilityDown: decimal('probability_down', { precision: 10, scale: 8 }),
    probabilityNeutral: decimal('probability_neutral', { precision: 10, scale: 8 }),
    confidence: decimal('confidence', { precision: 10, scale: 8 }),
    expectedVolatility: decimal('expected_volatility', { precision: 20, scale: 10 }),
    marketRegime: varchar('market_regime', { length: 30 }),
    modelVersion: varchar('model_version', { length: 100 }),
    featuresVersion: varchar('features_version', { length: 50 }),
    horizon: varchar('horizon', { length: 10 }),
    isDemo: boolean('is_demo'),
    createdAt: timestamp('created_at', { withTimezone: true }).defaultNow(),
  },
  (table) => ({
    symbolTimeframeTsIdx: index('predictions_symbol_tf_ts_idx').on(
      table.symbol,
      table.timeframe,
      table.timestamp,
    ),
  }),
);

// ── Model Versions ───────────────────────────────────────────
export const modelVersions = pgTable(
  'model_versions',
  {
    id: uuid('id').primaryKey().default(sql`gen_random_uuid()`),
    modelName: varchar('model_name', { length: 100 }),
    version: varchar('version', { length: 50 }),
    artifactPath: varchar('artifact_path', { length: 500 }),
    featuresVersion: varchar('features_version', { length: 50 }),
    trainingStart: timestamp('training_start', { withTimezone: true }),
    trainingEnd: timestamp('training_end', { withTimezone: true }),
    validationMetrics: jsonb('validation_metrics'),
    testMetrics: jsonb('test_metrics'),
    hyperparameters: jsonb('hyperparameters'),
    createdAt: timestamp('created_at', { withTimezone: true }).defaultNow(),
    isActive: boolean('is_active').default(false),
  },
  (table) => ({
    modelNameVersionUniq: uniqueIndex('model_versions_name_version_uniq').on(
      table.modelName,
      table.version,
    ),
  }),
);

// ── Signals ──────────────────────────────────────────────────
export const signals = pgTable(
  'signals',
  {
    id: uuid('id').primaryKey().default(sql`gen_random_uuid()`),
    userId: uuid('user_id').references(() => users.id),
    symbol: varchar('symbol', { length: 20 }),
    timestamp: timestamp('timestamp', { withTimezone: true }),
    direction: varchar('direction', { length: 10 }),
    entry: decimal('entry', { precision: 30, scale: 10 }),
    stopLoss: decimal('stop_loss', { precision: 30, scale: 10 }),
    takeProfit: decimal('take_profit', { precision: 30, scale: 10 }),
    positionSize: decimal('position_size', { precision: 20, scale: 10 }),
    riskPercent: decimal('risk_percent', { precision: 5, scale: 2 }),
    riskReward: decimal('risk_reward', { precision: 10, scale: 4 }),
    confidence: decimal('confidence', { precision: 10, scale: 8 }),
    probabilityUp: decimal('probability_up', { precision: 10, scale: 8 }),
    probabilityDown: decimal('probability_down', { precision: 10, scale: 8 }),
    marketRegime: varchar('market_regime', { length: 30 }),
    newsSentiment: decimal('news_sentiment', { precision: 5, scale: 4 }),
    socialSentiment: decimal('social_sentiment', { precision: 5, scale: 4 }),
    modelVersion: varchar('model_version', { length: 100 }),
    reasonCodes: text('reason_codes').array(),
    predictionId: uuid('prediction_id').references(() => predictions.id),
    isDemo: boolean('is_demo'),
    createdAt: timestamp('created_at', { withTimezone: true }).defaultNow(),
  },
  (table) => ({
    symbolTsIdx: index('signals_symbol_ts_idx').on(table.symbol, table.timestamp),
    userTsIdx: index('signals_user_ts_idx').on(table.userId, table.timestamp),
  }),
);

// ── Paper Accounts ───────────────────────────────────────────
export const paperAccounts = pgTable('paper_accounts', {
  id: uuid('id').primaryKey().default(sql`gen_random_uuid()`),
  userId: uuid('user_id').references(() => users.id, { onDelete: 'cascade' }),
  name: varchar('name', { length: 100 }),
  balance: decimal('balance', { precision: 20, scale: 2 }),
  initialBalance: decimal('initial_balance', { precision: 20, scale: 2 }),
  totalPnl: decimal('total_pnl', { precision: 20, scale: 2 }).default('0'),
  isActive: boolean('is_active').default(true),
  createdAt: timestamp('created_at', { withTimezone: true }).defaultNow(),
  updatedAt: timestamp('updated_at', { withTimezone: true }).defaultNow(),
});

// ── Paper Trades ─────────────────────────────────────────────
export const paperTrades = pgTable('paper_trades', {
  id: uuid('id').primaryKey().default(sql`gen_random_uuid()`),
  accountId: uuid('account_id').references(() => paperAccounts.id, { onDelete: 'cascade' }),
  signalId: uuid('signal_id').references(() => signals.id),
  symbol: varchar('symbol', { length: 20 }),
  direction: varchar('direction', { length: 10 }),
  entryPrice: decimal('entry_price', { precision: 30, scale: 10 }),
  stopLoss: decimal('stop_loss', { precision: 30, scale: 10 }),
  takeProfit: decimal('take_profit', { precision: 30, scale: 10 }),
  positionSize: decimal('position_size', { precision: 20, scale: 10 }),
  riskPercent: decimal('risk_percent', { precision: 5, scale: 2 }),
  fees: decimal('fees', { precision: 20, scale: 10 }),
  pnl: decimal('pnl', { precision: 20, scale: 10 }),
  status: varchar('status', { length: 20 }),
  openedAt: timestamp('opened_at', { withTimezone: true }),
  closedAt: timestamp('closed_at', { withTimezone: true }),
  closePrice: decimal('close_price', { precision: 30, scale: 10 }),
  closeReason: varchar('close_reason', { length: 100 }),
  isDemo: boolean('is_demo'),
});

// ── Backtests ─────────────────────────────────────────────────
export const backtests = pgTable('backtests', {
  id: uuid('id').primaryKey().default(sql`gen_random_uuid()`),
  userId: uuid('user_id').references(() => users.id),
  config: jsonb('config'),
  status: varchar('status', { length: 20 }).default('PENDING'),
  totalTrades: integer('total_trades'),
  winRate: decimal('win_rate', { precision: 10, scale: 8 }),
  profitFactor: decimal('profit_factor', { precision: 10, scale: 4 }),
  netPnl: decimal('net_pnl', { precision: 20, scale: 2 }),
  maxDrawdown: decimal('max_drawdown', { precision: 10, scale: 8 }),
  averageTrade: decimal('average_trade', { precision: 20, scale: 10 }),
  largestWin: decimal('largest_win', { precision: 20, scale: 10 }),
  largestLoss: decimal('largest_loss', { precision: 20, scale: 10 }),
  sharpeRatio: decimal('sharpe_ratio', { precision: 10, scale: 4 }),
  startingBalance: decimal('starting_balance', { precision: 20, scale: 2 }),
  finalBalance: decimal('final_balance', { precision: 20, scale: 2 }),
  equityCurve: jsonb('equity_curve'),
  error: text('error'),
  createdAt: timestamp('created_at', { withTimezone: true }).defaultNow(),
  updatedAt: timestamp('updated_at', { withTimezone: true }).defaultNow(),
});

// ── Backtest Trades ──────────────────────────────────────────
export const backtestTrades = pgTable('backtest_trades', {
  id: uuid('id').primaryKey().default(sql`gen_random_uuid()`),
  backtestId: uuid('backtest_id').references(() => backtests.id, { onDelete: 'cascade' }),
  timestamp: timestamp('timestamp', { withTimezone: true }),
  symbol: varchar('symbol', { length: 20 }),
  direction: varchar('direction', { length: 10 }),
  entryPrice: decimal('entry_price', { precision: 30, scale: 10 }),
  exitPrice: decimal('exit_price', { precision: 30, scale: 10 }),
  stopLoss: decimal('stop_loss', { precision: 30, scale: 10 }),
  takeProfit: decimal('take_profit', { precision: 30, scale: 10 }),
  positionSize: decimal('position_size', { precision: 20, scale: 10 }),
  pnl: decimal('pnl', { precision: 20, scale: 10 }),
  fees: decimal('fees', { precision: 20, scale: 10 }),
  slippage: decimal('slippage', { precision: 20, scale: 10 }),
  exitReason: varchar('exit_reason', { length: 50 }),
  duration: integer('duration'), // seconds
});

// ── Provider Status ──────────────────────────────────────────
export const providerStatus = pgTable('provider_status', {
  id: uuid('id').primaryKey().default(sql`gen_random_uuid()`),
  name: varchar('name', { length: 100 }).unique(),
  status: varchar('status', { length: 20 }),
  lastCheck: timestamp('last_check', { withTimezone: true }),
  message: text('message'),
  updatedAt: timestamp('updated_at', { withTimezone: true }).defaultNow(),
});

// ── Audit Logs ───────────────────────────────────────────────
export const auditLogs = pgTable('audit_logs', {
  id: uuid('id').primaryKey().default(sql`gen_random_uuid()`),
  userId: uuid('user_id'),
  action: varchar('action', { length: 100 }),
  entityType: varchar('entity_type', { length: 50 }),
  entityId: varchar('entity_id', { length: 255 }),
  inputSnapshot: jsonb('input_snapshot'),
  outputSnapshot: jsonb('output_snapshot'),
  metadata: jsonb('metadata'),
  createdAt: timestamp('created_at', { withTimezone: true }).defaultNow(),
});
