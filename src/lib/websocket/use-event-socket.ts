import { useEffect, useState } from 'react';
import { io, type Socket } from 'socket.io-client';
import { apiClient } from '../api/api-client';

const environment = import.meta.env as unknown as Record<string, unknown>;
const WS_URL =
  typeof environment.VITE_WS_URL === 'string' ? environment.VITE_WS_URL : 'http://localhost:3000';
const SOCKET_PROGRESS_ENABLED = environment.VITE_ENABLE_SOCKET_PROGRESS === 'true';

export function useEventSocket(
  eventId: string,
  onEvent?: (type: string, payload: unknown) => void,
  enabled = true,
) {
  const [connected, setConnected] = useState(false);
  const activeEnabled = enabled && SOCKET_PROGRESS_ENABLED;
  useEffect(() => {
    if (!activeEnabled) return;
    let socket: Socket | null = null;
    let active = true;
    void apiClient
      .post<{ ticket: string }>('/websocket/ticket')
      .then(({ ticket }) => {
        if (!active) return;
        socket = io(`${WS_URL}/events`, { auth: { ticket }, transports: ['websocket'] });
        socket.on('connect', () => {
          setConnected(true);
          socket?.emit('event:subscribe', { eventId });
        });
        socket.on('disconnect', () => setConnected(false));
        for (const type of ['document:progress', 'invitation:progress', 'event:updated']) {
          socket.on(type, (payload) => onEvent?.(type, payload));
        }
      })
      .catch(() => setConnected(false));
    return () => {
      active = false;
      socket?.disconnect();
    };
  }, [activeEnabled, eventId, onEvent]);
  return { connected, enabled: activeEnabled };
}
