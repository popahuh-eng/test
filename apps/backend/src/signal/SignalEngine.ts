// ============================================================
// Signal Engine — evaluates ML predictions and generates signals
// ============================================================
import { SignalInput, SignalOutput, SignalConfig } from './types';
import { SignalDirection } from '@trading/shared';

export class SignalEngine {
  constructor(private readonly config: SignalConfig) {}

  /**
   * Evaluate whether to generate a trading signal from ML predictions + context.
   *
   * Pipeline:
   *  1. Data quality gate
   *  2. Direction candidate from probabilities
   *  3. Confidence filter
   *  4. Market regime annotation
   *  5. Technical alignment annotation
   *  6. Sentiment alignment annotation
   *  7. Return SignalOutput (direction may be NO_SIGNAL with reasons)
   *
   * SL/TP/position sizing is NOT performed here — caller must apply RiskManager.
   */
  evaluate(input: SignalInput): SignalOutput {
    const reasonCodes:    string[] = [];
    const rejectReasons:  string[] = [];

    // ── 1. Data quality gate ─────────────────────────────
    if (!input.dataQualityOk) {
      return this.noSignal(rejectReasons, ['DATA_QUALITY_FAILED']);
    }
    if (input.candleCount < 200) {
      return this.noSignal(rejectReasons, ['INSUFFICIENT_CANDLES', `INSUFFICIENT_CANDLES:${input.candleCount}`]);
    }

    // ── 2. Direction candidate ───────────────────────────
    const direction = this.determineDirection(input, reasonCodes, rejectReasons);
    if (direction === 'NO_SIGNAL') {
      return this.noSignal(rejectReasons, []);
    }

    // ── 3. Confidence filter ─────────────────────────────
    if (input.confidence < this.config.minConfidence) {
      return this.noSignal(rejectReasons, [
        `CONFIDENCE_TOO_LOW:${input.confidence.toFixed(4)}<${this.config.minConfidence}`,
      ]);
    }
    reasonCodes.push(`CONFIDENCE:${input.confidence.toFixed(3)}`);

    // ── 4. Market regime compatibility ───────────────────
    this.checkRegimeCompatibility(input, direction, reasonCodes, rejectReasons);

    // ── 5. Technical alignment ───────────────────────────
    this.checkTechnicalAlignment(input, direction, reasonCodes);

    // ── 6. Sentiment alignment ───────────────────────────
    this.checkSentimentAlignment(input, direction, reasonCodes);

    return {
      direction,
      entry:         input.currentPrice,
      stopLoss:      0,   // filled by RiskManager
      takeProfit:    0,   // filled by RiskManager
      positionSize:  0,   // filled by RiskManager
      riskPercent:   0,
      riskReward:    0,
      reasonCodes,
      filterRejectReasons: rejectReasons,
    };
  }

  // ── Private helpers ───────────────────────────────────

  private determineDirection(
    input: SignalInput,
    reasonCodes: string[],
    rejectReasons: string[],
  ): SignalDirection {
    const { probabilityUp, probabilityDown, probabilityNeutral } = input;
    const threshold = 0.50;

    if (probabilityUp > probabilityDown && probabilityUp > threshold) {
      reasonCodes.push(`PROB_UP:${probabilityUp.toFixed(3)}`);
      return 'LONG';
    }

    if (probabilityDown > probabilityUp && probabilityDown > threshold) {
      reasonCodes.push(`PROB_DOWN:${probabilityDown.toFixed(3)}`);
      return 'SHORT';
    }

    rejectReasons.push(
      `NO_DOMINANT_DIRECTION:up=${probabilityUp.toFixed(3)},dn=${probabilityDown.toFixed(3)},neutral=${probabilityNeutral.toFixed(3)}`,
    );
    return 'NO_SIGNAL';
  }

  private checkRegimeCompatibility(
    input: SignalInput,
    direction: SignalDirection,
    reasonCodes: string[],
    _rejectReasons: string[],
  ): void {
    const { marketRegime } = input;

    if (
      (marketRegime === 'TREND_UP'   && direction === 'LONG')  ||
      (marketRegime === 'TREND_DOWN' && direction === 'SHORT')
    ) {
      reasonCodes.push('REGIME_ALIGNED');
    } else if (
      (marketRegime === 'TREND_UP'   && direction === 'SHORT') ||
      (marketRegime === 'TREND_DOWN' && direction === 'LONG')
    ) {
      reasonCodes.push('REGIME_COUNTER_TREND');
    }

    if (marketRegime === 'HIGH_VOLATILITY') {
      reasonCodes.push('VOLATILITY_WARNING');
    }

    if (marketRegime === 'RANGE') {
      reasonCodes.push('REGIME_RANGE');
    }
  }

  private checkTechnicalAlignment(
    input: SignalInput,
    direction: SignalDirection,
    reasonCodes: string[],
  ): void {
    const { rsi14, adx14, macdHistogram, trendDirection } = input;

    if ((direction === 'LONG' && rsi14 > 50 && macdHistogram > 0) || (direction === 'SHORT' && rsi14 < 50 && macdHistogram < 0)) {
      reasonCodes.push('MOMENTUM_CONFIRMED');
    }

    // RSI — not at extreme that works against us
    if (direction === 'LONG'  && rsi14 > 30 && rsi14 < 80) {
      reasonCodes.push('RSI_POSITIVE');
    } else if (direction === 'SHORT' && rsi14 < 70 && rsi14 > 20) {
      reasonCodes.push('RSI_NEGATIVE');
    }

    // ADX — trend strength
    if (adx14 >= 25) {
      reasonCodes.push('TREND_STRONG');
    } else if (adx14 >= 20) {
      reasonCodes.push('TREND_MODERATE');
    }

    // MACD histogram
    if (direction === 'LONG'  && macdHistogram > 0) {
      reasonCodes.push('MACD_BULLISH');
    } else if (direction === 'SHORT' && macdHistogram < 0) {
      reasonCodes.push('MACD_BEARISH');
    }

    // Trend direction field from feature engineering
    if (direction === 'LONG'  && trendDirection === 1) {
      reasonCodes.push('TREND_UP_CONFIRMED');
    } else if (direction === 'SHORT' && trendDirection === -1) {
      reasonCodes.push('TREND_DOWN_CONFIRMED');
    }
  }

  private checkSentimentAlignment(
    input: SignalInput,
    direction: SignalDirection,
    reasonCodes: string[],
  ): void {
    const { newsSentiment, socialSentiment } = input;

    if (newsSentiment !== null) {
      if (direction === 'LONG'  && newsSentiment > 0.1) {
        reasonCodes.push('NEWS_POSITIVE');
        reasonCodes.push(`NEWS_POSITIVE:${newsSentiment.toFixed(2)}`);
      } else if (direction === 'SHORT' && newsSentiment < -0.1) {
        reasonCodes.push('NEWS_NEGATIVE');
        reasonCodes.push(`NEWS_NEGATIVE:${newsSentiment.toFixed(2)}`);
      }
    }

    if (socialSentiment !== null) {
      if (direction === 'LONG'  && socialSentiment > 0.1) {
        reasonCodes.push(`SOCIAL_BULLISH:${socialSentiment.toFixed(2)}`);
      } else if (direction === 'SHORT' && socialSentiment < -0.1) {
        reasonCodes.push(`SOCIAL_BEARISH:${socialSentiment.toFixed(2)}`);
      }
    }
  }

  private noSignal(existing: string[], newReasons: string[]): SignalOutput {
    return {
      direction:           'NO_SIGNAL',
      entry:               0,
      stopLoss:            0,
      takeProfit:          0,
      positionSize:        0,
      riskPercent:         0,
      riskReward:          0,
      reasonCodes:         [],
      filterRejectReasons: [...existing, ...newReasons],
    };
  }
}
