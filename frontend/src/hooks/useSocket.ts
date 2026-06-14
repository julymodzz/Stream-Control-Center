import { useEffect } from 'react';
import { io, Socket } from 'socket.io-client';
import { useAuthStore } from '../store/useAuthStore';
import { useDashboardStore } from '../store/useDashboardStore';

const API_BASE = import.meta.env.VITE_API_URL || '';

let socket: Socket | null = null;

export function useSocket() {
  const token = useAuthStore((s) => s.accessToken);
  const setDashboard = useDashboardStore((s) => s.setDashboard);
  const setConnected = useDashboardStore((s) => s.setConnected);
  const setObsLogs = useDashboardStore((s) => s.setObsLogs);
  const setNoalbsLogs = useDashboardStore((s) => s.setNoalbsLogs);

  useEffect(() => {
    if (!token) return;

    socket = io(API_BASE || window.location.origin, {
      auth: { token },
      transports: ['websocket', 'polling'],
    });

    socket.on('connect', () => setConnected(true));
    socket.on('disconnect', () => setConnected(false));
    socket.on('dashboard:update', (data) => setDashboard(data));
    socket.on('logs:obs', (data) => setObsLogs(data));
    socket.on('logs:noalbs', (data) => setNoalbsLogs(data));

    return () => {
      socket?.disconnect();
      socket = null;
      setConnected(false);
    };
  }, [token, setDashboard, setConnected, setObsLogs, setNoalbsLogs]);
}
