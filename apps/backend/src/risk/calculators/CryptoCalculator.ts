// ============================================================
// Crypto Position Size Calculator
// ============================================================
import { InstrumentSpec, PositionSizeResult } from '../types';

/**
 * Calculates position size for CRYPTO instruments in base currency units.
 *
 * Formula:
 *   riskAmount   = balance * riskPercent / 100
 *   stopDistance = |entry - stopLoss|  (in quote currency per base unit)
 *   positionSize = riskAmount / stopDistance
 *
 * Result is the number of base currency units (e.g. BTC, ETH).
 * Rounded to quantityPrecision, enforces minimumOrderSize.
 */
export class CryptoCalculator {
  calculate(
    spec: InstrumentSpec,
    accountBalance: number,
    riskPercent: number,
    entryPrice: number,
    stopLossPrice: number,
    takeProfitPrice: number,
  ): PositionSizeResult {
    const riskAmount   = accountBalance * (riskPercent / 100);
    const stopDistance = Math.abs(entryPrice - stopLossPrice);
    const tpDistance   = Math.abs(takeProfitPrice - entryPrice);

    if (stopDistance === 0) {
      throw new Error('CryptoCalculator: stop distance is zero');
    }

    let positionSize = riskAmount / stopDistance;

    // Round to quantity precision
    positionSize = parseFloat(positionSize.toFixed(spec.quantityPrecision));

    // Enforce minimum order size
    positionSize = Math.max(positionSize, spec.minimumOrderSize);

    // Recalculate actual risk after rounding
    const actualRiskAmount = positionSize * stopDistance;
    const riskReward       = tpDistance / stopDistance;

    return {
      positionSize,
      riskAmount:         actualRiskAmount,
      stopDistance,
      takeProfitDistance: tpDistance,
      riskReward:         parseFloat(riskReward.toFixed(4)),
      stopLoss:           stopLossPrice,
      takeProfit:         takeProfitPrice,
      entry:              entryPrice,
    };
  }
}
