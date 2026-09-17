// ============================================================
// Provider Abstraction Interfaces — Trading Signal Platform
// ============================================================
import { Candle, Timeframe, NewsItem, SocialPost, MacroEvent } from '@trading/shared';

export type ProviderStatus = 'ONLINE' | 'DEGRADED' | 'OFFLINE' | 'UNAVAILABLE';

export interface MarketDataProvider {
  name: string;
  isAvailable(): Promise<boolean>;
  fetchCandles(
    symbol: string,
    timeframe: Timeframe,
    from: Date,
    to: Date
  ): Promise<Candle[]>;
  fetchLatestCandle(symbol: string, timeframe: Timeframe): Promise<Candle | null>;
  getStatus(): Promise<{ status: ProviderStatus; message: string }>;
}

export interface NewsProvider {
  name: string;
  isAvailable(): Promise<boolean>;
  fetchNews(
    symbols: string[],
    from: Date,
    to: Date,
    limit?: number
  ): Promise<NewsItem[]>;
  getStatus(): Promise<{ status: ProviderStatus; message: string }>;
}

export interface SocialProvider {
  name: string;
  isAvailable(): Promise<boolean>;
  fetchPosts(
    keywords: string[],
    from: Date,
    to: Date,
    limit?: number
  ): Promise<SocialPost[]>;
  getStatus(): Promise<{ status: ProviderStatus; message: string }>;
}

export interface MacroProvider {
  name: string;
  isAvailable(): Promise<boolean>;
  fetchEvents(
    currencies: string[],
    from: Date,
    to: Date
  ): Promise<MacroEvent[]>;
  getStatus(): Promise<{ status: ProviderStatus; message: string }>;
}
