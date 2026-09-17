// ============================================================
// Prediction Worker — Queries ML service and stores predictions
// ============================================================
import { Worker, type Job } from 'bullmq';
import { getRedisClient } from '../services/redis';
import { db } from '../db';
import { predictions } from '../db/schema';
import { signalQueue } from './queues';
import { config } from '../config';
import { logger } from '../services/logger';

interface PredictionJobData {
  symbol: string;
  timeframe: string;
  timestamp: string | Date;
  features: Record<string, number>;
  currentPrice: number;
  atr14: number;
  rsi14: number;
}

export function createPredictionWorker() {
  const connection = getRedisClient();

  return new Worker<PredictionJobData>(
    'predictions',
    async (job: Job<PredictionJobData>) => {
      const { symbol, timeframe, features: feat, currentPrice, atr14, rsi14 } = job.data;
      const timestamp = new Date(job.data.timestamp);

      let probUp = 0.5;
      let probDown = 0.5;
      let probNeutral = 0.0;
      let confidence = 0.5;
      let expectedVol = feat.atr_14_pct || 0.01;
      let marketRegime = feat.trend_direction > 0 ? 'TREND_UP' : 'TREND_DOWN';
      let modelVersion = 'baseline_v1';
      let isDemo = true;

      // Try contacting Python ML service
      try {
        const response = await fetch(`${config.mlServiceUrl}/predict`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            symbol,
            timeframe,
            features: feat,
            model_name: 'direction',
            features_version: 'v1',
          }),
          signal: AbortSignal.timeout(3000),
        });

        if (response.ok) {
          const data = (await response.json()) as any;
          probUp = data.probability_up;
          probDown = data.probability_down;
          probNeutral = data.probability_neutral ?? 0;
          confidence = data.confidence;
          expectedVol = data.expected_volatility ?? expectedVol;
          marketRegime = data.market_regime ?? marketRegime;
          modelVersion = data.model_version ?? 'ml_service_v1';
          isDemo = data.is_demo ?? false;
        } else {
          logger.warn(
            { event: 'ml_service_http_warn', status: response.status },
            'ML service returned non-200, using deterministic baseline',
          );
        }
      } catch (err: any) {
        // Fallback to deterministic technical baseline if ML service offline
        const trend = feat.trend_direction || 0;
        const rsi = rsi14 || 50;

        if (trend > 0 && rsi > 50) {
          probUp = 0.74;
          probDown = 0.26;
        } else if (trend < 0 && rsi < 50) {
          probUp = 0.28;
          probDown = 0.72;
        } else {
          probUp = 0.48;
          probDown = 0.52;
        }
        confidence = Number(Math.abs(probUp - probDown).toFixed(4)) + 0.35;
        modelVersion = 'deterministic_baseline_v1';
      }

      // Save prediction
      let predictionId = '';
      try {
        const [saved] = await db
          .insert(predictions)
          .values({
            symbol,
            timeframe,
            timestamp,
            probabilityUp: String(probUp),
            probabilityDown: String(probDown),
            probabilityNeutral: String(probNeutral),
            confidence: String(confidence),
            expectedVolatility: String(expectedVol),
            marketRegime,
            modelVersion,
            featuresVersion: 'v1',
            horizon: '1h',
            isDemo,
          })
          .returning({ id: predictions.id });

        if (saved) predictionId = saved.id;
      } catch (err: any) {
        logger.error({ event: 'prediction_save_err', err: err.message }, 'Failed to save prediction');
      }

      // Enqueue signal evaluation
      await signalQueue.add('evaluate-signal', {
        predictionId,
        symbol,
        timeframe,
        timestamp,
        probabilityUp: probUp,
        probabilityDown: probDown,
        probabilityNeutral: probNeutral,
        confidence,
        expectedVolatility: expectedVol,
        marketRegime,
        currentPrice,
        atr14,
        rsi14,
        modelVersion,
        isDemo,
      });

      return { predictionId, probUp, probDown, confidence };
    },
    {
      connection,
      concurrency: 2,
    },
  );
}
