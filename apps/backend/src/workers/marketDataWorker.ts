// ============================================================
// Market Data Worker — Ingests candles idempotently
// ============================================================
import { Worker, type Job } from 'bullmq';
import { getRedisClient } from '../services/redis';
import { db } from '../db';
import { candles } from '../db/schema';
import { ProviderRegistry } from '../providers/ProviderRegistry';
import { featureQueue, paperExecutionQueue } from './queues';
import { logger } from '../services/logger';
import type { Timeframe } from '@trading/shared';

interface MarketDataJobData {
  symbol: string;
  timeframe: Timeframe;
  from?: string;
  to?: string;
}

export function createMarketDataWorker(providerRegistry: ProviderRegistry) {
  const connection = getRedisClient();

  return new Worker<MarketDataJobData>(
    'market-data',
    async (job: Job<MarketDataJobData>) => {
      const { symbol, timeframe } = job.data;
      const marketProvider = providerRegistry.getMarketProvider();

      const toDate = job.data.to ? new Date(job.data.to) : new Date();
      const fromDate = job.data.from
        ? new Date(job.data.from)
        : new Date(toDate.getTime() - 24 * 60 * 60 * 1000);

      const fetched = await marketProvider.fetchCandles(symbol, timeframe, fromDate, toDate);
      if (!fetched || fetched.length === 0) {
        logger.warn({ event: 'market_worker_no_candles', symbol, timeframe }, 'No candles fetched');
        return { count: 0 };
      }

      // Idempotent insertion
      let insertedCount = 0;
      for (const candle of fetched) {
        const o = Number(candle.open);
        const h = Number(candle.high);
        const l = Number(candle.low);
        const c = Number(candle.close);

        // Sanity validation: high >= low, open & close within high/low
        if (h < l || o > h || o < l || c > h || c < l) {
          logger.warn({ event: 'invalid_candle_skipped', candle }, 'Impossible OHLC skipped');
          continue;
        }

        try {
          await db
            .insert(candles)
            .values({
              symbol: candle.symbol,
              timeframe: candle.timeframe,
              timestamp: new Date(candle.timestamp),
              open: String(o),
              high: String(h),
              low: String(l),
              close: String(c),
              volume: String(candle.volume || 0),
              source: candle.source || marketProvider.name,
              isDemo: candle.source === 'demo' || marketProvider.name === 'demo',
            })
            .onConflictDoNothing();

          insertedCount++;
        } catch (err: any) {
          logger.error({ event: 'candle_insert_err', err: err.message }, 'Failed to insert candle');
        }
      }

      // Dispatch latest candle to paperExecutionQueue & featureQueue
      const latest = fetched[fetched.length - 1];
      if (latest) {
        await paperExecutionQueue.add('check-trades', {
          symbol,
          high: Number(latest.high),
          low: Number(latest.low),
          close: Number(latest.close),
          timestamp: latest.timestamp,
        });

        await featureQueue.add('compute-features', {
          symbol,
          timeframe,
          timestamp: latest.timestamp,
        });
      }

      return { count: insertedCount };
    },
    {
      connection,
      concurrency: 2,
    },
  );
}
