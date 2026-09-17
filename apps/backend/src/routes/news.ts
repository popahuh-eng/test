// ============================================================
// News Routes — /api/news
// ============================================================
import type { FastifyInstance } from 'fastify';
import { desc, gte, sql, and } from 'drizzle-orm';
import { db } from '../db';
import { news } from '../db/schema';
import type { ApiResponse, NewsItem } from '@trading/shared';

function ok<T>(data: T): ApiResponse<T> {
  return { success: true, data, error: null, timestamp: new Date().toISOString() };
}

function mapNews(r: typeof news.$inferSelect): NewsItem {
  return {
    id: r.id,
    timestamp: r.timestamp as Date,
    source: r.source ?? '',
    title: r.title,
    summary: r.summary ?? '',
    url: r.url ?? '',
    language: r.language ?? 'en',
    symbols: (r.symbols as string[]) ?? [],
    topics: (r.topics as string[]) ?? [],
    sentiment: Number(r.sentiment ?? 0),
    relevance: Number(r.relevance ?? 0),
    impactScore: Number(r.impactScore ?? 0),
  };
}

export async function newsRoutes(fastify: FastifyInstance): Promise<void> {
  // GET /api/news?symbol=XAU/USD&sentiment=positive&limit=20&page=1&fromDate=2024-01-01
  fastify.get<{
    Querystring: {
      symbol?: string;
      sentiment?: 'positive' | 'negative' | 'neutral';
      limit?: string;
      page?: string;
      fromDate?: string;
    };
  }>('/api/news', async (request, reply) => {
    const { symbol, sentiment, limit: limitStr, page: pageStr, fromDate } = request.query;
    const limit = Math.min(Number(limitStr ?? 20), 100);
    const page = Math.max(Number(pageStr ?? 1), 1);
    const offset = (page - 1) * limit;

    const conditions = [];

    if (fromDate) {
      const from = new Date(fromDate);
      if (!isNaN(from.getTime())) {
        conditions.push(gte(news.timestamp, from));
      }
    }

    if (symbol) {
      // Filter news where symbol appears in the symbols array
      conditions.push(
        sql`${news.symbols} @> ARRAY[${symbol.toUpperCase()}]::text[]`,
      );
    }

    if (sentiment === 'positive') {
      conditions.push(sql`${news.sentiment} > 0.1`);
    } else if (sentiment === 'negative') {
      conditions.push(sql`${news.sentiment} < -0.1`);
    } else if (sentiment === 'neutral') {
      conditions.push(sql`${news.sentiment} BETWEEN -0.1 AND 0.1`);
    }

    const rows = await db
      .select()
      .from(news)
      .where(conditions.length > 0 ? and(...conditions) : undefined)
      .orderBy(desc(news.timestamp))
      .limit(limit)
      .offset(offset);

    return reply.send(ok(rows.map(mapNews)));
  });
}
