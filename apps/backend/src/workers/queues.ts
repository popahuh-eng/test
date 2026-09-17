// ============================================================
// BullMQ Queues Definition
// ============================================================
import { Queue } from 'bullmq';
import { getRedisClient } from '../services/redis';

// Use redis connection options from getRedisClient
const connection = getRedisClient();

export const marketDataQueue = new Queue('market-data', { connection });
export const newsQueue = new Queue('news', { connection });
export const featureQueue = new Queue('features', { connection });
export const predictionQueue = new Queue('predictions', { connection });
export const signalQueue = new Queue('signals', { connection });
export const paperExecutionQueue = new Queue('paper-execution', { connection });
export const backtestQueue = new Queue('backtests', { connection });
