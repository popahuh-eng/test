// ============================================================
// Workers Manager — Bootstraps all background workers & schedulers
// ============================================================
import { ProviderRegistry } from '../providers/ProviderRegistry';
import { createMarketDataWorker } from './marketDataWorker';
import { createNewsWorker } from './newsWorker';
import { createFeatureWorker } from './featureWorker';
import { createPredictionWorker } from './predictionWorker';
import { createSignalWorker } from './signalWorker';
import { createPaperExecutionWorker } from './paperExecutionWorker';
import { BacktestWorker } from './backtestWorker';
import { marketDataQueue, newsQueue } from './queues';
import { getRedisClient } from '../services/redis';
import { logger } from '../services/logger';

export interface WorkersInstance {
  stop(): Promise<void>;
}

export async function startWorkers(
  providerRegistry: ProviderRegistry,
  telegramBot?: any,
): Promise<WorkersInstance> {
  const redis = getRedisClient();
  let redisMajor = 0;
  try {
    const info = await redis.info('server');
    const match = info.match(/redis_version:(\d+)\./);
    if (match) redisMajor = parseInt(match[1], 10);
  } catch (err: any) {
    logger.warn({ event: 'redis_info_err', err: err.message }, 'Could not fetch Redis version');
  }

  const scheduledIntervals: NodeJS.Timeout[] = [];

  if (redisMajor < 5) {
    logger.warn(
      { redisMajor },
      'Redis version is < 5.0 (or unavailable); BullMQ streams require Redis 5+. Running ingestion workers in direct in-process scheduler mode.',
    );

    const runDirectIngestion = async () => {
      try {
        const market = providerRegistry.getMarketProvider();
        const symbols = ['XAU/USD', 'BTC/USDT', 'ETH/USDT', 'EUR/USD'];
        for (const sym of symbols) {
          const now = new Date();
          const from = new Date(now.getTime() - 24 * 60 * 60 * 1000);
          await market.fetchCandles(sym, '1h', from, now);
        }
      } catch (err: any) {
        logger.warn({ event: 'in_process_ingest_warn', err: err.message });
      }
    };

    scheduledIntervals.push(setInterval(runDirectIngestion, 60_000));
    runDirectIngestion().catch(() => {});

    return {
      async stop() {
        for (const t of scheduledIntervals) clearInterval(t);
        logger.info({ event: 'workers_stopped' }, 'In-process background workers stopped');
      },
    };
  }

  logger.info({ event: 'workers_init' }, 'Starting BullMQ background workers...');

  const marketWorker = createMarketDataWorker(providerRegistry);
  const newsWorker = createNewsWorker(providerRegistry);
  const featureWorker = createFeatureWorker();
  const predictionWorker = createPredictionWorker();
  const signalWorker = createSignalWorker(telegramBot);
  const paperWorker = createPaperExecutionWorker();

  const allWorkers = [marketWorker, newsWorker, featureWorker, predictionWorker, signalWorker, paperWorker];
  for (const w of allWorkers) {
    w.on('error', (err) => {
      logger.warn({ event: 'bullmq_worker_notice', err: err.message });
    });
  }

  const backtestWorker = new BacktestWorker();
  backtestWorker.start().catch((err) => {
    logger.error({ event: 'backtest_worker_start_err', err: err.message }, 'Failed to start backtest worker');
  });

  const runIngestion = async () => {
    const symbols = ['XAUUSD', 'BTCUSDT', 'ETHUSDT', 'EURUSD'];
    for (const s of symbols) {
      await marketDataQueue.add(
        'ingest-candle',
        { symbol: s, timeframe: '1h' },
        { attempts: 3, backoff: { type: 'exponential', delay: 1000 } },
      );
    }
  };

  const runNewsIngestion = async () => {
    await newsQueue.add(
      'ingest-news',
      { symbols: ['XAUUSD', 'BTCUSDT', 'ETHUSDT', 'EURUSD'] },
      { attempts: 2 },
    );
  };

  scheduledIntervals.push(setInterval(runIngestion, 60_000));
  scheduledIntervals.push(setInterval(runNewsIngestion, 120_000));

  runIngestion().catch(() => {});
  runNewsIngestion().catch(() => {});

  return {
    async stop() {
      for (const t of scheduledIntervals) clearInterval(t);
      backtestWorker.stop();
      await Promise.all(allWorkers.map((w) => w.close()));
      logger.info({ event: 'workers_stopped' }, 'Background workers stopped');
    },
  };
}
