// ============================================================
// IoRedis singleton client
// ============================================================
import Redis from 'ioredis';
import { config } from '../config';
import { logger } from './logger';

let redisClient: Redis | null = null;

export function getRedisClient(): Redis {
  if (redisClient) return redisClient;

  redisClient = new Redis(config.redisUrl, {
    maxRetriesPerRequest: null,
    enableReadyCheck: true,
    retryStrategy(times: number) {
      const delay = Math.min(times * 200, 5_000);
      logger.warn({ event: 'redis_retry', attempt: times, delayMs: delay }, 'Reconnecting to Redis…');
      return delay;
    },
  });

  redisClient.on('connect', () => logger.info({ event: 'redis_connected' }, 'Redis connected'));
  redisClient.on('error', (err: Error) => logger.error({ event: 'redis_error', err: err.message }, 'Redis error'));
  redisClient.on('close', () => logger.warn({ event: 'redis_closed' }, 'Redis connection closed'));

  return redisClient;
}

/**
 * Ping Redis. Returns true if successful.
 */
export async function checkRedisConnection(): Promise<boolean> {
  try {
    const client = getRedisClient();
    const result = await client.ping();
    return result === 'PONG';
  } catch {
    return false;
  }
}

export { Redis };
