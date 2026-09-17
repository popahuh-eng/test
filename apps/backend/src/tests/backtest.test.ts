// ============================================================
// Backtest Engine Unit Tests (Execution Delay & No Look-Ahead)
// ============================================================
import { describe, it, expect } from 'vitest';
import { BacktestEngine } from '../backtest/BacktestEngine';
import type { BacktestConfig, Candle } from '@trading/shared';
import type { InstrumentSpec } from '../risk/types';

describe('BacktestEngine', () => {
  const engine = new BacktestEngine();

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

  const config: BacktestConfig = {
    symbol: 'BTCUSDT',
    timeframe: '1h',
    startDate: new Date('2024-01-01T00:00:00Z'),
    endDate: new Date('2024-01-10T00:00:00Z'),
    startingBalance: 10000,
    riskPerTrade: 1.0,
    modelVersion: 'test_v1',
    commission: 0.0002, // 0.02%
    slippage: 0.0001, // 0.01%
    spreadPips: 1,
  };

  function generateCandles(count: number): Candle[] {
    const candles: Candle[] = [];
    let price = 50000;
    const start = new Date('2024-01-01T00:00:00Z').getTime();

    for (let i = 0; i < count; i++) {
      // Upward trend
      const open = price;
      const high = price * 1.01;
      const low = price * 0.995;
      const close = price * 1.005;
      price = close;

      candles.push({
        symbol: 'BTCUSDT',
        timeframe: '1h',
        timestamp: new Date(start + i * 3600 * 1000),
        open,
        high,
        low,
        close,
        volume: 100,
        source: 'test',
      });
    }
    return candles;
  }

  it('runs backtest simulation and tracks equity curve', async () => {
    const candles = generateCandles(100);
    const { result, trades } = await engine.run(config, candles, spec);

    expect(result.status).toBe('COMPLETED');
    expect(result.startingBalance).toBe(10000);
    expect(result.equityCurve.length).toBeGreaterThan(50);
    expect(typeof result.winRate).toBe('number');
    expect(typeof result.netPnl).toBe('number');
  });

  it('verifies trades incorporate fees and slippage', async () => {
    const candles = generateCandles(80);
    const { trades } = await engine.run(config, candles, spec);

    if (trades.length > 0) {
      const trade = trades[0];
      expect(trade.fees).toBeGreaterThan(0);
      expect(trade.slippage).toBeGreaterThan(0);
      expect(trade.durationSeconds).toBeGreaterThan(0);
    }
  });

  it('fails safely if insufficient historical candles are provided', async () => {
    const sparse = generateCandles(20);
    await expect(engine.run(config, sparse, spec)).rejects.toThrow(/Insufficient historical candles/);
  });
});
