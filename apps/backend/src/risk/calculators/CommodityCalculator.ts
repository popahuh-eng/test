// ============================================================
// Commodity Position Size Calculator (XAU/USD — Gold)
// ============================================================
import { InstrumentSpec, PositionSizeResult } from '../types';

/**
 * Calculates position size for commodity instruments (primarily XAU/USD).
 *
 * Gold convention:
 *   contractSize = 100 troy oz per standard lot
 *   position size expressed in standard lots
 *
 * Formula:
 *   riskAmount   = balance * riskPercent / 100
 *   stopDistance = |entry - stopLoss|  (USD per troy oz)
 *   positionSize = riskAmount / (stopDistance * contractSize) (lots)
 */
export class CommodityCalculator {
  calculate(
    spec: InstrumentSpec,
    accountBalance: number,
    riskPercent: number,
    entryPrice: number,
    stopLossPrice: number,
    takeProfitPrice: number,
  ): PositionSizeResult {
    const riskAmount = accountBalance * (riskPercent / 100);
    const stopDistance = Math.abs(entryPrice - stopLossPrice); // USD/oz
    const tpDistance = Math.abs(takeProfitPrice - entryPrice);

    if (stopDistance === 0) {
      throw new Error('CommodityCalculator: stop distance is zero');
    }

    const contractSize = spec.contractSize || 100;
    // Position size in standard lots
    let positionSize = riskAmount / (stopDistance * contractSize);

    // Enforce minimum
    positionSize = Math.max(positionSize, spec.minimumOrderSize);

    // Round to quantity precision
    positionSize = parseFloat(positionSize.toFixed(spec.quantityPrecision));

    const actualRiskAmount = positionSize * stopDistance * contractSize;
    const riskReward = tpDistance / stopDistance;

    return {
      positionSize,
      riskAmount: actualRiskAmount,
      stopDistance,
      takeProfitDistance: tpDistance,
      riskReward: parseFloat(riskReward.toFixed(4)),
      stopLoss: stopLossPrice,
      takeProfit: takeProfitPrice,
      entry: entryPrice,
    };
  }
}
