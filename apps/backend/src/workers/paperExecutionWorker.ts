// ============================================================
// Paper Execution Worker — Evaluates simulated trades on ticks
// ============================================================
import { Worker, type Job } from 'bullmq';
import { getRedisClient } from '../services/redis';
import { PaperTradingEngine } from '../paper/PaperTradingEngine';
import { logger } from '../services/logger';

interface PaperExecJobData {
  symbol: string;
  high: number;
  low: number;
  close: number;
  timestamp: string | Date;
}

export function createPaperExecutionWorker() {
  const connection = getRedisClient();
  const paperEngine = new PaperTradingEngine();

  return new Worker<PaperExecJobData>(
    'paper-execution',
    async (job: Job<PaperExecJobData>) => {
      const { symbol, high, low } = job.data;
      const closed = await paperEngine.checkOpenTrades(symbol, high, low);

      if (closed.length > 0) {
        logger.info(
          { event: 'paper_trades_closed', count: closed.length, symbol },
          'Paper trades triggered SL/TP on price tick',
        );
      }

      return { closedCount: closed.length };
    },
    {
      connection,
      concurrency: 2,
    },
  );
}
