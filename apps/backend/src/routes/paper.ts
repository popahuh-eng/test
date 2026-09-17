// ============================================================
// Paper Trading Routes — /api/paper (protected)
// ============================================================
import type { FastifyInstance } from 'fastify';
import { eq, and, desc } from 'drizzle-orm';
import { z } from 'zod';
import { db } from '../db';
import { paperAccounts, paperTrades } from '../db/schema';
import { authenticate } from '../middleware/auth';
import type { ApiResponse, PaperTrade } from '@trading/shared';

function ok<T>(data: T): ApiResponse<T> {
  return { success: true, data, error: null, timestamp: new Date().toISOString() };
}
function notFound(msg: string): ApiResponse<null> {
  return { success: false, data: null, error: msg, timestamp: new Date().toISOString() };
}

const OpenTradeSchema = z.object({
  symbol: z.string().min(1),
  direction: z.enum(['LONG', 'SHORT']),
  entryPrice: z.number().positive(),
  stopLoss: z.number().positive(),
  takeProfit: z.number().positive(),
  positionSize: z.number().positive(),
  riskPercent: z.number().min(0.01).max(10),
});

const CloseTradeSchema = z.object({
  closePrice: z.number().positive(),
  closeReason: z.string().optional(),
});

const INITIAL_BALANCE = 10_000;
const FEE_RATE = 0.0002; // 0.02% per side

function mapTrade(r: typeof paperTrades.$inferSelect): PaperTrade {
  return {
    id: r.id,
    accountId: r.accountId ?? '',
    signalId: r.signalId ?? null,
    symbol: r.symbol ?? '',
    direction: (r.direction ?? 'LONG') as PaperTrade['direction'],
    entryPrice: Number(r.entryPrice ?? 0),
    stopLoss: Number(r.stopLoss ?? 0),
    takeProfit: Number(r.takeProfit ?? 0),
    positionSize: Number(r.positionSize ?? 0),
    riskPercent: Number(r.riskPercent ?? 0),
    fees: Number(r.fees ?? 0),
    pnl: r.pnl !== null ? Number(r.pnl) : null,
    status: (r.status ?? 'OPEN') as PaperTrade['status'],
    openedAt: r.openedAt as Date,
    closedAt: r.closedAt ?? null,
    closePrice: r.closePrice !== null ? Number(r.closePrice) : null,
    closeReason: r.closeReason ?? null,
  };
}

export async function paperRoutes(fastify: FastifyInstance): Promise<void> {
  // GET /api/paper/account — get or create
  fastify.get(
    '/api/paper/account',
    { preHandler: [authenticate] },
    async (request, reply) => {
      const userId = (request.user as { sub: string }).sub;
      let [account] = await db
        .select()
        .from(paperAccounts)
        .where(and(eq(paperAccounts.userId, userId), eq(paperAccounts.isActive, true)))
        .limit(1);

      if (!account) {
        [account] = await db
          .insert(paperAccounts)
          .values({
            userId,
            name: 'Default Paper Account',
            balance: String(INITIAL_BALANCE),
            initialBalance: String(INITIAL_BALANCE),
            totalPnl: '0',
            isActive: true,
          })
          .returning();
      }

      return reply.send(ok(account));
    },
  );

  // GET /api/paper/trades
  fastify.get(
    '/api/paper/trades',
    { preHandler: [authenticate] },
    async (request, reply) => {
      const userId = (request.user as { sub: string }).sub;
      const [account] = await db
        .select({ id: paperAccounts.id })
        .from(paperAccounts)
        .where(and(eq(paperAccounts.userId, userId), eq(paperAccounts.isActive, true)))
        .limit(1);

      if (!account) return reply.send(ok([]));

      const trades = await db
        .select()
        .from(paperTrades)
        .where(eq(paperTrades.accountId, account.id))
        .orderBy(desc(paperTrades.openedAt));

      return reply.send(ok(trades.map(mapTrade)));
    },
  );

  // POST /api/paper/trades — open paper trade
  fastify.post<{ Body: z.infer<typeof OpenTradeSchema> }>(
    '/api/paper/trades',
    { preHandler: [authenticate] },
    async (request, reply) => {
      const userId = (request.user as { sub: string }).sub;
      const parseResult = OpenTradeSchema.safeParse(request.body);
      if (!parseResult.success) {
        return reply.status(400).send({
          success: false, data: null,
          error: parseResult.error.errors.map((e) => e.message).join(', '),
          timestamp: new Date().toISOString(),
        });
      }

      let [account] = await db
        .select()
        .from(paperAccounts)
        .where(and(eq(paperAccounts.userId, userId), eq(paperAccounts.isActive, true)))
        .limit(1);

      if (!account) {
        [account] = await db
          .insert(paperAccounts)
          .values({
            userId,
            name: 'Default Paper Account',
            balance: String(INITIAL_BALANCE),
            initialBalance: String(INITIAL_BALANCE),
            totalPnl: '0',
            isActive: true,
          })
          .returning();
      }

      const { entryPrice, positionSize } = parseResult.data;
      const fees = entryPrice * positionSize * FEE_RATE;

      const [trade] = await db
        .insert(paperTrades)
        .values({
          accountId: account!.id,
          symbol: parseResult.data.symbol.toUpperCase(),
          direction: parseResult.data.direction,
          entryPrice: String(entryPrice),
          stopLoss: String(parseResult.data.stopLoss),
          takeProfit: String(parseResult.data.takeProfit),
          positionSize: String(positionSize),
          riskPercent: String(parseResult.data.riskPercent),
          fees: String(fees),
          status: 'OPEN',
          openedAt: new Date(),
          isDemo: true,
        })
        .returning();

      return reply.status(201).send(ok(mapTrade(trade!)));
    },
  );

  // PATCH /api/paper/trades/:id/close
  fastify.patch<{
    Params: { id: string };
    Body: z.infer<typeof CloseTradeSchema>;
  }>(
    '/api/paper/trades/:id/close',
    { preHandler: [authenticate] },
    async (request, reply) => {
      const userId = (request.user as { sub: string }).sub;
      const parseResult = CloseTradeSchema.safeParse(request.body);
      if (!parseResult.success) {
        return reply.status(400).send({
          success: false, data: null,
          error: parseResult.error.errors.map((e) => e.message).join(', '),
          timestamp: new Date().toISOString(),
        });
      }

      const [account] = await db
        .select({ id: paperAccounts.id })
        .from(paperAccounts)
        .where(and(eq(paperAccounts.userId, userId), eq(paperAccounts.isActive, true)))
        .limit(1);

      if (!account) return reply.status(404).send(notFound('No paper account found'));

      const [existing] = await db
        .select()
        .from(paperTrades)
        .where(and(eq(paperTrades.id, request.params.id), eq(paperTrades.accountId, account.id)))
        .limit(1);

      if (!existing) return reply.status(404).send(notFound('Trade not found'));
      if (existing.status !== 'OPEN') {
        return reply.status(400).send({
          success: false, data: null,
          error: 'Trade is already closed',
          timestamp: new Date().toISOString(),
        });
      }

      const { closePrice, closeReason } = parseResult.data;
      const entryPrice = Number(existing.entryPrice);
      const positionSize = Number(existing.positionSize);
      const fees = Number(existing.fees ?? 0);
      const closeFees = closePrice * positionSize * FEE_RATE;

      let pnl: number;
      if (existing.direction === 'LONG') {
        pnl = (closePrice - entryPrice) * positionSize - fees - closeFees;
      } else {
        pnl = (entryPrice - closePrice) * positionSize - fees - closeFees;
      }

      const [updated] = await db
        .update(paperTrades)
        .set({
          status: 'CLOSED',
          closedAt: new Date(),
          closePrice: String(closePrice),
          closeReason: closeReason ?? 'MANUAL',
          pnl: String(pnl),
        })
        .where(eq(paperTrades.id, existing.id))
        .returning();

      // Update account balance
      const newBalance = Number(account.id) + pnl; // will fetch fresh
      const [freshAccount] = await db
        .select({ balance: paperAccounts.balance, totalPnl: paperAccounts.totalPnl })
        .from(paperAccounts)
        .where(eq(paperAccounts.id, account.id))
        .limit(1);

      if (freshAccount) {
        await db
          .update(paperAccounts)
          .set({
            balance: String(Number(freshAccount.balance) + pnl),
            totalPnl: String(Number(freshAccount.totalPnl) + pnl),
            updatedAt: new Date(),
          })
          .where(eq(paperAccounts.id, account.id));
      }

      return reply.send(ok(mapTrade(updated!)));
    },
  );
}
