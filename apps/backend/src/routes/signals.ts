// ============================================================
// Signals Routes — /api/signals (protected)
// ============================================================
import type { FastifyInstance } from 'fastify';
import { eq, and, or, isNull, desc } from 'drizzle-orm';
import { db } from '../db';
import { signals } from '../db/schema';
import { authenticate } from '../middleware/auth';
import type { ApiResponse, Signal } from '@trading/shared';

function ok<T>(data: T): ApiResponse<T> {
  return { success: true, data, error: null, timestamp: new Date().toISOString() };
}
function notFound(msg: string): ApiResponse<null> {
  return { success: false, data: null, error: msg, timestamp: new Date().toISOString() };
}

function mapSignal(r: typeof signals.$inferSelect): Signal {
  return {
    id: r.id,
    symbol: r.symbol ?? '',
    timestamp: r.timestamp as Date,
    direction: (r.direction ?? 'NO_SIGNAL') as Signal['direction'],
    entry: Number(r.entry ?? 0),
    stopLoss: Number(r.stopLoss ?? 0),
    takeProfit: Number(r.takeProfit ?? 0),
    positionSize: Number(r.positionSize ?? 0),
    riskPercent: Number(r.riskPercent ?? 0),
    riskReward: Number(r.riskReward ?? 0),
    confidence: Number(r.confidence ?? 0),
    probabilityUp: Number(r.probabilityUp ?? 0),
    probabilityDown: Number(r.probabilityDown ?? 0),
    marketRegime: (r.marketRegime ?? 'RANGE') as Signal['marketRegime'],
    newsSentiment: r.newsSentiment !== null ? Number(r.newsSentiment) : null,
    socialSentiment: r.socialSentiment !== null ? Number(r.socialSentiment) : null,
    modelVersion: r.modelVersion ?? '',
    reasonCodes: (r.reasonCodes as string[]) ?? [],
    isDemo: r.isDemo ?? false,
  };
}

export async function signalRoutes(fastify: FastifyInstance): Promise<void> {
  // GET /api/signals?symbol=&limit=20&page=1
  fastify.get<{
    Querystring: { symbol?: string; limit?: string; page?: string };
  }>(
    '/api/signals',
    { preHandler: [authenticate] },
    async (request, reply) => {
      const userId = (request.user as { sub: string }).sub;
      const { symbol, limit: limitStr, page: pageStr } = request.query;
      const limit = Math.min(Number(limitStr ?? 20), 100);
      const page = Math.max(Number(pageStr ?? 1), 1);
      const offset = (page - 1) * limit;

      const conditions = [or(eq(signals.userId, userId), isNull(signals.userId))];
      if (symbol) conditions.push(eq(signals.symbol, symbol.toUpperCase()));

      const rows = await db
        .select()
        .from(signals)
        .where(and(...conditions))
        .orderBy(desc(signals.timestamp))
        .limit(limit)
        .offset(offset);

      return reply.send(ok(rows.map(mapSignal)));
    },
  );

  // GET /api/signals/:id
  fastify.get<{ Params: { id: string } }>(
    '/api/signals/:id',
    { preHandler: [authenticate] },
    async (request, reply) => {
      const userId = (request.user as { sub: string }).sub;
      const [row] = await db
        .select()
        .from(signals)
        .where(and(eq(signals.id, request.params.id), eq(signals.userId, userId)))
        .limit(1);

      if (!row) return reply.status(404).send(notFound('Signal not found'));
      return reply.send(ok(mapSignal(row)));
    },
  );
}
