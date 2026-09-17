// ============================================================
// Risk Manager — ATR-based SL/TP + instrument-aware sizing
// ============================================================
import { RiskParams, PositionSizeResult, InstrumentSpec } from './types';
import { ATRStopStrategy } from './StopStrategy';
import { ForexCalculator } from './calculators/ForexCalculator';
import { CryptoCalculator } from './calculators/CryptoCalculator';
import { CommodityCalculator } from './calculators/CommodityCalculator';
import { SignalDirection } from '@trading/shared';

export class RiskManager {
  private readonly stopStrategy: ATRStopStrategy;
  private readonly forexCalc    = new ForexCalculator();
  private readonly cryptoCalc   = new CryptoCalculator();
  private readonly commodityCalc = new CommodityCalculator();

  constructor(private readonly params: RiskParams) {
    this.stopStrategy = new ATRStopStrategy(1.5);
  }

  /**
   * Calculate entry, stop-loss, take-profit and position size for a signal.
   *
   * SL = ATR-based (multiplier × ATR14 from entry)
   * TP = SL distance × defaultRR (Risk/Reward ratio)
   * Position size = instrument-specific calculator
   */
  calculatePosition(
    spec:          InstrumentSpec,
    direction:     SignalDirection,
    currentPrice:  number,
    atr14:         number,
    atrMultiplier?: number,
  ): PositionSizeResult {
    if (direction === 'NO_SIGNAL') {
      throw new Error('RiskManager.calculatePosition: called with NO_SIGNAL direction');
    }

    const effectiveMultiplier = atrMultiplier ?? 1.5;
    const localStop = new ATRStopStrategy(effectiveMultiplier);

    const stopLoss = localStop.calculateStopLoss(
      direction as 'LONG' | 'SHORT',
      currentPrice,
      atr14,
      spec,
    );

    const stopDistance = Math.abs(currentPrice - stopLoss);
    const tpDistance   = stopDistance * this.params.defaultRR;

    // Round TP to tick size
    const rawTP = direction === 'LONG'
      ? currentPrice + tpDistance
      : currentPrice - tpDistance;
    const takeProfit = parseFloat(
      (Math.round(rawTP / spec.tickSize) * spec.tickSize).toFixed(spec.pricePrecision),
    );

    const calculator = this.getCalculator(spec.assetType);
    return calculator.calculate(
      spec,
      this.params.accountBalance,
      this.params.riskPerTrade,
      currentPrice,
      stopLoss,
      takeProfit,
    );
  }

  /**
   * Validate risk limits before opening a trade.
   * Returns { allowed: true } or { allowed: false, reason: string }.
   */
  async checkRiskLimits(
    currentDailyLoss:     number,  // absolute USD loss today
    currentOpenPositions: number,
    currentDrawdown:      number,  // percentage
  ): Promise<{ allowed: boolean; reason?: string }> {
    if (currentDailyLoss >= this.params.maxDailyLoss) {
      return {
        allowed: false,
        reason:  `Daily loss limit reached: ${currentDailyLoss.toFixed(2)}% >= ${this.params.maxDailyLoss}%`,
      };
    }

    if (currentOpenPositions >= this.params.maxOpenPositions) {
      return {
        allowed: false,
        reason:  `Max open positions reached: ${currentOpenPositions} >= ${this.params.maxOpenPositions}`,
      };
    }

    if (currentDrawdown >= this.params.maxDrawdown) {
      return {
        allowed: false,
        reason:  `Max drawdown reached: ${currentDrawdown.toFixed(2)}% >= ${this.params.maxDrawdown}%`,
      };
    }

    return { allowed: true };
  }

  // ── Internal ─────────────────────────────────────────────

  private getCalculator(
    assetType: string,
  ): ForexCalculator | CryptoCalculator | CommodityCalculator {
    switch (assetType) {
      case 'FOREX':
        return this.forexCalc;
      case 'CRYPTO':
        return this.cryptoCalc;
      case 'COMMODITY':
      case 'INDEX':
        return this.commodityCalc;
      default:
        // Fallback: crypto-style (simple risk/stopDistance)
        return this.cryptoCalc;
    }
  }
}
