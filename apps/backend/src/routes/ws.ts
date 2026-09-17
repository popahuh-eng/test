// ============================================================
// WebSocket Route — /ws
// ============================================================
import type { FastifyInstance } from 'fastify';
import { EventEmitter } from 'events';
import { getRedisClient } from '../services/redis';
import { logger } from '../services/logger';

// Global event bus for broadcasting to connected WebSocket clients
export const wsEmitter = new EventEmitter();
wsEmitter.setMaxListeners(500);

export type WsEventType =
  | 'candle_update'
  | 'new_signal'
  | 'paper_trade_update'
  | 'provider_status_change';

export interface WsEvent {
  type: WsEventType;
  payload: unknown;
  timestamp: string;
}

export async function wsRoutes(fastify: FastifyInstance): Promise<void> {
  fastify.get(
    '/ws',
    { websocket: true },
    (connection, request) => {
      const url = new URL(request.url, `http://localhost`);
      const token = url.searchParams.get('token');

      // Verify token
      if (!token) {
        connection.socket.send(
          JSON.stringify({ type: 'error', message: 'Missing token' }),
        );
        connection.socket.close(1008, 'Missing token');
        return;
      }

      let userId: string;
      try {
        const decoded = fastify.jwt.verify<{ sub: string }>(token);
        userId = decoded.sub;
      } catch {
        connection.socket.send(
          JSON.stringify({ type: 'error', message: 'Invalid token' }),
        );
        connection.socket.close(1008, 'Invalid token');
        return;
      }

      logger.info({ event: 'ws_connected', userId }, 'WebSocket client connected');

      // Send welcome message
      connection.socket.send(
        JSON.stringify({
          type: 'connected',
          payload: { userId },
          timestamp: new Date().toISOString(),
        }),
      );

      // Subscribe to events and forward to this client
      const onEvent = (event: WsEvent) => {
        if (connection.socket.readyState === connection.socket.OPEN) {
          connection.socket.send(JSON.stringify(event));
        }
      };

      wsEmitter.on('broadcast', onEvent);

      connection.socket.on('close', () => {
        wsEmitter.off('broadcast', onEvent);
        logger.info({ event: 'ws_disconnected', userId }, 'WebSocket client disconnected');
      });

      connection.socket.on('error', (err: any) => {
        wsEmitter.off('broadcast', onEvent);
        logger.warn({ event: 'ws_error', userId, err: err.message }, 'WebSocket error');
      });

      // Subscribe to Redis pub/sub for cross-process events
      const subscriber = getRedisClient().duplicate();
      subscriber.subscribe('ws_events', (err: any) => {
        if (err) logger.error({ err: err.message }, 'Failed to subscribe to ws_events');
      });

      subscriber.on('message', (_channel: string, message: string) => {
        try {
          const event = JSON.parse(message) as WsEvent;
          if (connection.socket.readyState === connection.socket.OPEN) {
            connection.socket.send(JSON.stringify(event));
          }
        } catch {
          // ignore malformed messages
        }
      });

      connection.socket.on('close', () => {
        subscriber.unsubscribe('ws_events').catch(() => {});
        subscriber.quit().catch(() => {});
      });
    },
  );
}

/**
 * Broadcast an event to all connected WebSocket clients.
 * Also publishes to Redis so multi-process deployments work.
 */
export async function broadcastWsEvent(event: WsEvent): Promise<void> {
  wsEmitter.emit('broadcast', event);
  try {
    const redis = getRedisClient();
    await redis.publish('ws_events', JSON.stringify(event));
  } catch (err) {
    logger.warn({ err }, 'Failed to publish WS event to Redis');
  }
}
