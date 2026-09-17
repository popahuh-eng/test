// ============================================================
// Feature Worker — Generates feature vector for symbol
// ============================================================
import { Worker, type Job } from 'bullmq';
import { eq, and, desc } from 'drizzle-orm';
import { getRedisClient } from '../services/redis';
import { db } from '../db';
import { candles, features } from '../db/schema';
import { predictionQueue } from './queues';
import { logger } from '../services/logger';

interface FeatureJobData {
  symbol: string;
  timeframe: string;
  timestamp: string | Date;
}

export function createFeatureWorker() {
  const connection = getRedisClient();

  return new Worker<FeatureJobData>(
    'features',
    async (job: Job<FeatureJobData>) => {
      const { symbol, timeframe } = job.data;

      // Fetch last 100 candles
      const rows = await db
        .select()
        .from(candles)
        .where(and(eq(candles.symbol, symbol), eq(candles.timeframe, timeframe)))
        .orderBy(desc(candles.timestamp))
        .limit(100);

      if (rows.length < 20) {
        return { status: 'skipped_insufficient_candles', count: rows.length };
      }

      // Sort ascending
      rows.reverse();
      const closes = rows.map((r) => Number(r.close));
      const highs = rows.map((r) => Number(r.high));
      const lows = rows.map((r) => Number(r.low));
      const volumes = rows.map((r) => Number(r.volume));
      const currentClose = closes[closes.length - 1];

      // Returns and Moving averages
      const sma20 = closes.slice(-20).reduce((a, b) => a + b, 0) / 20;
      const sma50 = closes.length >= 50 ? closes.slice(-50).reduce((a, b) => a + b, 0) / 50 : sma20;
      const returns = (currentClose - closes[closes.length - 2]) / closes[closes.length - 2];

      // ATR-14
      let atr14 = 1.0;
      if (rows.length >= 15) {
        const trs: number[] = [];
        for (let i = rows.length - 14; i < rows.length; i++) {
          const hl = highs[i] - lows[i];
          const hc = Math.abs(highs[i] - closes[i - 1]);
          const lc = Math.abs(lows[i] - closes[i - 1]);
          trs.push(Math.max(hl, hc, lc));
        }
        atr14 = trs.reduce((a, b) => a + b, 0) / trs.length;
      }

      // RSI-14
      let rsi14 = 50.0;
      if (closes.length >= 15) {
        let gains = 0;
        let losses = 0;
        for (let i = closes.length - 14; i < closes.length; i++) {
          const diff = closes[i] - closes[i - 1];
          if (diff >= 0) gains += diff;
          else losses += Math.abs(diff);
        }
        if (losses > 0) {
          const rs = gains / losses;
          rsi14 = 100 - 100 / (1 + rs);
        } else {
          rsi14 = 100;
        }
      }

      const featureVector: Record<string, number> = {
        close: currentClose,
        returns,
        sma_20: sma20,
        sma_50: sma50,
        price_vs_sma20: (currentClose - sma20) / sma20,
        rsi_14: rsi14,
        atr_14: atr14,
        atr_14_pct: atr14 / currentClose,
        trend_direction: currentClose > sma20 ? 1 : -1,
        volume_ratio: volumes[volumes.length - 1] / (volumes.slice(-20).reduce((a, b) => a + b, 0) / 20 || 1),
      };

      const candleTime = new Date(rows[rows.length - 1].timestamp);

      // Save feature snapshot
      try {
        await db
          .insert(features)
          .values({
            symbol,
            timeframe,
            timestamp: candleTime,
            featuresVersion: 'v1',
            featureVector,
            isDemo: rows[rows.length - 1].isDemo ?? true,
          })
          .onConflictDoNothing();
      } catch (err: any) {
        logger.warn({ event: 'feature_insert_warn', err: err.message }, 'Failed to save feature snapshot');
      }

      // Enqueue prediction job
      await predictionQueue.add('predict', {
        symbol,
        timeframe,
        timestamp: candleTime,
        features: featureVector,
        currentPrice: currentClose,
        atr14,
        rsi14,
      });

      return { status: 'features_computed', features: featureVector };
    },
    {
      connection,
      concurrency: 2,
    },
  );
}
