// ============================================================
// Demo Market Data Provider — Synthetic OHLCV via GBM
// CLEARLY MARKED AS DEMO — never mixed with real data.
// ============================================================
import { MarketDataProvider, ProviderStatus } from '../types';
import { Candle, Timeframe } from '@trading/shared';

/**
 * Demo provider generates synthetic OHLCV data using geometric Brownian motion.
 * Used when MARKET_DATA_PROVIDER=demo or when real provider API key is missing.
 * All candles produced by this provider have source='demo' and isDemo=true.
 */
export class DemoMarketDataProvider implements MarketDataProvider {
  readonly name = 'demo';

  // Base prices for instruments (approximate current values)
  private readonly basePrices: Record<string, number> = {
    XAUUSD:  3341.00,
    BTCUSDT: 67000.00,
    ETHUSDT: 3200.00,
    EURUSD:  1.0850,
  };

  // Annualised daily volatility for GBM
  private readonly volatility: Record<string, number> = {
    XAUUSD:  0.008,
    BTCUSDT: 0.025,
    ETHUSDT: 0.030,
    EURUSD:  0.004,
  };

  async isAvailable(): Promise<boolean> {
    return true; // Demo is always available
  }

  async fetchCandles(
    symbol: string,
    timeframe: Timeframe,
    from: Date,
    to: Date,
  ): Promise<Candle[]> {
    const tfMs       = this.getTimeframeMs(timeframe);
    const startMs    = Math.ceil(from.getTime() / tfMs) * tfMs;
    const endMs      = Math.floor(to.getTime() / tfMs) * tfMs;
    const basePrice  = this.basePrices[symbol] ?? 1000.0;
    const vol        = this.volatility[symbol]  ?? 0.01;

    // Number of candles in range
    const n = Math.max(0, Math.floor((endMs - startMs) / tfMs) + 1);
    if (n === 0) return [];

    // Seed uses symbol + timeframe + start date for reproducibility
    const seed = this.makeSeed(symbol, timeframe, startMs);

    // dt = timeframe as fraction of a trading day (6.5 h for FX/equity, 24 h crypto)
    const tradingHoursPerDay = symbol === 'BTCUSDT' || symbol === 'ETHUSDT' ? 24 : 6.5;
    const dt = tfMs / (tradingHoursPerDay * 3_600_000);

    // Generate n+1 prices so we can derive n candles
    const prices = this.generateGBM(basePrice, vol, n + 1, seed, dt);

    const candles: Candle[] = [];
    for (let i = 0; i < n; i++) {
      const open  = prices[i];
      const close = prices[i + 1];

      // Intra-candle high/low via seeded jitter (± 0.5 * vol * sqrt(dt) * open)
      const rng       = this.lcgRandom(seed + i * 31337);
      const jitter    = Math.abs(rng.next()) * vol * Math.sqrt(dt) * open;
      const high      = Math.max(open, close) + jitter * 0.5;
      const low       = Math.min(open, close) - jitter * 0.5;

      // Volume: synthetic, proportional to price and volatility
      const volRng    = this.lcgRandom(seed + i * 99991 + 7);
      const volume    = Math.abs(volRng.next()) * basePrice * 10 + basePrice;

      candles.push({
        timestamp: new Date(startMs + i * tfMs),
        open:      parseFloat(open.toFixed(this.getPricePrecision(symbol))),
        high:      parseFloat(high.toFixed(this.getPricePrecision(symbol))),
        low:       parseFloat(low.toFixed(this.getPricePrecision(symbol))),
        close:     parseFloat(close.toFixed(this.getPricePrecision(symbol))),
        volume:    parseFloat(volume.toFixed(2)),
        symbol,
        timeframe,
        source:    'demo',
      });
    }
    return candles;
  }

  async fetchLatestCandle(symbol: string, timeframe: Timeframe): Promise<Candle | null> {
    const now  = new Date();
    const from = new Date(now.getTime() - this.getTimeframeMs(timeframe) * 2);
    const candles = await this.fetchCandles(symbol, timeframe, from, now);
    return candles.length > 0 ? candles[candles.length - 1] : null;
  }

  async getStatus(): Promise<{ status: ProviderStatus; message: string }> {
    return { status: 'ONLINE', message: 'Demo mode — synthetic OHLCV data only' };
  }

  // ── Internal helpers ────────────────────────────────────────

  private getTimeframeMs(timeframe: Timeframe): number {
    const map: Record<Timeframe, number> = {
      '1m':  60_000,
      '5m':  300_000,
      '15m': 900_000,
      '1h':  3_600_000,
      '4h':  14_400_000,
      '1d':  86_400_000,
    };
    return map[timeframe];
  }

  private getPricePrecision(symbol: string): number {
    const map: Record<string, number> = {
      XAUUSD:  2,
      BTCUSDT: 2,
      ETHUSDT: 2,
      EURUSD:  5,
    };
    return map[symbol] ?? 4;
  }

  private makeSeed(symbol: string, timeframe: string, startMs: number): number {
    // Simple hash of symbol+timeframe+date bucket
    let h = 2166136261;
    const str = `${symbol}:${timeframe}:${Math.floor(startMs / 86_400_000)}`;
    for (let i = 0; i < str.length; i++) {
      h ^= str.charCodeAt(i);
      h = Math.imul(h, 16777619);
    }
    return h >>> 0;
  }

  /**
   * Linear congruential generator returning values in (-1, 1).
   * Returns an iterator with .next() method.
   */
  private lcgRandom(seed: number): { next(): number } {
    let state = seed >>> 0;
    return {
      next(): number {
        state = (Math.imul(1664525, state) + 1013904223) >>> 0;
        return (state / 0x80000000) - 1.0; // (-1, 1)
      },
    };
  }

  /**
   * Generate n+1 prices via Geometric Brownian Motion.
   * S(t) = S(t-1) * exp((mu - sigma²/2)*dt + sigma*sqrt(dt)*Z)
   * Z ~ N(0,1) approximated via Box-Muller from LCG uniform samples.
   *
   * @param basePrice   S(0) starting price
   * @param annualVol   annualised volatility (e.g. 0.02 = 2%)
   * @param n           number of steps (returns n+1 prices)
   * @param seed        deterministic seed
   * @param dt          step size as fraction of a year
   */
  private generateGBM(
    basePrice: number,
    annualVol: number,
    n: number,
    seed: number,
    dt: number,
  ): number[] {
    const mu    = 0.0;   // zero drift for neutral demo
    const sigma = annualVol;
    const drift = (mu - 0.5 * sigma * sigma) * dt;
    const rng   = this.lcgRandom(seed);

    const prices: number[] = [basePrice];
    for (let i = 0; i < n; i++) {
      // Box-Muller transform: U1, U2 uniform in (0,1)
      const u1 = 0.5 * (rng.next() + 1.0) + 1e-10;  // (0,1)
      const u2 = 0.5 * (rng.next() + 1.0) + 1e-10;
      const z  = Math.sqrt(-2.0 * Math.log(u1)) * Math.cos(2.0 * Math.PI * u2);

      const prev = prices[prices.length - 1];
      const next = prev * Math.exp(drift + sigma * Math.sqrt(dt) * z);
      prices.push(Math.max(next, prev * 0.001)); // floor to prevent zero/negative
    }
    return prices;
  }
}
