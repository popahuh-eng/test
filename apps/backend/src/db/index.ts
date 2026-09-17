// ============================================================
// Database client — Drizzle ORM + pg Pool
// ============================================================
import { drizzle } from 'drizzle-orm/node-postgres';
import { Pool } from 'pg';
import { config } from '../config';
import * as schema from './schema';
import { logger } from '../services/logger';

export const pool = new Pool({
  connectionString: config.databaseUrl,
  max: 20,
  idleTimeoutMillis: 30_000,
  connectionTimeoutMillis: 5_000,
});

pool.on('error', (err) => {
  logger.error({ event: 'pg_pool_error', err: err.message }, 'Unexpected error on idle pg client');
});

export const db = drizzle(pool, { schema });

export type DB = typeof db;

/**
 * Test the database connection by running a trivial query.
 * Returns true on success, false on failure.
 */
export async function checkDbConnection(): Promise<boolean> {
  try {
    const client = await pool.connect();
    await client.query('SELECT 1');
    client.release();
    return true;
  } catch {
    return false;
  }
}
