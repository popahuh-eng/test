// ============================================================
// Twelve Data Market Data Provider
// Reads TWELVE_DATA_API_KEY from env.
// ============================================================
import { MarketDataProvider, ProviderStatus } from '../types';
import { Candle, Timeframe } from '@trading/shared';
import { logger } from '../../services/logger';

interface TwelveDataValue {
  datetime: string;
  open: string;
  high: string;
  low: string;
  close: string;
  volume: string;
}

interface TwelveDataResponse {
  status?: string;
  code?: number;
  message?: string;
  meta?: {
    symbol: string;
    interval: string;
    exchange_timezone: string;
  };
  values?: TwelveDataValue[];
}

export class TwelveDataProvider implements MarketDataProvider {
  readonly name = 'twelvedata';
  private readonly apiKey: string | null;
  private readonly baseUrl = 'https://api.twelvedata.com';

  // Timeframe mapping: shared → twelvedata
  private readonly intervalMap: Record<Timeframe, string> = {
    '1m':  '1min',
    '5m':  '5min',
    '15m': '15min',
    '1h':  '1h',
    '4h':  '4h',
    '1d':  '1day',
  };

  constructor() {
    this.apiKey = process.env.TWELVE_DATA_API_KEY ?? null;
  }

  async isAvailable(): Promise<boolean> {
    if (!this.apiKey) return false;
    try {
      const status = await this.getStatus();
      return status.status !== 'OFFLINE' && status.status !== 'UNAVAILABLE';
    } catch {
      return false;
    }
  }

  async fetchCandles(
    symbol: string,
    timeframe: Timeframe,
    from: Date,
    to: Date,
  ): Promise<Candle[]> {
    if (!this.apiKey) {
      throw new Error('TwelveDataProvider: TWELVE_DATA_API_KEY not set');
    }

    const interval = this.intervalMap[timeframe];
    const params   = new URLSearchParams({
      symbol,
      interval,
      start_date: this.formatDate(from),
      end_date:   this.formatDate(to),
      outputsize: '5000',
      apikey:     this.apiKey,
    });

    const data = await this.fetchWithRetry<TwelveDataResponse>(
      `${this.baseUrl}/time_series?${params.toString()}`,
    );

    if (data.status === 'error' || !data.values) {
      logger.warn(
        { event: 'twelvedata_error', code: data.code, message: data.message, symbol, timeframe },
        'TwelveData returned error',
      );
      return [];
    }

    // TwelveData returns newest-first; reverse to oldest-first
    const values = [...(data.values ?? [])].reverse();

    return values.map((v): Candle => ({
      timestamp: new Date(v.datetime),
      open:      parseFloat(v.open),
      high:      parseFloat(v.high),
      low:       parseFloat(v.low),
      close:     parseFloat(v.close),
      volume:    parseFloat(v.volume) || 0,
      symbol,
      timeframe,
      source:    'twelvedata',
    }));
  }

  async fetchLatestCandle(symbol: string, timeframe: Timeframe): Promise<Candle | null> {
    const now  = new Date();
    const from = new Date(now.getTime() - this.getTimeframeMs(timeframe) * 3);
    const candles = await this.fetchCandles(symbol, timeframe, from, now);
    return candles.length > 0 ? candles[candles.length - 1] : null;
  }

  async getStatus(): Promise<{ status: ProviderStatus; message: string }> {
    if (!this.apiKey) {
      return { status: 'UNAVAILABLE', message: 'TWELVE_DATA_API_KEY not configured' };
    }
    try {
      const params = new URLSearchParams({ apikey: this.apiKey });
      const res    = await fetch(`${this.baseUrl}/api_usage?${params.toString()}`);
      if (res.ok) {
        return { status: 'ONLINE', message: 'TwelveData API reachable' };
      }
      if (res.status === 429) {
        return { status: 'DEGRADED', message: 'Rate limited by TwelveData' };
      }
      return { status: 'OFFLINE', message: `HTTP ${res.status}` };
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : String(err);
      return { status: 'OFFLINE', message: `Connection error: ${msg}` };
    }
  }

  // ── Helpers ──────────────────────────────────────────────

  private async fetchWithRetry<T>(url: string, maxRetries = 3): Promise<T> {
    let lastError: Error = new Error('Unknown error');
    for (let attempt = 0; attempt < maxRetries; attempt++) {
      if (attempt > 0) {
        const delayMs = Math.min(2000 * Math.pow(2, attempt - 1), 16_000);
        await this.sleep(delayMs);
      }
      try {
        const res = await fetch(url);
        if (res.status === 429) {
          logger.warn({ event: 'twelvedata_rate_limit', attempt }, 'Rate limited, retrying…');
          lastError = new Error('Rate limited (429)');
          continue;
        }
        if (!res.ok) {
          throw new Error(`HTTP ${res.status}: ${res.statusText}`);
        }
        return (await res.json()) as T;
      } catch (err: unknown) {
        lastError = err instanceof Error ? err : new Error(String(err));
        logger.warn({ event: 'twelvedata_fetch_error', attempt, err: lastError.message }, 'Fetch error');
      }
    }
    throw lastError;
  }

  private formatDate(date: Date): string {
    // TwelveData expects: YYYY-MM-DD HH:MM:SS
    const pad = (n: number) => String(n).padStart(2, '0');
    return (
      `${date.getUTCFullYear()}-${pad(date.getUTCMonth() + 1)}-${pad(date.getUTCDate())} ` +
      `${pad(date.getUTCHours())}:${pad(date.getUTCMinutes())}:${pad(date.getUTCSeconds())}`
    );
  }

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

  private sleep(ms: number): Promise<void> {
    return new Promise((resolve) => setTimeout(resolve, ms));
  }
}
