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
import { logger } from '../services/logger';

export interface WorkersInstance {
  stop(): Promise<void>;
}

export function startWorkers(
  providerRegistry: ProviderRegistry,
  telegramBot?: any,
): WorkersInstance {
  logger.info({ event: 'workers_init' }, 'Starting background workers...');

  const marketWorker = createMarketDataWorker(providerRegistry);
  const newsWorker = createNewsWorker(providerRegistry);
  const featureWorker = createFeatureWorker();
  const predictionWorker = createPredictionWorker();
  const signalWorker = createSignalWorker(telegramBot);
  const paperWorker = createPaperExecutionWorker();

  const backtestWorker = new BacktestWorker();
  backtestWorker.start().catch((err) => {
    logger.error({ event: 'backtest_worker_start_err', err: err.message }, 'Failed to start backtest worker');
  });

  // Recurring cron schedules for ingestion
  const scheduledIntervals: NodeJS.Timeout[] = [];

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

  // Schedule every 60 seconds
  scheduledIntervals.push(setInterval(runIngestion, 60_000));
  scheduledIntervals.push(setInterval(runNewsIngestion, 120_000));

  // Run once on startup
  runIngestion().catch(() => {});
  runNewsIngestion().catch(() => {});

  return {
    async stop() {
      for (const t of scheduledIntervals) clearInterval(t);
      backtestWorker.stop();
      await Promise.all([
        marketWorker.close(),
        newsWorker.close(),
        featureWorker.close(),
        predictionWorker.close(),
        signalWorker.close(),
        paperWorker.close(),
      ]);
      logger.info({ event: 'workers_stopped' }, 'Background workers stopped');
    },
  };
}
