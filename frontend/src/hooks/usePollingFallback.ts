import { useEffect } from 'react';
import { fetchDashboard } from '../api/client';
import { useDashboardStore } from '../store/useDashboardStore';

const POLL_INTERVAL = 5000;

export function usePollingFallback(): void {
  const connected = useDashboardStore((s) => s.connected);

  useEffect(() => {
    if (connected) return;

    const poll = async (): Promise<void> => {
      try {
        const data = await fetchDashboard();
        useDashboardStore.getState().setDashboard(data);
      } catch {
        // Server nicht erreichbar
      }
    };

    poll();
    const timer = setInterval(poll, POLL_INTERVAL);
    return () => clearInterval(timer);
  }, [connected]);
}
