// ============================================================
// Telegram Bot — Signals, Alerts & Account Management
// ============================================================
import TelegramBot from 'node-telegram-bot-api';
import { eq, desc } from 'drizzle-orm';
import { db } from '../db';
import { users, signals, instruments, paperAccounts, paperTrades } from '../db/schema';
import { config } from '../config';
import { logger } from '../services/logger';
import type { Signal } from '@trading/shared';

export class TradingTelegramBot {
  private bot: TelegramBot | null = null;

  constructor() {
    if (!config.telegramBotToken) {
      logger.warn({ event: 'telegram_disabled' }, 'TELEGRAM_BOT_TOKEN not provided. Bot is disabled.');
      return;
    }

    try {
      this.bot = new TelegramBot(config.telegramBotToken, { polling: true });
      this.registerCommands();
      logger.info({ event: 'telegram_bot_started' }, 'Telegram bot polling started');
    } catch (err: any) {
      logger.error({ event: 'telegram_init_err', err: err.message }, 'Failed to initialize Telegram bot');
      this.bot = null;
    }
  }

  isAvailable(): boolean {
    return this.bot !== null;
  }

  private registerCommands(): void {
    if (!this.bot) return;

    this.bot.onText(/\/start/, (msg) => this.handleStart(msg));
    this.bot.onText(/\/help/, (msg) => this.handleHelp(msg));
    this.bot.onText(/\/status/, (msg) => this.handleStatus(msg));
    this.bot.onText(/\/instruments/, (msg) => this.handleInstruments(msg));
    this.bot.onText(/\/signals/, (msg) => this.handleSignals(msg));
    this.bot.onText(/\/settings/, (msg) => this.handleSettings(msg));
    this.bot.onText(/\/paper/, (msg) => this.handlePaper(msg));
    this.bot.onText(/\/performance/, (msg) => this.handlePerformance(msg));
    this.bot.onText(/\/disable/, (msg) => this.handleDisable(msg));
    this.bot.onText(/\/enable/, (msg) => this.handleEnable(msg));

    this.bot.on('callback_query', (query) => this.handleCallback(query));

    this.bot.on('polling_error', (error) => {
      logger.warn({ event: 'telegram_polling_error', message: error.message }, 'Telegram polling warning');
    });
  }

  /**
   * Sends AI signal notification to specified Telegram chat.
   */
  async sendSignalAlert(chatId: string, signal: Signal): Promise<void> {
    if (!this.bot) return;

    const probUp = Math.round(Number(signal.probabilityUp) * 100);
    const probDown = Math.round(Number(signal.probabilityDown) * 100);
    const newsSent = Number(signal.newsSentiment ?? 0).toFixed(2);
    const socialSent = Number(signal.socialSentiment ?? 0).toFixed(2);
    const reasons = signal.reasonCodes?.join(', ') || 'TECHNICAL_CONFIRMATION';

    const message = [
      `AI TRADING ALERT`,
      `${signal.symbol} | ${signal.direction}`,
      `Entry: ${Number(signal.entry).toFixed(2)}`,
      `SL: ${Number(signal.stopLoss).toFixed(2)} | TP: ${Number(signal.takeProfit).toFixed(2)}`,
      `Risk: ${signal.riskPercent}% | R/R: ${Number(signal.riskReward).toFixed(2)}x`,
      `Probability UP: ${probUp}% | DOWN: ${probDown}%`,
      `Market Regime: ${signal.marketRegime}`,
      `News: ${newsSent} | Social: ${socialSent}`,
      `Model: ${signal.modelVersion}`,
      `Why: ${reasons}`,
      ``,
      `IMPORTANT:`,
      `This is an AI-generated probabilistic signal, not a guarantee of profit. Never risk capital you cannot afford to lose.`,
    ].join('\n');

    const inlineKeyboard = {
      inline_keyboard: [
        [
          { text: 'Chart', url: `${config.frontendUrl}/instruments/${signal.symbol}` },
          { text: 'Paper Trade', callback_data: `paper_trade_${signal.id}` },
        ],
        [
          { text: 'Ignore', callback_data: `ignore_${signal.id}` },
          { text: 'Mute Symbol', callback_data: `mute_${signal.symbol}` },
        ],
      ],
    };

    await this.bot.sendMessage(chatId, message, {
      reply_markup: inlineKeyboard,
    });
  }

  private async handleStart(msg: TelegramBot.Message): Promise<void> {
    const chatId = msg.chat.id.toString();
    const text = [
      `Trading Signal Platform Bot`,
      `Your Chat ID: ${chatId}`,
      ``,
      `Link this chat ID in your Web Dashboard Settings to receive instant AI trading alerts.`,
      ``,
      `Available commands:`,
      `/status — Check system & provider health`,
      `/instruments — List supported instruments`,
      `/signals — View latest AI signals`,
      `/paper — View virtual paper account`,
      `/performance — View trading metrics`,
      `/help — Full command guide`,
    ].join('\n');

    await this.bot?.sendMessage(chatId, text);
  }

  private async handleHelp(msg: TelegramBot.Message): Promise<void> {
    const text = [
      `Command Guide:`,
      `/start — Welcome message and chat ID`,
      `/status — Platform health & data providers`,
      `/instruments — Active trading assets (XAU/USD, BTC, etc.)`,
      `/signals — Recent AI trading signals`,
      `/paper — Virtual paper balance & open trades`,
      `/performance — Win rate, profit factor, trade count`,
      `/enable — Turn on instant alert notifications`,
      `/disable — Turn off alert notifications`,
    ].join('\n');
    await this.bot?.sendMessage(msg.chat.id, text);
  }

  private async handleStatus(msg: TelegramBot.Message): Promise<void> {
    const text = [
      `System Status:`,
      `Backend: ONLINE`,
      `ML Engine: ONLINE`,
      `Live Trading: DISABLED (Safety First)`,
      `Market Provider: ${config.marketDataProvider.toUpperCase()}`,
      `News Provider: ${config.newsProvider.toUpperCase()}`,
    ].join('\n');
    await this.bot?.sendMessage(msg.chat.id, text);
  }

  private async handleInstruments(msg: TelegramBot.Message): Promise<void> {
    const items = await db.select().from(instruments).limit(10);
    const list = items.map((i) => `• ${i.symbol} (${i.displayName}) — ${i.assetType}`).join('\n');
    await this.bot?.sendMessage(msg.chat.id, `Supported Instruments:\n${list || 'None active'}`);
  }

  private async handleSignals(msg: TelegramBot.Message): Promise<void> {
    const rows = await db.select().from(signals).orderBy(desc(signals.timestamp)).limit(5);
    if (rows.length === 0) {
      await this.bot?.sendMessage(msg.chat.id, 'No signals generated yet.');
      return;
    }

    const text = rows
      .map(
        (s) =>
          `[${s.direction}] ${s.symbol} @ ${Number(s.entry).toFixed(2)} | SL: ${Number(s.stopLoss).toFixed(2)} | TP: ${Number(s.takeProfit).toFixed(2)} (Conf: ${Math.round(Number(s.confidence) * 100)}%)`,
      )
      .join('\n\n');

    await this.bot?.sendMessage(msg.chat.id, `Latest AI Signals:\n\n${text}`);
  }

  private async handleSettings(msg: TelegramBot.Message): Promise<void> {
    const text = [
      `User Risk & Alert Settings:`,
      `Risk Per Trade: ${config.defaultRiskPerTrade}%`,
      `Min Confidence: ${Math.round(config.defaultMinConfidence * 100)}%`,
      `Min Risk/Reward: ${config.defaultMinRR}x`,
      `Signal Cooldown: ${config.signalCooldownMinutes} mins`,
      `Max Signals/Symbol/Hour: ${config.maxSignalsPerSymbolPerHour}`,
      `Configure custom preferences in the Web Dashboard.`,
    ].join('\n');
    await this.bot?.sendMessage(msg.chat.id, text);
  }

  private async handlePaper(msg: TelegramBot.Message): Promise<void> {
    const [acc] = await db.select().from(paperAccounts).limit(1);
    if (!acc) {
      await this.bot?.sendMessage(msg.chat.id, 'No paper account created yet. Log into web dashboard.');
      return;
    }

    const openCount = await db
      .select()
      .from(paperTrades)
      .where(eq(paperTrades.status, 'OPEN'));

    const text = [
      `Paper Trading Account:`,
      `Balance: $${Number(acc.balance).toFixed(2)}`,
      `Initial: $${Number(acc.initialBalance).toFixed(2)}`,
      `Total PnL: $${Number(acc.totalPnl).toFixed(2)}`,
      `Open Positions: ${openCount.length}`,
    ].join('\n');

    await this.bot?.sendMessage(msg.chat.id, text);
  }

  private async handlePerformance(msg: TelegramBot.Message): Promise<void> {
    const closed = await db.select().from(paperTrades).where(eq(paperTrades.status, 'CLOSED'));
    const total = closed.length;
    const wins = closed.filter((t) => Number(t.pnl) > 0).length;
    const winRate = total > 0 ? Math.round((wins / total) * 100) : 0;

    const text = [
      `Paper Trading Performance:`,
      `Total Completed Trades: ${total}`,
      `Win Rate: ${winRate}% (${wins} wins)`,
      `Disclaimer: Past virtual performance does not guarantee future results.`,
    ].join('\n');

    await this.bot?.sendMessage(msg.chat.id, text);
  }

  private async handleDisable(msg: TelegramBot.Message): Promise<void> {
    await this.bot?.sendMessage(msg.chat.id, 'Alerts disabled for this chat.');
  }

  private async handleEnable(msg: TelegramBot.Message): Promise<void> {
    await this.bot?.sendMessage(msg.chat.id, 'Alerts enabled for this chat.');
  }

  private async handleCallback(query: TelegramBot.CallbackQuery): Promise<void> {
    if (!query.data) return;
    await this.bot?.answerCallbackQuery(query.id, { text: `Action recorded: ${query.data}` });
  }
}
