// ============================================================
// Risk Manager & Sizing Tests
// ============================================================
import { describe, it, expect } from 'vitest';
import { RiskManager } from '../risk/RiskManager';
import { CryptoCalculator } from '../risk/calculators/CryptoCalculator';
import { ForexCalculator } from '../risk/calculators/ForexCalculator';
import { CommodityCalculator } from '../risk/calculators/CommodityCalculator';
import type { InstrumentSpec } from '../risk/types';

describe('CryptoCalculator', () => {
  const spec: InstrumentSpec = {
    symbol: 'BTCUSDT',
    assetType: 'CRYPTO',
    pricePrecision: 2,
    quantityPrecision: 4,
    tickSize: 0.01,
    lotSize: 0.0001,
    contractSize: 1,
    minimumOrderSize: 0.001,
  };

  it('calculates position size based on risk amount and stop distance', () => {
    const calc = new CryptoCalculator();
    // Balance $10,000, 1% risk = $100 risk amount
    // Entry $60,000, SL $58,000 -> stop distance $2,000
    // Position size = $100 / $2,000 = 0.05 BTC
    const res = calc.calculate(spec, 10000, 1.0, 60000, 58000, 64000);

    expect(res.positionSize).toBeCloseTo(0.05, 3);
    expect(res.riskAmount).toBeCloseTo(100, 1);
    expect(res.riskReward).toBeCloseTo(2.0, 1);
    expect(res.stopLoss).toBe(58000);
    expect(res.takeProfit).toBe(64000);
  });

  it('enforces minimum order size constraint', () => {
    const calc = new CryptoCalculator();
    // Very tiny balance $100, 1% risk = $1 risk amount
    // Stop distance $2,000 -> raw size = 0.0005 BTC < 0.001 min size
    const res = calc.calculate(spec, 100, 1.0, 60000, 58000, 64000);
    expect(res.positionSize).toBe(spec.minimumOrderSize);
  });
});

describe('CommodityCalculator (XAU/USD Gold)', () => {
  const goldSpec: InstrumentSpec = {
    symbol: 'XAUUSD',
    assetType: 'COMMODITY',
    pricePrecision: 2,
    quantityPrecision: 2,
    tickSize: 0.01,
    lotSize: 0.01,
    contractSize: 100, // 100 oz per lot
    minimumOrderSize: 0.01,
  };

  it('calculates gold lot sizing correctly', () => {
    const calc = new CommodityCalculator();
    // Balance $10,000, 1% risk = $100
    // Entry 2400, SL 2380 -> distance $20
    // 1 standard lot (100 oz) loses $2,000 on $20 move
    // $100 risk / ($20 * 100) = 0.05 lots
    const res = calc.calculate(goldSpec, 10000, 1.0, 2400, 2380, 2440);
    expect(res.positionSize).toBeCloseTo(0.05, 2);
    expect(res.riskReward).toBeCloseTo(2.0, 1);
  });
});

describe('ForexCalculator (EUR/USD)', () => {
  const eurusdSpec: InstrumentSpec = {
    symbol: 'EURUSD',
    assetType: 'FOREX',
    pricePrecision: 5,
    quantityPrecision: 2,
    tickSize: 0.00001,
    lotSize: 0.01,
    contractSize: 100000, // standard lot = 100,000 EUR
    minimumOrderSize: 0.01,
  };

  it('calculates forex lot sizing and pip value correctly', () => {
    const calc = new ForexCalculator();
    // Balance $10,000, 1% risk = $100
    // Entry 1.08000, SL 1.07500 -> distance 50 pips (0.00500)
    // 1 lot loses $500 on 50 pips ($10/pip)
    // $100 risk / $500 = 0.20 lots
    const res = calc.calculate(eurusdSpec, 10000, 1.0, 1.08000, 1.07500, 1.09000);
    expect(res.positionSize).toBeCloseTo(0.20, 2);
    expect(res.riskReward).toBeCloseTo(2.0, 1);
  });
});

describe('RiskManager Limits & Checks', () => {
  const riskManager = new RiskManager({
    accountBalance: 10000,
    riskPerTrade: 1.0,
    maxDailyLoss: 5.0,
    maxOpenPositions: 3,
    maxDrawdown: 15.0,
    defaultRR: 2.0,
  });

  it('approves trades within normal limits', async () => {
    const check = await riskManager.checkRiskLimits(1.5, 1, 3.0);
    expect(check.allowed).toBe(true);
  });

  it('rejects trades if daily loss limit exceeded', async () => {
    const check = await riskManager.checkRiskLimits(5.2, 1, 3.0);
    expect(check.allowed).toBe(false);
    expect(check.reason).toContain('Daily loss limit');
  });

  it('rejects trades if max open positions exceeded', async () => {
    const check = await riskManager.checkRiskLimits(1.0, 3, 2.0);
    expect(check.allowed).toBe(false);
    expect(check.reason).toContain('Max open positions');
  });
});
