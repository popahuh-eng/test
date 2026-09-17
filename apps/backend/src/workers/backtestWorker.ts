// ============================================================
// Backtest Worker — Executes backtest simulation from Redis queue
// ============================================================
import { eq, and, gte, lte, asc } from 'drizzle-orm';
import { getRedisClient } from '../services/redis';
import { db } from '../db';
import { backtests, backtestTrades, candles, instruments } from '../db/schema';
import { BacktestEngine } from '../backtest/BacktestEngine';
import { DemoMarketDataProvider } from '../providers/demo/DemoMarketDataProvider';
import type { InstrumentSpec } from '../risk/types';
import type { Candle, Timeframe } from '@trading/shared';
import { logger } from '../services/logger';

export class BacktestWorker {
  private isRunning = false;
  private engine = new BacktestEngine();

  async start(): Promise<void> {
    this.isRunning = true;
    const redis = getRedisClient();

    logger.info({ event: 'backtest_worker_started' }, 'Backtest worker listening on backtest_queue');

    while (this.isRunning) {
      try {
        // Pop job with 2-second timeout
        const item = await redis.blpop('backtest_queue', 2);
        if (!item || !item[1]) continue;

        const job = JSON.parse(item[1]);
        await this.processJob(job);
      } catch (err: any) {
        if (!this.isRunning) break;
        logger.error({ event: 'backtest_worker_err', err: err.message }, 'Error in backtest worker loop');
        await new Promise((r) => setTimeout(r, 1000));
      }
    }
  }

  stop(): void {
    this.isRunning = false;
  }

  private async processJob(job: { backtestId: string; userId: string; config: any }): Promise<void> {
    const { backtestId, config } = job;

    try {
      // Mark as RUNNING
      await db
        .update(backtests)
        .set({ status: 'RUNNING', updatedAt: new Date() })
        .where(eq(backtests.id, backtestId));

      // Fetch instrument
      const [instr] = await db
        .select()
        .from(instruments)
        .where(eq(instruments.symbol, config.symbol))
        .limit(1);

      const spec: InstrumentSpec = {
        symbol: config.symbol,
        assetType: (instr?.assetType as any) || (config.symbol.includes('USDT') ? 'CRYPTO' : 'FOREX'),
        pricePrecision: instr?.pricePrecision ?? 2,
        quantityPrecision: instr?.quantityPrecision ?? 4,
        tickSize: Number(instr?.tickSize ?? 0.01),
        lotSize: Number(instr?.lotSize ?? 1),
        contractSize: Number(instr?.contractSize ?? 1),
        minimumOrderSize: Number(instr?.minimumOrderSize ?? 0.001),
      };

      // Fetch historical candles
      const startDate = new Date(config.startDate);
      const endDate = new Date(config.endDate);

      let historicalCandles = await db
        .select()
        .from(candles)
        .where(
          and(
            eq(candles.symbol, config.symbol),
            eq(candles.timeframe, config.timeframe),
            gte(candles.timestamp, startDate),
            lte(candles.timestamp, endDate),
          ),
        )
        .orderBy(asc(candles.timestamp));

      // If DB has fewer than 50 candles, generate deterministic demo candles for backtest
      if (historicalCandles.length < 50) {
        const demoProvider = new DemoMarketDataProvider();
        const demoCandles = await demoProvider.fetchCandles(
          config.symbol,
          config.timeframe as Timeframe,
          startDate,
          endDate,
        );
        historicalCandles = demoCandles.map((c) => ({
          id: '',
          symbol: c.symbol,
          timeframe: c.timeframe,
          timestamp: new Date(c.timestamp),
          open: String(c.open),
          high: String(c.high),
          low: String(c.low),
          close: String(c.close),
          volume: String(c.volume),
          source: 'demo',
          isDemo: true,
        }));
      }

      // Map to Candle objects
      const mappedCandles: Candle[] = historicalCandles.map((c) => ({
        symbol: c.symbol,
        timeframe: c.timeframe as Timeframe,
        timestamp: new Date(c.timestamp),
        open: Number(c.open),
        high: Number(c.high),
        low: Number(c.low),
        close: Number(c.close),
        volume: Number(c.volume),
        source: c.source ?? 'demo',
      }));

      // Run simulation
      const { result, trades } = await this.engine.run(config, mappedCandles, spec);

      // Save trades
      for (const t of trades) {
        await db.insert(backtestTrades).values({
          backtestId,
          timestamp: t.timestamp,
          symbol: t.symbol,
          direction: t.direction,
          entryPrice: String(t.entryPrice),
          exitPrice: String(t.exitPrice),
          stopLoss: String(t.stopLoss),
          takeProfit: String(t.takeProfit),
          positionSize: String(t.positionSize),
          pnl: String(t.pnl),
          fees: String(t.fees),
          slippage: String(t.slippage),
          exitReason: t.exitReason,
          duration: t.durationSeconds,
        });
      }

      // Update backtest record
      await db
        .update(backtests)
        .set({
          status: 'COMPLETED',
          totalTrades: result.totalTrades,
          winRate: String(result.winRate),
          profitFactor: String(result.profitFactor),
          netPnl: String(result.netPnl),
          maxDrawdown: String(result.maxDrawdown),
          averageTrade: String(result.averageTrade),
          largestWin: String(result.largestWin),
          largestLoss: String(result.largestLoss),
          sharpeRatio: String(result.sharpeRatio),
          startingBalance: String(result.startingBalance),
          finalBalance: String(result.finalBalance),
          equityCurve: result.equityCurve as any,
          updatedAt: new Date(),
        })
        .where(eq(backtests.id, backtestId));

      logger.info({ event: 'backtest_completed', backtestId, netPnl: result.netPnl }, 'Backtest completed');
    } catch (err: any) {
      logger.error({ event: 'backtest_failed', backtestId, err: err.message }, 'Backtest execution failed');
      await db
        .update(backtests)
        .set({ status: 'FAILED', error: err.message, updatedAt: new Date() })
        .where(eq(backtests.id, backtestId));
    }
  }
}
