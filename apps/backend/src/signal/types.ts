// ============================================================
// Signal Engine Types — Trading Signal Platform
// ============================================================
import { SignalDirection, MarketRegime, Timeframe } from '@trading/shared';

export interface SignalInput {
  symbol: string;
  timeframe: Timeframe;
  timestamp: Date;
  // ML predictions
  probabilityUp: number;
  probabilityDown: number;
  probabilityNeutral: number;
  confidence: number;
  expectedVolatility: number;
  marketRegime: MarketRegime;
  // Technical features
  currentPrice: number;
  atr14: number;
  rsi14: number;
  trendDirection: number;  // -1, 0, 1
  adx14: number;
  macdHistogram: number;
  // Context
  newsSentiment: number | null;
  socialSentiment: number | null;
  // Quality
  dataQualityOk: boolean;
  candleCount: number;
}

export interface SignalOutput {
  direction: SignalDirection;
  entry: number;
  stopLoss: number;
  takeProfit: number;
  positionSize: number;
  riskPercent: number;
  riskReward: number;
  reasonCodes: string[];
  filterRejectReasons: string[];
}

export interface SignalConfig {
  minConfidence: number;
  minRR: number;
  signalCooldownMinutes: number;
  maxSignalsPerSymbolPerHour: number;
}
