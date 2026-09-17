// ============================================================
// Seed Demo Data — idempotent
// ============================================================
import 'dotenv/config';
import { db } from '../db';
import { instruments, providerStatus, modelVersions } from '../db/schema';
import { sql } from 'drizzle-orm';
import { logger } from '../services/logger';

async function seedInstruments(): Promise<void> {
  const items = [
    {
      symbol: 'XAU/USD',
      displayName: 'Gold / US Dollar',
      assetType: 'COMMODITY',
      baseAsset: 'XAU',
      quoteAsset: 'USD',
      exchange: 'FOREX',
      provider: 'demo',
      currency: 'USD',
      tickSize: '0.01',
      lotSize: '1',
      contractSize: '100',
      minimumOrderSize: '0.01',
      pricePrecision: 2,
      quantityPrecision: 2,
      isActive: true,
    },
    {
      symbol: 'BTC/USDT',
      displayName: 'Bitcoin / Tether USD',
      assetType: 'CRYPTO',
      baseAsset: 'BTC',
      quoteAsset: 'USDT',
      exchange: 'BINANCE',
      provider: 'demo',
      currency: 'USDT',
      tickSize: '0.01',
      lotSize: '0.001',
      contractSize: '1',
      minimumOrderSize: '0.001',
      pricePrecision: 2,
      quantityPrecision: 5,
      isActive: true,
    },
    {
      symbol: 'ETH/USDT',
      displayName: 'Ethereum / Tether USD',
      assetType: 'CRYPTO',
      baseAsset: 'ETH',
      quoteAsset: 'USDT',
      exchange: 'BINANCE',
      provider: 'demo',
      currency: 'USDT',
      tickSize: '0.01',
      lotSize: '0.01',
      contractSize: '1',
      minimumOrderSize: '0.01',
      pricePrecision: 2,
      quantityPrecision: 4,
      isActive: true,
    },
    {
      symbol: 'EUR/USD',
      displayName: 'Euro / US Dollar',
      assetType: 'FOREX',
      baseAsset: 'EUR',
      quoteAsset: 'USD',
      exchange: 'FOREX',
      provider: 'demo',
      currency: 'USD',
      tickSize: '0.00001',
      lotSize: '1000',
      contractSize: '100000',
      minimumOrderSize: '0.01',
      pricePrecision: 5,
      quantityPrecision: 2,
      isActive: true,
    },
  ];

  for (const item of items) {
    await db
      .insert(instruments)
      .values(item)
      .onConflictDoUpdate({
        target: instruments.symbol,
        set: {
          displayName: sql`EXCLUDED.display_name`,
          isActive: sql`EXCLUDED.is_active`,
        },
      });
  }
  logger.info({ event: 'seed_instruments', count: items.length }, 'Instruments seeded');
}

async function seedProviderStatus(): Promise<void> {
  const providers = [
    { name: 'market_data', status: 'ONLINE', message: 'Demo mode — synthetic data' },
    { name: 'news', status: 'ONLINE', message: 'Demo mode — synthetic news' },
    { name: 'social', status: 'UNAVAILABLE', message: 'Social provider disabled' },
    { name: 'ml_service', status: 'ONLINE', message: 'ML service running' },
    { name: 'telegram', status: 'UNAVAILABLE', message: 'Telegram token not configured' },
  ];

  for (const provider of providers) {
    await db
      .insert(providerStatus)
      .values({
        name: provider.name,
        status: provider.status,
        lastCheck: new Date(),
        message: provider.message,
        updatedAt: new Date(),
      })
      .onConflictDoUpdate({
        target: providerStatus.name,
        set: {
          message: sql`EXCLUDED.message`,
          updatedAt: sql`now()`,
        },
      });
  }
  logger.info({ event: 'seed_providers', count: providers.length }, 'Provider statuses seeded');
}

async function seedModelVersions(): Promise<void> {
  const now = new Date();
  const trainingStart = new Date(now.getTime() - 30 * 24 * 60 * 60 * 1000); // 30 days ago

  await db
    .insert(modelVersions)
    .values({
      modelName: 'xgboost_classifier',
      version: 'v0.1.0-demo',
      artifactPath: 'models/artifacts/xgboost_v0.1.0-demo.pkl',
      featuresVersion: 'v1',
      trainingStart,
      trainingEnd: now,
      validationMetrics: {
        accuracy: 0.0,
        auc_roc: 0.0,
        precision: 0.0,
        recall: 0.0,
        f1: 0.0,
      },
      testMetrics: {
        accuracy: 0.0,
        auc_roc: 0.0,
        precision: 0.0,
        recall: 0.0,
        f1: 0.0,
      },
      hyperparameters: {
        n_estimators: 0,
        max_depth: 0,
        learning_rate: 0.0,
        note: 'Placeholder — train a real model with apps/ml',
      },
      isActive: false,
    })
    .onConflictDoUpdate({
      target: [modelVersions.modelName, modelVersions.version],
      set: { isActive: sql`EXCLUDED.is_active` },
    });

  logger.info({ event: 'seed_models' }, 'Model version placeholder seeded');
}

async function main(): Promise<void> {
  logger.info({ event: 'seed_start' }, 'Starting demo seed');
  await seedInstruments();
  await seedProviderStatus();
  await seedModelVersions();
  logger.info({ event: 'seed_complete' }, 'Demo seed complete');
  process.exit(0);
}

main().catch((err) => {
  logger.fatal({ err }, 'Seed failed');
  process.exit(1);
});
