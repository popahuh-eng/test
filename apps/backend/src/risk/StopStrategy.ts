// ============================================================
// ATR-based Stop Strategy
// ============================================================
import { InstrumentSpec } from './types';

export interface StopStrategy {
  calculateStopLoss(
    direction: 'LONG' | 'SHORT',
    entryPrice: number,
    atr14: number,
    spec: InstrumentSpec,
  ): number;
}

/**
 * ATR stop-loss strategy.
 * SL distance = ATR14 * multiplier
 * Price rounded to instrument tick size.
 */
export class ATRStopStrategy implements StopStrategy {
  constructor(private readonly multiplier: number = 1.5) {}

  calculateStopLoss(
    direction: 'LONG' | 'SHORT',
    entryPrice: number,
    atr14: number,
    spec: InstrumentSpec,
  ): number {
    const distance = atr14 * this.multiplier;
    const rawSL    = direction === 'LONG'
      ? entryPrice - distance
      : entryPrice + distance;
    return this.roundToTickSize(rawSL, spec.tickSize, spec.pricePrecision);
  }

  private roundToTickSize(price: number, tickSize: number, precision: number): number {
    if (tickSize <= 0) return parseFloat(price.toFixed(precision));
    return parseFloat((Math.round(price / tickSize) * tickSize).toFixed(precision));
  }
}
