// ============================================================
// Signal Engine Unit Tests
// ============================================================
import { describe, it, expect } from 'vitest';
import { SignalEngine } from '../signal/SignalEngine';
import type { SignalInput } from '../signal/types';

describe('SignalEngine', () => {
  const engine = new SignalEngine({
    minConfidence: 0.70,
    minRR: 2.0,
    signalCooldownMinutes: 60,
    maxSignalsPerSymbolPerHour: 2,
  });

  const baseInput: SignalInput = {
    symbol: 'XAUUSD',
    timeframe: '1h',
    timestamp: new Date('2024-01-01T12:00:00Z'),
    probabilityUp: 0.75,
    probabilityDown: 0.25,
    probabilityNeutral: 0.0,
    confidence: 0.78,
    expectedVolatility: 0.01,
    marketRegime: 'TREND_UP',
    currentPrice: 2050.0,
    atr14: 15.0,
    rsi14: 58.0,
    trendDirection: 1,
    adx14: 30.0,
    macdHistogram: 0.4,
    newsSentiment: 0.45,
    socialSentiment: 0.2,
    dataQualityOk: true,
    candleCount: 300,
  };

  it('generates LONG signal when probability up and confidence exceed thresholds', () => {
    const res = engine.evaluate(baseInput);
    expect(res.direction).toBe('LONG');
    expect(res.reasonCodes).toContain('MOMENTUM_CONFIRMED');
    expect(res.reasonCodes).toContain('REGIME_ALIGNED');
    expect(res.reasonCodes).toContain('NEWS_POSITIVE');
    expect(res.filterRejectReasons.length).toBe(0);
  });

  it('generates SHORT signal when probability down and regime align', () => {
    const shortInput: SignalInput = {
      ...baseInput,
      probabilityUp: 0.22,
      probabilityDown: 0.78,
      marketRegime: 'TREND_DOWN',
      rsi14: 42.0,
      trendDirection: -1,
      macdHistogram: -0.4,
      newsSentiment: -0.35,
    };
    const res = engine.evaluate(shortInput);
    expect(res.direction).toBe('SHORT');
    expect(res.reasonCodes).toContain('MOMENTUM_CONFIRMED');
    expect(res.reasonCodes).toContain('REGIME_ALIGNED');
    expect(res.reasonCodes).toContain('NEWS_NEGATIVE');
  });

  it('rejects signal if confidence is below minimum threshold', () => {
    const lowConfInput: SignalInput = {
      ...baseInput,
      confidence: 0.62, // < 0.70 threshold
    };
    const res = engine.evaluate(lowConfInput);
    expect(res.direction).toBe('NO_SIGNAL');
    expect(res.filterRejectReasons.some((r) => r.includes('CONFIDENCE_TOO_LOW'))).toBe(true);
  });

  it('rejects signal if data quality health check failed', () => {
    const badDataInput: SignalInput = {
      ...baseInput,
      dataQualityOk: false,
    };
    const res = engine.evaluate(badDataInput);
    expect(res.direction).toBe('NO_SIGNAL');
    expect(res.filterRejectReasons).toContain('DATA_QUALITY_FAILED');
  });

  it('rejects signal if insufficient candles in history', () => {
    const sparseInput: SignalInput = {
      ...baseInput,
      candleCount: 45, // < 200 required
    };
    const res = engine.evaluate(sparseInput);
    expect(res.direction).toBe('NO_SIGNAL');
    expect(res.filterRejectReasons).toContain('INSUFFICIENT_CANDLES');
  });
});
