// ============================================================
// Backtest Engine — Historical Simulation with No Look-Ahead Bias
// ============================================================
import type { BacktestConfig, BacktestResult, Candle, Timeframe } from '@trading/shared';
import { SignalEngine } from '../signal/SignalEngine';
import { RiskManager } from '../risk/RiskManager';
import type { InstrumentSpec, PositionSizeResult } from '../risk/types';
import type { SignalInput } from '../signal/types';

export interface BacktestTradeExecution {
  timestamp: Date;
  symbol: string;
  direction: 'LONG' | 'SHORT';
  entryPrice: number;
  exitPrice: number;
  stopLoss: number;
  takeProfit: number;
  positionSize: number;
  pnl: number;
  fees: number;
  slippage: number;
  exitReason: 'TP' | 'SL' | 'END_OF_DATA';
  durationSeconds: number;
}

export class BacktestEngine {
  /**
   * Run backtest simulation on historical candles.
   *
   * RULES:
   * 1. Causal progression: candle at index i only sees indices <= i.
   * 2. Execution delay: orders trigger at the OPEN of candle i+1 after signal at candle i.
   * 3. Slippage & Commission modeled realistically.
   * 4. Intra-bar SL/TP execution checks: evaluates candle high & low.
   */
  async run(
    config: BacktestConfig,
    candles: Candle[],
    spec: InstrumentSpec,
  ): Promise<{ result: BacktestResult; trades: BacktestTradeExecution[] }> {
    if (!candles || candles.length < 50) {
      throw new Error(`Insufficient historical candles for backtesting (${candles?.length ?? 0} provided, min 50 required)`);
    }

    const startingBalance = config.startingBalance || 10_000;
    let balance = startingBalance;
    let maxBalance = startingBalance;
    let maxDrawdown = 0;

    const trades: BacktestTradeExecution[] = [];
    const equityCurve: Array<{ timestamp: Date; equity: number }> = [
      { timestamp: new Date(candles[0].timestamp), equity: startingBalance },
    ];

    const signalEngine = new SignalEngine({
      minConfidence: 0.65,
      minRR: 1.5,
      signalCooldownMinutes: 15,
      maxSignalsPerSymbolPerHour: 4,
    });

    const riskManager = new RiskManager({
      accountBalance: balance,
      riskPerTrade: config.riskPerTrade || 1.0,
      maxDailyLoss: 5.0,
      maxOpenPositions: 1,
      maxDrawdown: 20.0,
      defaultRR: 2.0,
    });

    let openTrade: {
      direction: 'LONG' | 'SHORT';
      entryPrice: number;
      stopLoss: number;
      takeProfit: number;
      positionSize: number;
      entryTime: Date;
      fees: number;
      slippage: number;
    } | null = null;

    let pendingSignal: {
      direction: 'LONG' | 'SHORT';
      calc: PositionSizeResult;
      timestamp: Date;
    } | null = null;

    // Simulation loop through candles
    for (let i = 20; i < candles.length; i++) {
      const currentCandle = candles[i];
      const candleTime = new Date(currentCandle.timestamp);

      // 1. If there is a pending signal from previous candle, enter at CURRENT candle's OPEN (Execution Delay)
      if (pendingSignal && !openTrade) {
        const rawEntry = Number(currentCandle.open);
        const slippageVal = rawEntry * (config.slippage || 0.0001);
        const executedEntry =
          pendingSignal.direction === 'LONG'
            ? rawEntry + slippageVal
            : rawEntry - slippageVal;

        const notional = executedEntry * pendingSignal.calc.positionSize;
        const entryFee = notional * (config.commission || 0.0002);

        openTrade = {
          direction: pendingSignal.direction,
          entryPrice: executedEntry,
          stopLoss: pendingSignal.calc.stopLoss,
          takeProfit: pendingSignal.calc.takeProfit,
          positionSize: pendingSignal.calc.positionSize,
          entryTime: candleTime,
          fees: entryFee,
          slippage: slippageVal,
        };
        pendingSignal = null;
      }

      // 2. If trade is open, check if high/low hit TP or SL
      if (openTrade) {
        const high = Number(currentCandle.high);
        const low = Number(currentCandle.low);
        let exitPrice: number | null = null;
        let exitReason: 'TP' | 'SL' | null = null;

        if (openTrade.direction === 'LONG') {
          if (low <= openTrade.stopLoss) {
            exitPrice = openTrade.stopLoss;
            exitReason = 'SL';
          } else if (high >= openTrade.takeProfit) {
            exitPrice = openTrade.takeProfit;
            exitReason = 'TP';
          }
        } else {
          // SHORT
          if (high >= openTrade.stopLoss) {
            exitPrice = openTrade.stopLoss;
            exitReason = 'SL';
          } else if (low <= openTrade.takeProfit) {
            exitPrice = openTrade.takeProfit;
            exitReason = 'TP';
          }
        }

        if (exitPrice !== null && exitReason !== null) {
          const exitNotional = exitPrice * openTrade.positionSize;
          const exitFee = exitNotional * (config.commission || 0.0002);
          const totalFees = openTrade.fees + exitFee;

          const rawPnl =
            openTrade.direction === 'LONG'
              ? (exitPrice - openTrade.entryPrice) * openTrade.positionSize
              : (openTrade.entryPrice - exitPrice) * openTrade.positionSize;

          const netPnl = rawPnl - totalFees;
          balance += netPnl;

          const duration = Math.max(
            1,
            Math.round((candleTime.getTime() - openTrade.entryTime.getTime()) / 1000),
          );

          trades.push({
            timestamp: candleTime,
            symbol: config.symbol,
            direction: openTrade.direction,
            entryPrice: openTrade.entryPrice,
            exitPrice,
            stopLoss: openTrade.stopLoss,
            takeProfit: openTrade.takeProfit,
            positionSize: openTrade.positionSize,
            pnl: netPnl,
            fees: totalFees,
            slippage: openTrade.slippage,
            exitReason,
            durationSeconds: duration,
          });

          openTrade = null;
        }
      }

      // 3. Compute indicators from past data only [0..i]
      if (!openTrade && !pendingSignal) {
        const pastWindow = candles.slice(Math.max(0, i - 50), i + 1);
        const closes = pastWindow.map((c) => Number(c.close));
        const currentClose = closes[closes.length - 1];

        // Simplified causal indicator estimation on window
        const atr14 = this.calcATR(pastWindow, 14);
        const rsi14 = this.calcRSI(closes, 14);
        const sma20 = closes.slice(-20).reduce((a, b) => a + b, 0) / Math.min(closes.length, 20);
        const trendDir = currentClose > sma20 ? 1 : -1;

        // Probabilities based on causal momentum
        const probUp = trendDir > 0 ? (rsi14 > 50 ? 0.72 : 0.58) : 0.35;
        const probDown = 1.0 - probUp;
        const confidence = Math.abs(probUp - probDown) + 0.35;

        const input: SignalInput = {
          symbol: config.symbol,
          timeframe: config.timeframe,
          timestamp: candleTime,
          probabilityUp: probUp,
          probabilityDown: probDown,
          probabilityNeutral: 0.05,
          confidence,
          expectedVolatility: atr14 / currentClose,
          marketRegime: trendDir > 0 ? 'TREND_UP' : 'TREND_DOWN',
          currentPrice: currentClose,
          atr14,
          rsi14,
          trendDirection: trendDir,
          adx14: 28,
          macdHistogram: trendDir > 0 ? 0.5 : -0.5,
          newsSentiment: 0.2,
          socialSentiment: 0.1,
          dataQualityOk: true,
          candleCount: i + 1,
        };

        const signalOutput = signalEngine.evaluate(input);

        if (signalOutput.direction === 'LONG' || signalOutput.direction === 'SHORT') {
          try {
            const sizeCalc = riskManager.calculatePosition(
              spec,
              signalOutput.direction,
              currentClose,
              atr14,
            );
            pendingSignal = {
              direction: signalOutput.direction,
              calc: sizeCalc,
              timestamp: candleTime,
            };
          } catch {
            // Risk limits prevented trade
          }
        }
      }

      // Track drawdown and equity curve
      if (balance > maxBalance) {
        maxBalance = balance;
      }
      const currentDd = maxBalance > 0 ? (maxBalance - balance) / maxBalance : 0;
      if (currentDd > maxDrawdown) {
        maxDrawdown = currentDd;
      }

      equityCurve.push({
        timestamp: candleTime,
        equity: Number(balance.toFixed(2)),
      });
    }

    // Close remaining open trade at end of data if any
    if (openTrade) {
      const lastCandle = candles[candles.length - 1];
      const exitPrice = Number(lastCandle.close);
      const rawPnl =
        openTrade.direction === 'LONG'
          ? (exitPrice - openTrade.entryPrice) * openTrade.positionSize
          : (openTrade.entryPrice - exitPrice) * openTrade.positionSize;
      const totalFees = openTrade.fees;
      const netPnl = rawPnl - totalFees;
      balance += netPnl;

      trades.push({
        timestamp: new Date(lastCandle.timestamp),
        symbol: config.symbol,
        direction: openTrade.direction,
        entryPrice: openTrade.entryPrice,
        exitPrice,
        stopLoss: openTrade.stopLoss,
        takeProfit: openTrade.takeProfit,
        positionSize: openTrade.positionSize,
        pnl: netPnl,
        fees: totalFees,
        slippage: openTrade.slippage,
        exitReason: 'END_OF_DATA',
        durationSeconds: 3600,
      });
    }

    // Metrics computation
    const totalTrades = trades.length;
    const wins = trades.filter((t) => t.pnl > 0);
    const losses = trades.filter((t) => t.pnl < 0);
    const winRate = totalTrades > 0 ? wins.length / totalTrades : 0;

    const totalWinPnl = wins.reduce((acc, t) => acc + t.pnl, 0);
    const totalLossPnl = Math.abs(losses.reduce((acc, t) => acc + t.pnl, 0));
    const profitFactor = totalLossPnl > 0 ? totalWinPnl / totalLossPnl : totalWinPnl > 0 ? 99.9 : 0;

    const netPnl = balance - startingBalance;
    const averageTrade = totalTrades > 0 ? netPnl / totalTrades : 0;
    const largestWin = wins.length > 0 ? Math.max(...wins.map((t) => t.pnl)) : 0;
    const largestLoss = losses.length > 0 ? Math.min(...losses.map((t) => t.pnl)) : 0;

    // Sharpe-like metric (mean return / std return annualized)
    const pnls = trades.map((t) => t.pnl);
    let sharpeRatio = 0;
    if (pnls.length > 1) {
      const mean = pnls.reduce((a, b) => a + b, 0) / pnls.length;
      const variance = pnls.reduce((a, b) => a + Math.pow(b - mean, 2), 0) / (pnls.length - 1);
      const std = Math.sqrt(variance);
      sharpeRatio = std > 0 ? Number(((mean / std) * Math.sqrt(252)).toFixed(2)) : 0;
    }

    const result: BacktestResult = {
      id: '',
      config,
      totalTrades,
      winRate: Number(winRate.toFixed(4)),
      profitFactor: Number(profitFactor.toFixed(2)),
      netPnl: Number(netPnl.toFixed(2)),
      maxDrawdown: Number(maxDrawdown.toFixed(4)),
      averageTrade: Number(averageTrade.toFixed(2)),
      largestWin: Number(largestWin.toFixed(2)),
      largestLoss: Number(largestLoss.toFixed(2)),
      sharpeRatio,
      startingBalance,
      finalBalance: Number(balance.toFixed(2)),
      equityCurve,
      createdAt: new Date(),
      status: 'COMPLETED',
    };

    return { result, trades };
  }

  private calcATR(candles: Candle[], period: number = 14): number {
    if (candles.length < 2) return 1.0;
    const trs: number[] = [];
    for (let i = 1; i < candles.length; i++) {
      const c = candles[i];
      const prev = candles[i - 1];
      const hl = Number(c.high) - Number(c.low);
      const hc = Math.abs(Number(c.high) - Number(prev.close));
      const lc = Math.abs(Number(c.low) - Number(prev.close));
      trs.push(Math.max(hl, hc, lc));
    }
    const recentTrs = trs.slice(-period);
    return recentTrs.reduce((a, b) => a + b, 0) / Math.max(recentTrs.length, 1);
  }

  private calcRSI(closes: number[], period: number = 14): number {
    if (closes.length < period + 1) return 50;
    let gains = 0;
    let losses = 0;
    for (let i = closes.length - period; i < closes.length; i++) {
      const diff = closes[i] - closes[i - 1];
      if (diff >= 0) gains += diff;
      else losses += Math.abs(diff);
    }
    if (losses === 0) return 100;
    const rs = gains / losses;
    return 100 - 100 / (1 + rs);
  }
}
