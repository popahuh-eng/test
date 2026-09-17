// ============================================================
// Fastify App Builder
// ============================================================
import Fastify from 'fastify';
import cors from '@fastify/cors';
import helmet from '@fastify/helmet';
import rateLimit from '@fastify/rate-limit';
import jwt from '@fastify/jwt';
import swagger from '@fastify/swagger';
import swaggerUi from '@fastify/swagger-ui';
import websocket from '@fastify/websocket';

import { config } from './config';
import { logger } from './services/logger';
import { getRedisClient } from './services/redis';

import { authRoutes } from './routes/auth';
import { healthRoutes } from './routes/health';
import { instrumentRoutes } from './routes/instruments';
import { marketRoutes } from './routes/market';
import { signalRoutes } from './routes/signals';
import { newsRoutes } from './routes/news';
import { modelRoutes } from './routes/models';
import { backtestRoutes } from './routes/backtests';
import { paperRoutes } from './routes/paper';
import { settingsRoutes } from './routes/settings';
import { wsRoutes } from './routes/ws';

export async function buildApp() {
  const app = Fastify({
    logger: false, // we use our own pino logger
    trustProxy: true,
  });

  // ── Security ───────────────────────────────────────────────
  await app.register(helmet, {
    contentSecurityPolicy: false, // Swagger UI needs inline scripts
  });

  await app.register(cors, {
    origin: config.frontendUrl,
    credentials: true,
  });

  await app.register(rateLimit, {
    max: 100,
    timeWindow: '1 minute',
    redis: getRedisClient(),
    errorResponseBuilder: (_request, context) => ({
      success: false,
      data: null,
      error: `Rate limit exceeded. Retry after ${context.after}`,
      timestamp: new Date().toISOString(),
    }),
  });

  // ── JWT ────────────────────────────────────────────────────
  await app.register(jwt, {
    secret: config.jwtSecret,
  });

  // ── Swagger ────────────────────────────────────────────────
  await app.register(swagger, {
    openapi: {
      info: {
        title: 'Trading Signal Platform API',
        description: 'REST API for the Trading Signal Platform',
        version: '1.0.0',
      },
      servers: [{ url: `http://localhost:${config.port}` }],
      components: {
        securitySchemes: {
          bearerAuth: { type: 'http', scheme: 'bearer', bearerFormat: 'JWT' },
        },
      },
    },
  });

  await app.register(swaggerUi, {
    routePrefix: '/docs',
    uiConfig: { deepLinking: false },
  });

  // ── WebSocket ──────────────────────────────────────────────
  await app.register(websocket);

  // ── Routes ─────────────────────────────────────────────────
  await app.register(healthRoutes);
  await app.register(authRoutes);
  await app.register(instrumentRoutes);
  await app.register(marketRoutes);
  await app.register(signalRoutes);
  await app.register(newsRoutes);
  await app.register(modelRoutes);
  await app.register(backtestRoutes);
  await app.register(paperRoutes);
  await app.register(settingsRoutes);
  await app.register(wsRoutes);

  // ── Global Error Handler ───────────────────────────────────
  app.setErrorHandler((error, request, reply) => {
    const statusCode = error.statusCode ?? 500;
    logger.error(
      { event: 'request_error', url: request.url, method: request.method, statusCode, err: error.message },
      'Request error',
    );
    reply.status(statusCode).send({
      success: false,
      data: null,
      error: config.isDev ? error.message : 'Internal server error',
      timestamp: new Date().toISOString(),
    });
  });

  // ── 404 Handler ────────────────────────────────────────────
  app.setNotFoundHandler((_request, reply) => {
    reply.status(404).send({
      success: false,
      data: null,
      error: 'Route not found',
      timestamp: new Date().toISOString(),
    });
  });

  return app;
}
