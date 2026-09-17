// ============================================================
// Backtests Routes — /api/backtests (protected)
// ============================================================
import type { FastifyInstance } from 'fastify';
import { eq, and, desc } from 'drizzle-orm';
import { z } from 'zod';
import { db } from '../db';
import { backtests, backtestTrades } from '../db/schema';
import { authenticate } from '../middleware/auth';
import { getRedisClient } from '../services/redis';
import { logger } from '../services/logger';
import type { ApiResponse, BacktestResult, BacktestConfig } from '@trading/shared';

function ok<T>(data: T): ApiResponse<T> {
  return { success: true, data, error: null, timestamp: new Date().toISOString() };
}
function notFound(msg: string): ApiResponse<null> {
  return { success: false, data: null, error: msg, timestamp: new Date().toISOString() };
}

const BacktestConfigSchema = z.object({
  symbol: z.string().min(1),
  timeframe: z.enum(['1m', '5m', '15m', '1h', '4h', '1d']),
  startDate: z.string().datetime(),
  endDate: z.string().datetime(),
  startingBalance: z.number().positive(),
  riskPerTrade: z.number().min(0.1).max(10),
  modelVersion: z.string().min(1),
  commission: z.number().min(0).default(0.0002),
  slippage: z.number().min(0).default(0.0001),
  spreadPips: z.number().min(0).default(1),
});

function mapBacktest(r: typeof backtests.$inferSelect): BacktestResult {
  return {
    id: r.id,
    config: r.config as BacktestConfig,
    totalTrades: r.totalTrades ?? 0,
    winRate: Number(r.winRate ?? 0),
    profitFactor: Number(r.profitFactor ?? 0),
    netPnl: Number(r.netPnl ?? 0),
    maxDrawdown: Number(r.maxDrawdown ?? 0),
    averageTrade: Number(r.averageTrade ?? 0),
    largestWin: Number(r.largestWin ?? 0),
    largestLoss: Number(r.largestLoss ?? 0),
    sharpeRatio: Number(r.sharpeRatio ?? 0),
    startingBalance: Number(r.startingBalance ?? 0),
    finalBalance: Number(r.finalBalance ?? 0),
    equityCurve: (r.equityCurve as Array<{ timestamp: Date; equity: number }>) ?? [],
    createdAt: r.createdAt as Date,
    status: (r.status ?? 'PENDING') as BacktestResult['status'],
  };
}

export async function backtestRoutes(fastify: FastifyInstance): Promise<void> {
  // GET /api/backtests
  fastify.get(
    '/api/backtests',
    { preHandler: [authenticate] },
    async (request, reply) => {
      const userId = (request.user as { sub: string }).sub;
      const rows = await db
        .select()
        .from(backtests)
        .where(eq(backtests.userId, userId))
        .orderBy(desc(backtests.createdAt));

      return reply.send(ok(rows.map(mapBacktest)));
    },
  );

  // GET /api/backtests/:id
  fastify.get<{ Params: { id: string } }>(
    '/api/backtests/:id',
    { preHandler: [authenticate] },
    async (request, reply) => {
      const userId = (request.user as { sub: string }).sub;
      const [row] = await db
        .select()
        .from(backtests)
        .where(and(eq(backtests.id, request.params.id), eq(backtests.userId, userId)))
        .limit(1);

      if (!row) return reply.status(404).send(notFound('Backtest not found'));

      const trades = await db
        .select()
        .from(backtestTrades)
        .where(eq(backtestTrades.backtestId, row.id));

      return reply.send(ok({ ...mapBacktest(row), trades }));
    },
  );

  // POST /api/backtests — create and enqueue
  fastify.post<{ Body: z.infer<typeof BacktestConfigSchema> }>(
    '/api/backtests',
    { preHandler: [authenticate] },
    async (request, reply) => {
      const userId = (request.user as { sub: string }).sub;
      const parseResult = BacktestConfigSchema.safeParse(request.body);

      if (!parseResult.success) {
        return reply.status(400).send({
          success: false,
          data: null,
          error: parseResult.error.errors.map((e) => e.message).join(', '),
          timestamp: new Date().toISOString(),
        });
      }

      const configData = parseResult.data;
      const [newBacktest] = await db
        .insert(backtests)
        .values({
          userId,
          config: configData,
          status: 'PENDING',
          startingBalance: String(configData.startingBalance),
        })
        .returning();

      if (!newBacktest) {
        return reply.status(500).send({ success: false, data: null, error: 'Failed to create backtest', timestamp: new Date().toISOString() });
      }

      // Enqueue backtest job via Redis
      const redis = getRedisClient();
      await redis.rpush(
        'backtest_queue',
        JSON.stringify({ backtestId: newBacktest.id, userId, config: configData }),
      );

      logger.info({ event: 'backtest_enqueued', backtestId: newBacktest.id }, 'Backtest job enqueued');

      return reply.status(202).send(ok(mapBacktest(newBacktest)));
    },
  );
}
