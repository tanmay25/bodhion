'use client';

// ─── SocketProvider ───────────────────────────────────────────────────────────
// Mirrors the setupSocket() call in src/routes/+layout.svelte.
// Creates the socket.io connection after the user is authenticated,
// emits user-join, sends a heartbeat every 30 s, and exposes the socket
// via context so children can subscribe to events.

import React, { createContext, useContext, useEffect, useRef, useState } from 'react';
import { io, type Socket } from 'socket.io-client';
import { useAuthStore } from '@/store/authStore';
import { useAIStore } from '@/store/aiStore';
import { getToken } from '@/lib/auth/session';
import { API_BASE_URL } from '@/lib/api/client';

interface SocketContextValue {
  socket: Socket | null;
}

const SocketContext = createContext<SocketContextValue>({ socket: null });

export function useSocket() {
  return useContext(SocketContext);
}

export function SocketProvider({ children }: { children: React.ReactNode }) {
  const user = useAuthStore((s) => s.user);
  const config = useAuthStore((s) => s.config);
  const setSocketId = useAIStore((s) => s.setSocketId);
  const [socket, setSocket] = useState<Socket | null>(null);
  const heartbeatRef = useRef<ReturnType<typeof setInterval> | null>(null);

  useEffect(() => {
    if (!user || !config) return;

    // Guard against React 18 Strict Mode double-invoking effects in dev.
    // If cleanup runs before the socket connects, we skip setup entirely.
    let cancelled = false;

    const enableWebsocket = config.features?.enable_websocket ?? true;
    const token = getToken();

    const _socket = io(API_BASE_URL || undefined, {
      reconnection: true,
      reconnectionDelay: 2000,
      reconnectionDelayMax: 10000,
      randomizationFactor: 0.5,
      path: '/ws/socket.io',
      transports: enableWebsocket ? ['websocket'] : ['polling', 'websocket'],
      auth: { token },
      timeout: 5000,
    });

    _socket.on('connect', () => {
      if (cancelled) {
        _socket.disconnect();
        return;
      }
      setSocketId(_socket.id ?? null);

      heartbeatRef.current = setInterval(() => {
        if (_socket.connected) _socket.emit('heartbeat', {});
      }, 30_000);

      if (token) _socket.emit('user-join', { auth: { token } });
    });

    _socket.on('disconnect', () => {
      setSocketId(null);
      if (heartbeatRef.current) {
        clearInterval(heartbeatRef.current);
        heartbeatRef.current = null;
      }
    });

    if (!cancelled) setSocket(_socket);

    return () => {
      cancelled = true;
      if (heartbeatRef.current) clearInterval(heartbeatRef.current);
      _socket.disconnect();
    };
  }, [user?.id, config?.features?.enable_websocket]); // eslint-disable-line react-hooks/exhaustive-deps

  return <SocketContext.Provider value={{ socket }}>{children}</SocketContext.Provider>;
}
