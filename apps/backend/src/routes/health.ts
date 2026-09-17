// ============================================================
// Health Routes — /health and /ready
// ============================================================
import type { FastifyInstance } from 'fastify';
import { checkDbConnection } from '../db';
import { checkRedisConnection } from '../services/redis';
import { config } from '../config';
import { logger } from '../services/logger';

interface ServiceHealth {
  status: 'ok' | 'error';
  latencyMs?: number;
  error?: string;
}

interface HealthPayload {
  status: 'ok' | 'degraded' | 'error';
  timestamp: string;
  services: {
    database: ServiceHealth;
    redis: ServiceHealth;
    ml: ServiceHealth;
  };
}

async function checkMl(): Promise<ServiceHealth> {
  const start = Date.now();
  try {
    const controller = new AbortController();
    const id = setTimeout(() => controller.abort(), 5_000);
    const response = await fetch(`${config.mlServiceUrl}/health`, {
      signal: controller.signal,
    });
    clearTimeout(id);
    if (!response.ok) throw new Error(`HTTP ${response.status}`);
    return { status: 'ok', latencyMs: Date.now() - start };
  } catch (err) {
    const message = err instanceof Error ? err.message : 'Unknown error';
    return { status: 'error', error: message };
  }
}

export async function healthRoutes(fastify: FastifyInstance): Promise<void> {
  // GET /health
  fastify.get('/health', async (_request, reply) => {
    const [dbOk, redisOk, mlHealth] = await Promise.all([
      checkDbConnection(),
      checkRedisConnection(),
      checkMl(),
    ]);

    const dbHealth: ServiceHealth = dbOk ? { status: 'ok' } : { status: 'error', error: 'Connection failed' };
    const redisHealth: ServiceHealth = redisOk ? { status: 'ok' } : { status: 'error', error: 'Connection failed' };

    const allOk = dbOk && redisOk && mlHealth.status === 'ok';
    const anyError = !dbOk || !redisOk;

    const payload: HealthPayload = {
      status: allOk ? 'ok' : anyError ? 'error' : 'degraded',
      timestamp: new Date().toISOString(),
      services: {
        database: dbHealth,
        redis: redisHealth,
        ml: mlHealth,
      },
    };

    logger.debug({ event: 'health_check', payload }, 'Health check performed');
    return reply.send(payload);
  });

  // GET /ready — used by load balancers; returns 503 if not ready
  fastify.get('/ready', async (_request, reply) => {
    const [dbOk, redisOk] = await Promise.all([
      checkDbConnection(),
      checkRedisConnection(),
    ]);

    if (!dbOk || !redisOk) {
      return reply.status(503).send({
        status: 'not_ready',
        timestamp: new Date().toISOString(),
        services: {
          database: { status: dbOk ? 'ok' : 'error' },
          redis: { status: redisOk ? 'ok' : 'error' },
        },
      });
    }

    return reply.send({ status: 'ready', timestamp: new Date().toISOString() });
  });
}
