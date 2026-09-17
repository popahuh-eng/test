// ============================================================
// News Worker — Ingests and scores news idempotently
// ============================================================
import { Worker, type Job } from 'bullmq';
import { getRedisClient } from '../services/redis';
import { db } from '../db';
import { news } from '../db/schema';
import { ProviderRegistry } from '../providers/ProviderRegistry';
import { FinancialNLP } from '../services/nlp';
import { logger } from '../services/logger';

interface NewsJobData {
  symbols: string[];
}

export function createNewsWorker(providerRegistry: ProviderRegistry) {
  const connection = getRedisClient();
  const nlp = new FinancialNLP();

  return new Worker<NewsJobData>(
    'news',
    async (job: Job<NewsJobData>) => {
      const { symbols } = job.data;
      const newsProvider = providerRegistry.getNewsProvider();

      const toDate = new Date();
      const fromDate = new Date(toDate.getTime() - 48 * 60 * 60 * 1000);

      const items = await newsProvider.fetchNews(symbols, fromDate, toDate, 20);
      let inserted = 0;

      for (const item of items) {
        const sentiment = nlp.computeSentiment(`${item.title} ${item.summary}`);
        const primarySymbol = symbols[0] || 'XAUUSD';
        const relevance = nlp.computeRelevance(`${item.title} ${item.summary}`, primarySymbol);
        const impactScore = nlp.computeImpact(`${item.title} ${item.summary}`, item.source, sentiment, relevance);

        try {
          await db
            .insert(news)
            .values({
              externalId: item.id,
              timestamp: new Date(item.timestamp),
              source: item.source,
              title: item.title,
              summary: item.summary,
              url: item.url,
              language: item.language || 'en',
              symbols: item.symbols || symbols,
              topics: item.topics || ['market'],
              rawText: item.summary,
              sentiment: String(sentiment.toFixed(4)),
              relevance: String(relevance.toFixed(4)),
              impactScore: String(impactScore.toFixed(4)),
              isDemo: item.source === 'demo' || newsProvider.name === 'demo',
            })
            .onConflictDoNothing();

          inserted++;
        } catch (err: any) {
          logger.error({ event: 'news_insert_err', err: err.message }, 'Failed to insert news item');
        }
      }

      return { count: inserted };
    },
    {
      connection,
      concurrency: 1,
    },
  );
}
