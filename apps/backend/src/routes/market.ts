// ============================================================
// Market Routes — /api/market
// ============================================================
import type { FastifyInstance } from 'fastify';
import { eq, and, desc } from 'drizzle-orm';
import { db } from '../db';
import { candles } from '../db/schema';
import type { ApiResponse, Candle, Timeframe } from '@trading/shared';

function ok<T>(data: T): ApiResponse<T> {
  return { success: true, data, error: null, timestamp: new Date().toISOString() };
}
function err(msg: string): ApiResponse<null> {
  return { success: false, data: null, error: msg, timestamp: new Date().toISOString() };
}

const VALID_TIMEFRAMES: Timeframe[] = ['1m', '5m', '15m', '1h', '4h', '1d'];

export async function marketRoutes(fastify: FastifyInstance): Promise<void> {
  // GET /api/market/:symbol?timeframe=1h&limit=100
  fastify.get<{
    Params: { symbol: string };
    Querystring: { timeframe?: string; limit?: string };
  }>('/api/market/:symbol', async (request, reply) => {
    const symbol = request.params.symbol.toUpperCase();
    const tf = (request.query.timeframe ?? '1h') as Timeframe;
    const limit = Math.min(Number(request.query.limit ?? 100), 1000);

    if (!VALID_TIMEFRAMES.includes(tf)) {
      return reply.status(400).send(err(`Invalid timeframe. Valid: ${VALID_TIMEFRAMES.join(', ')}`));
    }

    const rows = await db
      .select()
      .from(candles)
      .where(and(eq(candles.symbol, symbol), eq(candles.timeframe, tf)))
      .orderBy(desc(candles.timestamp))
      .limit(limit);

    const result: Candle[] = rows
      .reverse()
      .map((r) => ({
        timestamp: r.timestamp as Date,
        open: Number(r.open),
        high: Number(r.high),
        low: Number(r.low),
        close: Number(r.close),
        volume: Number(r.volume ?? 0),
        symbol: r.symbol,
        timeframe: r.timeframe as Timeframe,
        source: r.source ?? 'unknown',
      }));

    return reply.send(ok(result));
  });

  // GET /api/market/:symbol/snapshot — latest candle summary
  fastify.get<{ Params: { symbol: string } }>(
    '/api/market/:symbol/snapshot',
    async (request, reply) => {
      const symbol = request.params.symbol.toUpperCase();

      // Fetch the two most recent daily candles for price change
      const rows = await db
        .select()
        .from(candles)
        .where(and(eq(candles.symbol, symbol), eq(candles.timeframe, '1d')))
        .orderBy(desc(candles.timestamp))
        .limit(2);

      if (rows.length === 0) {
        return reply.status(404).send(err(`No data for ${symbol}`));
      }

      const latest = rows[0]!;
      const prev = rows[1];

      const price = Number(latest.close);
      const prevClose = prev ? Number(prev.close) : price;
      const change = price - prevClose;
      const changePct = prevClose !== 0 ? (change / prevClose) * 100 : 0;

      return reply.send(
        ok({
          symbol,
          price,
          change: parseFloat(change.toFixed(10)),
          changePct: parseFloat(changePct.toFixed(4)),
          volume: Number(latest.volume ?? 0),
          high24h: Number(latest.high),
          low24h: Number(latest.low),
          timestamp: latest.timestamp,
        }),
      );
    },
  );
}
