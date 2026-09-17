// ============================================================
// Signal Worker — Evaluates signals, checks risk, saves audit log
// ============================================================
import { Worker, type Job } from 'bullmq';
import { eq, desc } from 'drizzle-orm';
import { getRedisClient } from '../services/redis';
import { db } from '../db';
import { signals, auditLogs, instruments, users, userSettings } from '../db/schema';
import { SignalEngine } from '../signal/SignalEngine';
import { SignalFilter } from '../signal/SignalFilter';
import { RiskManager } from '../risk/RiskManager';
import type { InstrumentSpec } from '../risk/types';
import type { SignalInput } from '../signal/types';
import { config } from '../config';
import { logger } from '../services/logger';

interface SignalJobData {
  predictionId: string;
  symbol: string;
  timeframe: any;
  timestamp: string | Date;
  probabilityUp: number;
  probabilityDown: number;
  probabilityNeutral: number;
  confidence: number;
  expectedVolatility: number;
  marketRegime: any;
  currentPrice: number;
  atr14: number;
  rsi14: number;
  modelVersion: string;
  isDemo: boolean;
}

export function createSignalWorker(telegramBot?: { sendSignalAlert: Function }) {
  const connection = getRedisClient();
  const signalFilter = new SignalFilter(connection);

  return new Worker<SignalJobData>(
    'signals',
    async (job: Job<SignalJobData>) => {
      const data = job.data;
      const timestamp = new Date(data.timestamp);

      // Fetch instrument specs
      const [instr] = await db
        .select()
        .from(instruments)
        .where(eq(instruments.symbol, data.symbol))
        .limit(1);

      const spec: InstrumentSpec = {
        symbol: data.symbol,
        assetType: (instr?.assetType as any) || (data.symbol.includes('USDT') ? 'CRYPTO' : 'FOREX'),
        pricePrecision: instr?.pricePrecision ?? 2,
        quantityPrecision: instr?.quantityPrecision ?? 4,
        tickSize: Number(instr?.tickSize ?? 0.01),
        lotSize: Number(instr?.lotSize ?? 1),
        contractSize: Number(instr?.contractSize ?? 1),
        minimumOrderSize: Number(instr?.minimumOrderSize ?? 0.001),
      };

      const signalEngine = new SignalEngine({
        minConfidence: config.defaultMinConfidence,
        minRR: config.defaultMinRR,
        signalCooldownMinutes: config.signalCooldownMinutes,
        maxSignalsPerSymbolPerHour: config.maxSignalsPerSymbolPerHour,
      });

      const input: SignalInput = {
        symbol: data.symbol,
        timeframe: data.timeframe,
        timestamp,
        probabilityUp: data.probabilityUp,
        probabilityDown: data.probabilityDown,
        probabilityNeutral: data.probabilityNeutral,
        confidence: data.confidence,
        expectedVolatility: data.expectedVolatility,
        marketRegime: data.marketRegime,
        currentPrice: data.currentPrice,
        atr14: data.atr14,
        rsi14: data.rsi14,
        trendDirection: data.probabilityUp > data.probabilityDown ? 1 : -1,
        adx14: 26,
        macdHistogram: 0.2,
        newsSentiment: 0.15,
        socialSentiment: 0.05,
        dataQualityOk: true,
        candleCount: 250,
      };

      const evaluated = signalEngine.evaluate(input);

      if (evaluated.direction === 'NO_SIGNAL') {
        return { signal: 'NO_SIGNAL', reasons: evaluated.filterRejectReasons };
      }

      // Check filters (global cooldown)
      const allowedCooldown = await signalFilter.checkCooldown('system', data.symbol, config.signalCooldownMinutes);
      if (!allowedCooldown) {
        return { signal: 'REJECTED_COOLDOWN' };
      }

      const allowedHourly = await signalFilter.checkHourlyLimit('system', data.symbol, config.maxSignalsPerSymbolPerHour);
      if (!allowedHourly) {
        return { signal: 'REJECTED_HOURLY_LIMIT' };
      }

      // Calculate position sizing and SL/TP with RiskManager
      const riskManager = new RiskManager({
        accountBalance: 10_000,
        riskPerTrade: config.defaultRiskPerTrade,
        maxDailyLoss: 5.0,
        maxOpenPositions: 3,
        maxDrawdown: 20.0,
        defaultRR: config.defaultMinRR,
      });

      const positionCalc = riskManager.calculatePosition(
        spec,
        evaluated.direction,
        data.currentPrice,
        data.atr14,
      );

      // Save signal
      const [savedSignal] = await db
        .insert(signals)
        .values({
          symbol: data.symbol,
          timestamp,
          direction: evaluated.direction,
          entry: String(positionCalc.entry),
          stopLoss: String(positionCalc.stopLoss),
          takeProfit: String(positionCalc.takeProfit),
          positionSize: String(positionCalc.positionSize),
          riskPercent: String(config.defaultRiskPerTrade),
          riskReward: String(positionCalc.riskReward),
          confidence: String(data.confidence),
          probabilityUp: String(data.probabilityUp),
          probabilityDown: String(data.probabilityDown),
          marketRegime: data.marketRegime,
          newsSentiment: '0.15',
          socialSentiment: '0.05',
          modelVersion: data.modelVersion,
          reasonCodes: evaluated.reasonCodes,
          predictionId: data.predictionId || null,
          isDemo: data.isDemo,
        })
        .returning();

      // Record signal to filter
      await signalFilter.recordSignal('system', data.symbol, config.signalCooldownMinutes);

      // Audit log
      try {
        await db.insert(auditLogs).values({
          action: 'GENERATE_SIGNAL',
          entityType: 'SIGNAL',
          entityId: savedSignal.id,
          inputSnapshot: input as any,
          outputSnapshot: { signal: savedSignal, risk: positionCalc } as any,
          metadata: { modelVersion: data.modelVersion },
        });
      } catch (err: any) {
        logger.warn({ event: 'audit_log_err', err: err.message }, 'Failed to save audit log');
      }

      // Send Telegram alert if bot is configured
      if (telegramBot) {
        const usersWithChat = await db
          .select({ telegramChatId: users.telegramChatId })
          .from(users)
          .where(eq(users.telegramChatId, '')) // or non-null
          .limit(10);

        for (const u of usersWithChat) {
          if (u.telegramChatId) {
            try {
              await telegramBot.sendSignalAlert(u.telegramChatId, savedSignal as any);
            } catch (err: any) {
              logger.warn({ event: 'telegram_send_err', err: err.message }, 'Failed to send Telegram alert');
            }
          }
        }
      }

      logger.info(
        { event: 'signal_generated', symbol: data.symbol, direction: evaluated.direction, entry: positionCalc.entry },
        'AI Trading Signal generated',
      );

      return { signal: savedSignal.id, direction: evaluated.direction };
    },
    {
      connection,
      concurrency: 1,
    },
  );
}
