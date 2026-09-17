// ============================================================
// Forex Position Size Calculator
// ============================================================
import { InstrumentSpec, PositionSizeResult } from '../types';

/**
 * Calculates position size for FOREX instruments in lots.
 *
 * Formula:
 *   riskAmount    = balance * riskPercent / 100
 *   stopDistancePips = |entry - stopLoss| / tickSize
 *   pipValuePerLot   = tickSize * contractSize          (quote == USD)
 *                    = (tickSize / price) * contractSize (quote != USD)
 *   positionSize  = riskAmount / (stopDistancePips * pipValuePerLot)
 *
 * Rounds to quantityPrecision and enforces minimumOrderSize.
 */
export class ForexCalculator {
  calculate(
    spec: InstrumentSpec,
    accountBalance: number,
    riskPercent: number,
    entryPrice: number,
    stopLossPrice: number,
    takeProfitPrice: number,
  ): PositionSizeResult {
    const riskAmount     = accountBalance * (riskPercent / 100);
    const stopDistance   = Math.abs(entryPrice - stopLossPrice);
    const tpDistance     = Math.abs(takeProfitPrice - entryPrice);

    if (stopDistance === 0) {
      throw new Error('ForexCalculator: stop distance is zero');
    }

    // Pips: distance expressed in tick units
    const stopPips = stopDistance / spec.tickSize;
    const tpPips   = tpDistance   / spec.tickSize;

    // Pip value per lot (assume account currency = USD / quote currency)
    // For EURUSD: 1 pip = tickSize * contractSize * (1 lot)
    // For others quoted in non-USD: convert via price
    const isQuoteCurrencyUSD = spec.symbol.endsWith('USD') || spec.symbol.endsWith('USDT');
    const pipValuePerLot = isQuoteCurrencyUSD
      ? spec.tickSize * spec.contractSize
      : (spec.tickSize / entryPrice) * spec.contractSize;

    let positionSize = riskAmount / (stopPips * pipValuePerLot);

    // Round to quantity precision
    positionSize = parseFloat(positionSize.toFixed(spec.quantityPrecision));

    // Enforce minimum
    positionSize = Math.max(positionSize, spec.minimumOrderSize);

    // Actual risk after rounding
    const actualRiskAmount = positionSize * stopPips * pipValuePerLot;
    const riskReward       = stopDistance > 0 ? tpDistance / stopDistance : 0;

    return {
      positionSize,
      riskAmount:          actualRiskAmount,
      stopDistance,
      takeProfitDistance:  tpDistance,
      riskReward:          parseFloat(riskReward.toFixed(4)),
      stopLoss:            stopLossPrice,
      takeProfit:          takeProfitPrice,
      entry:               entryPrice,
    };
  }
}
