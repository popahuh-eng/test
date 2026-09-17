// ============================================================
// Instruments Routes — /api/instruments
// ============================================================
import type { FastifyInstance } from 'fastify';
import { eq } from 'drizzle-orm';
import { db } from '../db';
import { instruments } from '../db/schema';
import type { ApiResponse, Instrument } from '@trading/shared';

function ok<T>(data: T): ApiResponse<T> {
  return { success: true, data, error: null, timestamp: new Date().toISOString() };
}
function notFound(msg: string): ApiResponse<null> {
  return { success: false, data: null, error: msg, timestamp: new Date().toISOString() };
}

function mapRow(row: typeof instruments.$inferSelect): Instrument {
  return {
    id: row.id,
    symbol: row.symbol,
    displayName: row.displayName,
    assetType: row.assetType as Instrument['assetType'],
    baseAsset: row.baseAsset,
    quoteAsset: row.quoteAsset,
    exchange: row.exchange ?? '',
    provider: row.provider ?? '',
    currency: row.currency ?? '',
    tickSize: Number(row.tickSize ?? 0),
    lotSize: Number(row.lotSize ?? 0),
    contractSize: Number(row.contractSize ?? 0),
    minimumOrderSize: Number(row.minimumOrderSize ?? 0),
    pricePrecision: row.pricePrecision ?? 2,
    quantityPrecision: row.quantityPrecision ?? 2,
    isActive: row.isActive ?? true,
  };
}

export async function instrumentRoutes(fastify: FastifyInstance): Promise<void> {
  // GET /api/instruments
  fastify.get('/api/instruments', async (_request, reply) => {
    const rows = await db
      .select()
      .from(instruments)
      .where(eq(instruments.isActive, true));

    return reply.send(ok(rows.map(mapRow)));
  });

  // GET /api/instruments/:symbol
  fastify.get<{ Params: { symbol: string } }>(
    '/api/instruments/:symbol',
    async (request, reply) => {
      const symbol = request.params.symbol.toUpperCase();
      const [row] = await db
        .select()
        .from(instruments)
        .where(eq(instruments.symbol, symbol))
        .limit(1);

      if (!row) {
        return reply.status(404).send(notFound(`Instrument ${symbol} not found`));
      }

      return reply.send(ok(mapRow(row)));
    },
  );
}
