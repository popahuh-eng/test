// ============================================================
// Demo News Provider — Synthetic financial news with sentiment
// CLEARLY MARKED AS DEMO — never mixed with real news data.
// ============================================================
import { randomUUID } from 'crypto';
import { NewsProvider, ProviderStatus } from '../types';
import { NewsItem } from '@trading/shared';
import { FinancialNLP } from '../../services/nlp';

/**
 * Generates plausible synthetic financial headlines for demo/testing.
 * All items produced have source='demo' and are clearly marked.
 */
export class DemoNewsProvider implements NewsProvider {
  readonly name = 'demo';

  private readonly nlp = new FinancialNLP();

  private readonly headlines: Record<string, string[]> = {
    XAUUSD: [
      'Gold prices surge amid global uncertainty as safe-haven demand spikes',
      'Bullion rallies to multi-month highs on Fed rate cut expectations',
      'Gold drops on strong dollar; traders eye CPI data ahead',
      'XAU/USD gains momentum as geopolitical tensions boost precious metal appeal',
      'Gold slumps after positive risk sentiment dampens safe-haven demand',
      'Analysts bullish on gold as inflation concerns persist globally',
      'Central banks continue gold accumulation at record pace this quarter',
      'Gold struggles below key resistance amid hawkish Fed commentary',
      'Precious metal prices recover after brief selloff on strong NFP data',
      'Gold set for weekly gain as dollar weakens on mixed economic data',
    ],
    BTCUSDT: [
      'Bitcoin surges past key resistance as institutional buying accelerates',
      'BTC drops sharply on regulatory concerns in major economies',
      'Crypto market rallies after SEC approves new Bitcoin ETF applications',
      'Bitcoin consolidates near all-time highs amid profit-taking pressure',
      'On-chain data shows strong accumulation signal for Bitcoin bulls',
      'Bitcoin falls on renewed fears of exchange liquidity crisis',
      'BTC outperforms traditional assets as halving narrative gains traction',
      'Crypto selloff deepens as macro headwinds pressure risk assets',
      'Bitcoin hash rate reaches record high, bullish signal for long-term holders',
      'Institutional inflows into Bitcoin funds hit monthly record',
    ],
    ETHUSDT: [
      'Ethereum rises on growing DeFi activity and network upgrade expectations',
      'ETH drops as gas fee concerns raise usability questions',
      'Ethereum layer-2 adoption surges, boosting network fundamentals',
      'Smart contract platform faces selling pressure on profit-taking',
      'ETH/USD gains on strong staking yields and decreasing supply',
      'Ethereum developer activity at multi-year high, analysts bullish',
      'DeFi outflows hit ETH as investors rotate to competing blockchains',
      'Ethereum upgrade speculation drives breakout attempt above resistance',
    ],
    EURUSD: [
      'Euro strengthens as ECB signals continued tightening despite growth concerns',
      'EUR/USD slips on weak eurozone PMI data, dollar gains',
      'European Central Bank holds rates; EUR/USD volatile on guidance',
      'Euro rallies as German industrial output beats expectations',
      'EUR/USD declines amid rising energy prices hurting eurozone outlook',
      'ECB President signals openness to rate cuts; euro gives up gains',
      'Euro rises as risk appetite returns to currency markets',
      'EUR/USD technical breakout above 1.09 after positive EU growth revision',
    ],
  };

  async isAvailable(): Promise<boolean> {
    return true;
  }

  async fetchNews(
    symbols: string[],
    from: Date,
    to: Date,
    limit = 20,
  ): Promise<NewsItem[]> {
    const items: NewsItem[] = [];
    const rangeMs = to.getTime() - from.getTime();
    if (rangeMs <= 0) return items;

    for (const symbol of symbols) {
      const pool = this.headlines[symbol] ?? this.headlines['XAUUSD'];
      // Distribute headlines evenly across the time range
      const count = Math.min(pool.length, Math.ceil(limit / symbols.length));

      for (let i = 0; i < count; i++) {
        const headline = pool[i % pool.length];
        // Spread timestamps pseudo-randomly across range
        const offsetMs  = ((i + 1) / (count + 1)) * rangeMs;
        const timestamp = new Date(from.getTime() + offsetMs);

        const sentiment = this.nlp.computeSentiment(headline);
        const relevance = this.nlp.computeRelevance(headline, symbol);
        const impact    = this.nlp.computeImpact(headline, 'demo-source', sentiment, relevance);

        items.push({
          id:          randomUUID(),
          timestamp,
          source:      '[DEMO] synthetic-news',
          title:       `[DEMO] ${headline}`,
          summary:     `[DEMO] Synthetic news item generated for ${symbol} in demo mode.`,
          url:         `https://demo.example.com/news/${randomUUID()}`,
          language:    'en',
          symbols:     [symbol],
          topics:      this.inferTopics(headline),
          sentiment,
          relevance,
          impactScore: impact,
        });
      }
    }

    // Sort by timestamp ascending
    items.sort((a, b) => a.timestamp.getTime() - b.timestamp.getTime());
    return items.slice(0, limit);
  }

  async getStatus(): Promise<{ status: ProviderStatus; message: string }> {
    return { status: 'ONLINE', message: 'Demo mode — synthetic news only' };
  }

  private inferTopics(headline: string): string[] {
    const lower  = headline.toLowerCase();
    const topics: string[] = [];
    if (lower.includes('federal reserve') || lower.includes('fed') || lower.includes('ecb')) {
      topics.push('central-bank');
    }
    if (lower.includes('inflation') || lower.includes('cpi') || lower.includes('ppi')) {
      topics.push('inflation');
    }
    if (lower.includes('gold') || lower.includes('bullion')) topics.push('commodities');
    if (lower.includes('bitcoin') || lower.includes('crypto'))topics.push('crypto');
    if (lower.includes('euro') || lower.includes('dollar'))   topics.push('forex');
    if (topics.length === 0) topics.push('markets');
    return topics;
  }
}
