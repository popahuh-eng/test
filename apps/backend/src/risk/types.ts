// ============================================================
// Risk Manager Types — Trading Signal Platform
// ============================================================

export interface InstrumentSpec {
  symbol: string;
  assetType: 'FOREX' | 'CRYPTO' | 'COMMODITY' | 'INDEX' | 'STOCK';
  pricePrecision: number;
  quantityPrecision: number;
  tickSize: number;
  lotSize: number;
  contractSize: number;
  minimumOrderSize: number;
  pipValue?: number;  // For FOREX — value of 1 pip in account currency per lot
}

export interface RiskParams {
  accountBalance: number;
  riskPerTrade: number;  // percentage, e.g. 1.0 = 1%
  maxDailyLoss: number;  // percentage
  maxOpenPositions: number;
  maxDrawdown: number;   // percentage
  defaultRR: number;
}

export interface PositionSizeResult {
  positionSize: number;
  riskAmount: number;
  stopDistance: number;
  takeProfitDistance: number;
  riskReward: number;
  stopLoss: number;
  takeProfit: number;
  entry: number;
}
