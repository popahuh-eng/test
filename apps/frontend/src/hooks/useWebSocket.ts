// ============================================================
// Real-time WebSocket Client Hook
// ============================================================
import { useEffect, useRef, useCallback } from 'react';
import { useAuthStore } from '../store/auth';

export type WSMessage = {
  event: string;
  data: any;
};

export function useWebSocket(onMessage: (msg: WSMessage) => void) {
  const { token } = useAuthStore();
  const socketRef = useRef<WebSocket | null>(null);

  const connect = useCallback(() => {
    if (!token) return;

    const protocol = window.location.protocol === 'https:' ? 'wss:' : 'ws:';
    const host = window.location.host;
    const wsUrl = `${protocol}//${host}/ws?token=${token}`;

    try {
      const ws = new WebSocket(wsUrl);
      socketRef.current = ws;

      ws.onmessage = (event) => {
        try {
          const parsed = JSON.parse(event.data);
          onMessage(parsed);
        } catch {
          // ignore unparseable
        }
      };

      ws.onclose = () => {
        // Auto-reconnect after 4s
        setTimeout(connect, 4000);
      };

      ws.onerror = () => {
        ws.close();
      };
    } catch {
      // ignore init errors
    }
  }, [token, onMessage]);

  useEffect(() => {
    connect();
    return () => {
      socketRef.current?.close();
    };
  }, [connect]);
}
