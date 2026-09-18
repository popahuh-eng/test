// ============================================================
// Database client — Dual-mode: PostgreSQL Pool + PGlite Fallback
// ============================================================
import fs from 'node:fs';
import path from 'node:path';
import { drizzle as drizzlePg } from 'drizzle-orm/node-postgres';
import { drizzle as drizzlePglite } from 'drizzle-orm/pglite';
import { Pool } from 'pg';
import { PGlite } from '@electric-sql/pglite';
import { config } from '../config';
import * as schema from './schema';
import { logger } from '../services/logger';

export const pool = new Pool({
  connectionString: config.databaseUrl,
  max: 20,
  idleTimeoutMillis: 30_000,
  connectionTimeoutMillis: 2_000,
});

pool.on('error', (err) => {
  logger.warn({ event: 'pg_pool_notice', err: err.message }, 'Standard PG pool notice');
});

// PGlite fallback instance
let pgliteInstance: PGlite | null = null;
let activeDb: any = null;
let isPglite = false;

function initPgliteDb(): any {
  if (pgliteInstance && activeDb) return activeDb;
  const dataDir = path.resolve(process.cwd(), 'data/pgdata');
  if (!fs.existsSync(dataDir)) {
    fs.mkdirSync(dataDir, { recursive: true });
  }
  pgliteInstance = new PGlite(dataDir);
  activeDb = drizzlePglite(pgliteInstance, { schema });
  isPglite = true;
  logger.info({ event: 'pglite_initialized', dataDir }, 'PGlite embedded database initialized');

  void ensureSchema();
  return activeDb;
}

async function ensureSchema(): Promise<void> {
  if (!pgliteInstance) return;
  try {
    const checkRes = await pgliteInstance.query(
      "SELECT to_regclass('public.instruments') as exists;"
    );
    if (!checkRes.rows[0]?.exists) {
      logger.info({ event: 'pglite_migrating' }, 'Applying initial database schema to PGlite...');
      const migrationPaths = [
        path.resolve(process.cwd(), 'src/db/migrations/0000_initial.sql'),
        path.resolve(__dirname, 'migrations/0000_initial.sql'),
        path.resolve(__dirname, '../../../src/db/migrations/0000_initial.sql'),
      ];
      for (const mPath of migrationPaths) {
        if (fs.existsSync(mPath)) {
          const sqlContent = fs.readFileSync(mPath, 'utf-8');
          await pgliteInstance.exec(sqlContent);
          logger.info({ event: 'pglite_migrated' }, 'PGlite schema applied successfully');
          await seedInitialData();
          break;
        }
      }
    }
  } catch (err: any) {
    logger.error({ event: 'pglite_migration_err', err: err.message }, 'Failed applying PGlite schema');
  }
}

async function seedInitialData(): Promise<void> {
  if (!pgliteInstance) return;
  try {
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
      await pgliteInstance.query(
        `INSERT INTO instruments (symbol, display_name, asset_type, base_asset, quote_asset, exchange, provider, currency, tick_size, lot_size, contract_size, minimum_order_size, price_precision, quantity_precision, is_active)
         VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12, $13, $14, $15)
         ON CONFLICT (symbol) DO NOTHING;`,
        [
          item.symbol,
          item.displayName,
          item.assetType,
          item.baseAsset,
          item.quoteAsset,
          item.exchange,
          item.provider,
          item.currency,
          item.tickSize,
          item.lotSize,
          item.contractSize,
          item.minimumOrderSize,
          item.pricePrecision,
          item.quantityPrecision,
          item.isActive,
        ]
      );
    }
    logger.info({ event: 'pglite_seeded' }, 'Initial instruments seeded in PGlite');
  } catch (err: any) {
    logger.error({ event: 'pglite_seed_err', err: err.message }, 'Failed seeding PGlite instruments');
  }
}

if (process.env.USE_PGLITE === 'true' || config.databaseUrl.includes('pglite')) {
  activeDb = initPgliteDb();
} else {
  activeDb = drizzlePg(pool, { schema });
}

export const db: any = new Proxy({} as any, {
  get(_target, prop) {
    if (!activeDb) {
      activeDb = initPgliteDb();
    }
    return activeDb[prop];
  },
});

export type DB = typeof db;

export async function checkDbConnection(): Promise<boolean> {
  if (isPglite && pgliteInstance) {
    try {
      await pgliteInstance.query('SELECT 1');
      return true;
    } catch {
      return false;
    }
  }

  try {
    const client = await pool.connect();
    await client.query('SELECT 1');
    client.release();
    return true;
  } catch {
    if (!isPglite) {
      logger.warn({ event: 'pg_fallback' }, 'External Postgres unavailable; falling back to PGlite embedded database');
      activeDb = initPgliteDb();
      return true;
    }
    return false;
  }
}
