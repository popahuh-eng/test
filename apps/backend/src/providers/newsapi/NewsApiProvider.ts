// ============================================================
// NewsAPI.org News Provider
// Reads NEWS_API_KEY from env.
// ============================================================
import { createHash, randomUUID } from 'crypto';
import { NewsProvider, ProviderStatus } from '../types';
import { NewsItem } from '@trading/shared';
import { FinancialNLP } from '../../services/nlp';
import { logger } from '../../services/logger';

interface NewsApiArticle {
  source:      { id: string | null; name: string };
  author:      string | null;
  title:       string;
  description: string | null;
  url:         string;
  publishedAt: string;
  content:     string | null;
}

interface NewsApiResponse {
  status:       string;
  totalResults: number;
  articles:     NewsApiArticle[];
  code?:        string;
  message?:     string;
}

// Keyword sets used to build search queries per symbol
const SYMBOL_QUERIES: Record<string, string> = {
  XAUUSD:  'gold OR XAU OR bullion OR "safe haven"',
  BTCUSDT: 'bitcoin OR BTC OR cryptocurrency',
  ETHUSDT: 'ethereum OR ETH OR DeFi',
  EURUSD:  'euro OR EUR/USD OR ECB OR eurozone',
};

export class NewsApiProvider implements NewsProvider {
  readonly name = 'newsapi';
  private readonly apiKey: string | null;
  private readonly baseUrl = 'https://newsapi.org/v2/everything';
  private readonly nlp = new FinancialNLP();

  constructor() {
    this.apiKey = process.env.NEWS_API_KEY ?? null;
  }

  async isAvailable(): Promise<boolean> {
    if (!this.apiKey) return false;
    const status = await this.getStatus();
    return status.status !== 'OFFLINE' && status.status !== 'UNAVAILABLE';
  }

  async fetchNews(
    symbols: string[],
    from: Date,
    to: Date,
    limit = 50,
  ): Promise<NewsItem[]> {
    if (!this.apiKey) {
      throw new Error('NewsApiProvider: NEWS_API_KEY not set');
    }

    const perSymbol = Math.ceil(limit / Math.max(symbols.length, 1));
    const seen      = new Set<string>(); // URL-based dedup
    const results:  NewsItem[] = [];

    for (const symbol of symbols) {
      const query = SYMBOL_QUERIES[symbol] ?? symbol;
      const params = new URLSearchParams({
        q:           query,
        from:        from.toISOString(),
        to:          to.toISOString(),
        language:    'en',
        sortBy:      'publishedAt',
        pageSize:    String(Math.min(perSymbol, 100)), // NewsAPI max
        apiKey:      this.apiKey,
      });

      let data: NewsApiResponse;
      try {
        const res = await fetch(`${this.baseUrl}?${params.toString()}`);
        data = (await res.json()) as NewsApiResponse;
      } catch (err: unknown) {
        const msg = err instanceof Error ? err.message : String(err);
        logger.warn({ event: 'newsapi_fetch_error', symbol, err: msg }, 'NewsAPI fetch failed');
        continue;
      }

      if (data.status !== 'ok' || !data.articles) {
        logger.warn(
          { event: 'newsapi_error', code: data.code, message: data.message, symbol },
          'NewsAPI returned error',
        );
        continue;
      }

      for (const article of data.articles) {
        // Dedup by URL hash
        const urlHash = createHash('md5').update(article.url ?? '').digest('hex');
        if (seen.has(urlHash)) continue;
        seen.add(urlHash);

        const fullText   = [article.title, article.description, article.content].join(' ');
        const sentiment  = this.nlp.computeSentiment(fullText);
        const relevance  = this.nlp.computeRelevance(fullText, symbol);
        const impact     = this.nlp.computeImpact(fullText, article.source.name, sentiment, relevance);

        results.push({
          id:          randomUUID(),
          timestamp:   new Date(article.publishedAt),
          source:      article.source.name,
          title:       article.title,
          summary:     article.description ?? '',
          url:         article.url,
          language:    'en',
          symbols:     [symbol],
          topics:      [],
          sentiment,
          relevance,
          impactScore: impact,
        });
      }
    }

    // Sort by descending timestamp, then limit
    results.sort((a, b) => b.timestamp.getTime() - a.timestamp.getTime());
    return results.slice(0, limit);
  }

  async getStatus(): Promise<{ status: ProviderStatus; message: string }> {
    if (!this.apiKey) {
      return { status: 'UNAVAILABLE', message: 'NEWS_API_KEY not configured' };
    }
    // Probe with minimal request
    try {
      const params = new URLSearchParams({
        q:        'gold',
        pageSize: '1',
        apiKey:   this.apiKey,
      });
      const res = await fetch(`${this.baseUrl}?${params.toString()}`);
      if (res.ok) return { status: 'ONLINE', message: 'NewsAPI reachable' };
      if (res.status === 429) return { status: 'DEGRADED', message: 'Rate limited' };
      if (res.status === 401) return { status: 'UNAVAILABLE', message: 'Invalid API key' };
      return { status: 'OFFLINE', message: `HTTP ${res.status}` };
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : String(err);
      return { status: 'OFFLINE', message: `Connection error: ${msg}` };
    }
  }
}
