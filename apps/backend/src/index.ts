// ============================================================
// Backend Entry Point
// ============================================================
import { buildApp } from './app';
import { config } from './config';
import { logger } from './services/logger';
import { pool } from './db';
import { getRedisClient } from './services/redis';
import { ProviderRegistry } from './providers/ProviderRegistry';
import { startWorkers, type WorkersInstance } from './workers';
import { TradingTelegramBot } from './telegram/TelegramBot';

let workersInstance: WorkersInstance | null = null;

async function main(): Promise<void> {
  const app = await buildApp();

  try {
    await app.listen({ port: config.port, host: '0.0.0.0' });
    logger.info(
      { event: 'server_started', port: config.port, env: config.nodeEnv },
      `Backend listening on port ${config.port}`,
    );

    // Initialize Providers & Telegram Bot
    const providerRegistry = new ProviderRegistry();
    const telegramBot = new TradingTelegramBot();

    // Start background ingestion and processing workers
    if (config.nodeEnv !== 'test') {
      workersInstance = startWorkers(providerRegistry, telegramBot);
    }
  } catch (err) {
    logger.fatal({ err }, 'Failed to start server');
    process.exit(1);
  }
}

// Graceful shutdown
async function shutdown(signal: string): Promise<void> {
  logger.info({ event: 'shutdown', signal }, `Received ${signal}, shutting down gracefully`);
  try {
    if (workersInstance) {
      await workersInstance.stop();
    }
    await pool.end();
    const redis = getRedisClient();
    await redis.quit();
    logger.info({ event: 'shutdown_complete' }, 'Shutdown complete');
    process.exit(0);
  } catch (err) {
    logger.error({ err }, 'Error during shutdown');
    process.exit(1);
  }
}

process.on('SIGTERM', () => void shutdown('SIGTERM'));
process.on('SIGINT', () => void shutdown('SIGINT'));
process.on('uncaughtException', (err) => {
  logger.fatal({ err }, 'Uncaught exception');
  process.exit(1);
});
process.on('unhandledRejection', (reason) => {
  logger.fatal({ reason }, 'Unhandled rejection');
  process.exit(1);
});

void main();
