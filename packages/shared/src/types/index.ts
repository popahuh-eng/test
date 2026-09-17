// ============================================================
// Shared Types — Trading Signal Platform
// ============================================================

// Instruments
export type AssetType = 'FOREX' | 'CRYPTO' | 'COMMODITY' | 'INDEX' | 'STOCK';

export interface Instrument {
  id: string;
  symbol: string;
  displayName: string;
  assetType: AssetType;
  baseAsset: string;
  quoteAsset: string;
  exchange: string;
  provider: string;
  currency: string;
  tickSize: number;
  lotSize: number;
  contractSize: number;
  minimumOrderSize: number;
  pricePrecision: number;
  quantityPrecision: number;
  isActive: boolean;
}

// Candles
export type Timeframe = '1m' | '5m' | '15m' | '1h' | '4h' | '1d';

export interface Candle {
  timestamp: Date;
  open: number;
  high: number;
  low: number;
  close: number;
  volume: number;
  symbol: string;
  timeframe: Timeframe;
  source: string;
}

// Market Regime
export type MarketRegime =
  | 'TREND_UP'
  | 'TREND_DOWN'
  | 'RANGE'
  | 'HIGH_VOLATILITY'
  | 'LOW_VOLATILITY';

// Signal Direction
export type SignalDirection = 'LONG' | 'SHORT' | 'NO_SIGNAL';

// Signal
export interface Signal {
  id: string;
  symbol: string;
  timestamp: Date;
  direction: SignalDirection;
  entry: number;
  stopLoss: number;
  takeProfit: number;
  positionSize: number;
  riskPercent: number;
  riskReward: number;
  confidence: number;
  probabilityUp: number;
  probabilityDown: number;
  marketRegime: MarketRegime;
  newsSentiment: number | null;
  socialSentiment: number | null;
  modelVersion: string;
  reasonCodes: string[];
  isDemo: boolean;
}

// News
export interface NewsItem {
  id: string;
  timestamp: Date;
  source: string;
  title: string;
  summary: string;
  url: string;
  language: string;
  symbols: string[];
  topics: string[];
  sentiment: number;
  relevance: number;
  impactScore: number;
}

// Social Post
export interface SocialPost {
  id: string;
  externalId: string;
  platform: string;
  timestamp: Date;
  author: string;
  text: string;
  engagement: number;
  sentiment: number;
  relevance: number;
  impactScore: number;
  symbols: string[];
}

// Macro Event
export type MacroEventType =
  | 'CPI'
  | 'PPI'
  | 'NFP'
  | 'GDP'
  | 'FOMC'
  | 'INTEREST_RATE'
  | 'UNEMPLOYMENT'
  | 'PMI'
  | 'RETAIL_SALES'
  | 'CENTRAL_BANK_SPEECH'
  | 'OTHER';

export type MacroImportance = 'LOW' | 'MEDIUM' | 'HIGH';

export interface MacroEvent {
  id: string;
  timestamp: Date;
  country: string;
  currency: string;
  eventName: string;
  eventType: MacroEventType;
  importance: MacroImportance;
  forecast: number | null;
  previous: number | null;
  actual: number | null;
  source: string;
  isReleased: boolean;
}

// ML Prediction
export interface Prediction {
  symbol: string;
  timeframe: Timeframe;
  timestamp: Date;
  probabilityUp: number;
  probabilityDown: number;
  probabilityNeutral: number;
  confidence: number;
  expectedVolatility: number;
  marketRegime: MarketRegime;
  modelVersion: string;
  featuresVersion: string;
  horizon: string;
  isDemo: boolean;
}

// Paper Trading
export type PaperTradeStatus = 'OPEN' | 'TP' | 'SL' | 'CLOSED' | 'CANCELLED';

export interface PaperTrade {
  id: string;
  accountId: string;
  signalId: string | null;
  symbol: string;
  direction: 'LONG' | 'SHORT';
  entryPrice: number;
  stopLoss: number;
  takeProfit: number;
  positionSize: number;
  riskPercent: number;
  fees: number;
  pnl: number | null;
  status: PaperTradeStatus;
  openedAt: Date;
  closedAt: Date | null;
  closePrice: number | null;
  closeReason: string | null;
}

// Provider Status
export type ProviderStatus = 'ONLINE' | 'DEGRADED' | 'OFFLINE' | 'UNAVAILABLE';

export interface ProviderStatusInfo {
  name: string;
  status: ProviderStatus;
  lastCheck: Date;
  message: string | null;
}

// Model Version
export interface ModelVersion {
  id: string;
  modelName: string;
  version: string;
  artifactPath: string;
  featuresVersion: string;
  trainingStart: Date;
  trainingEnd: Date;
  validationMetrics: Record<string, number>;
  testMetrics: Record<string, number>;
  hyperparameters: Record<string, unknown>;
  createdAt: Date;
  isActive: boolean;
}

// Backtest
export interface BacktestConfig {
  symbol: string;
  timeframe: Timeframe;
  startDate: Date;
  endDate: Date;
  startingBalance: number;
  riskPerTrade: number;
  modelVersion: string;
  commission: number;
  slippage: number;
  spreadPips: number;
}

export interface BacktestResult {
  id: string;
  config: BacktestConfig;
  totalTrades: number;
  winRate: number;
  profitFactor: number;
  netPnl: number;
  maxDrawdown: number;
  averageTrade: number;
  largestWin: number;
  largestLoss: number;
  sharpeRatio: number;
  startingBalance: number;
  finalBalance: number;
  equityCurve: Array<{ timestamp: Date; equity: number }>;
  createdAt: Date;
  status: 'PENDING' | 'RUNNING' | 'COMPLETED' | 'FAILED';
}

// User Settings
export interface UserSettings {
  symbols: string[];
  timeframes: Timeframe[];
  riskPerTrade: number;
  minConfidence: number;
  minRR: number;
  newsEnabled: boolean;
  socialEnabled: boolean;
  telegramAlerts: boolean;
  signalCooldownMinutes: number;
  maxSignalsPerSymbolPerHour: number;
}

// API Response wrapper
export interface ApiResponse<T> {
  success: boolean;
  data: T | null;
  error: string | null;
  timestamp: string;
}
