// ============================================================
// Paper Trading Engine — Simulated Virtual Execution Engine
// ============================================================
import { eq, and } from 'drizzle-orm';
import { db } from '../db';
import { paperAccounts, paperTrades } from '../db/schema';
import type { PaperTrade, PaperTradeStatus } from '@trading/shared';
import { logger } from '../services/logger';

export class PaperTradingEngine {
  private readonly feeRate = 0.0002; // 0.02% per side

  /**
   * Open a new virtual paper trade.
   */
  async openTrade(
    accountId: string,
    signalId: string | null,
    symbol: string,
    direction: 'LONG' | 'SHORT',
    entryPrice: number,
    stopLoss: number,
    takeProfit: number,
    positionSize: number,
    riskPercent: number,
  ): Promise<PaperTrade> {
    const [account] = await db
      .select()
      .from(paperAccounts)
      .where(eq(paperAccounts.id, accountId))
      .limit(1);

    if (!account) {
      throw new Error(`Paper account ${accountId} not found`);
    }

    const currentBalance = Number(account.balance);
    const notional = entryPrice * positionSize;
    const fees = Number((notional * this.feeRate).toFixed(4));

    if (currentBalance < fees) {
      throw new Error(`Insufficient paper balance for fees (${currentBalance} < ${fees})`);
    }

    const [trade] = await db
      .insert(paperTrades)
      .values({
        accountId,
        signalId: signalId || null,
        symbol,
        direction,
        entryPrice: String(entryPrice),
        stopLoss: String(stopLoss),
        takeProfit: String(takeProfit),
        positionSize: String(positionSize),
        riskPercent: String(riskPercent),
        fees: String(fees),
        pnl: null,
        status: 'OPEN',
        openedAt: new Date(),
        isDemo: true,
      })
      .returning();

    // Deduct entry fee from account balance
    await db
      .update(paperAccounts)
      .set({
        balance: String((currentBalance - fees).toFixed(2)),
        updatedAt: new Date(),
      })
      .where(eq(paperAccounts.id, accountId));

    logger.info(
      { event: 'paper_trade_opened', tradeId: trade.id, symbol, direction, entryPrice },
      'Opened simulated paper trade',
    );

    return this.mapTrade(trade);
  }

  /**
   * Close an open paper trade with given close price and status (TP/SL/CLOSED).
   */
  async closeTrade(
    tradeId: string,
    closePrice: number,
    status: PaperTradeStatus = 'CLOSED',
    reason?: string,
  ): Promise<PaperTrade> {
    const [trade] = await db
      .select()
      .from(paperTrades)
      .where(eq(paperTrades.id, tradeId))
      .limit(1);

    if (!trade) {
      throw new Error(`Paper trade ${tradeId} not found`);
    }

    if (trade.status !== 'OPEN') {
      return this.mapTrade(trade);
    }

    const entryPrice = Number(trade.entryPrice);
    const positionSize = Number(trade.positionSize);
    const direction = trade.direction;

    const notional = closePrice * positionSize;
    const exitFee = Number((notional * this.feeRate).toFixed(4));
    const totalFees = Number(trade.fees) + exitFee;

    const rawPnl =
      direction === 'LONG'
        ? (closePrice - entryPrice) * positionSize
        : (entryPrice - closePrice) * positionSize;

    const netPnl = Number((rawPnl - totalFees).toFixed(4));
    const now = new Date();

    const [updatedTrade] = await db
      .update(paperTrades)
      .set({
        status,
        closePrice: String(closePrice),
        closedAt: now,
        closeReason: reason || status,
        pnl: String(netPnl),
        fees: String(totalFees),
      })
      .where(eq(paperTrades.id, tradeId))
      .returning();

    // Update account balance
    const [account] = await db
      .select()
      .from(paperAccounts)
      .where(eq(paperAccounts.id, trade.accountId!))
      .limit(1);

    if (account) {
      const newBalance = Number(account.balance) + rawPnl - exitFee;
      const newTotalPnl = Number(account.totalPnl) + netPnl;
      await db
        .update(paperAccounts)
        .set({
          balance: String(newBalance.toFixed(2)),
          totalPnl: String(newTotalPnl.toFixed(2)),
          updatedAt: now,
        })
        .where(eq(paperAccounts.id, account.id));
    }

    logger.info(
      { event: 'paper_trade_closed', tradeId, status, netPnl, closePrice },
      'Closed simulated paper trade',
    );

    return this.mapTrade(updatedTrade);
  }

  /**
   * Evaluates all open paper trades for a symbol against incoming high/low prices.
   * If price triggered SL or TP, trade is closed automatically.
   */
  async checkOpenTrades(symbol: string, high: number, low: number): Promise<PaperTrade[]> {
    const openTrades = await db
      .select()
      .from(paperTrades)
      .where(and(eq(paperTrades.symbol, symbol), eq(paperTrades.status, 'OPEN')));

    const closed: PaperTrade[] = [];

    for (const trade of openTrades) {
      const stopLoss = Number(trade.stopLoss);
      const takeProfit = Number(trade.takeProfit);
      const direction = trade.direction;

      if (direction === 'LONG') {
        if (low <= stopLoss) {
          const res = await this.closeTrade(trade.id, stopLoss, 'SL', 'Stop loss hit');
          closed.push(res);
        } else if (high >= takeProfit) {
          const res = await this.closeTrade(trade.id, takeProfit, 'TP', 'Take profit hit');
          closed.push(res);
        }
      } else {
        // SHORT
        if (high >= stopLoss) {
          const res = await this.closeTrade(trade.id, stopLoss, 'SL', 'Stop loss hit');
          closed.push(res);
        } else if (low <= takeProfit) {
          const res = await this.closeTrade(trade.id, takeProfit, 'TP', 'Take profit hit');
          closed.push(res);
        }
      }
    }

    return closed;
  }

  /**
   * Helper to compute unrealized PnL.
   */
  computeUnrealizedPnl(
    direction: 'LONG' | 'SHORT',
    entryPrice: number,
    currentPrice: number,
    positionSize: number,
  ): number {
    return direction === 'LONG'
      ? (currentPrice - entryPrice) * positionSize
      : (entryPrice - currentPrice) * positionSize;
  }

  private mapTrade(r: typeof paperTrades.$inferSelect): PaperTrade {
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
}
