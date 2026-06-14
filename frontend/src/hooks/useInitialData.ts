import { useEffect } from 'react';
import { fetchNotifications } from '../api/client';
import { useDashboardStore } from '../store/useDashboardStore';

export function useInitialData(): void {
  useEffect(() => {
    fetchNotifications()
      .then((data) => {
        if ((data?.history?.length ?? 0) > 0) {
          const unacknowledged = data.history.filter((a) => !a.acknowledged);
          if (unacknowledged.length > 0) {
            useDashboardStore.getState().addToHistory(unacknowledged);
          }
        }
      })
      .catch(() => {
        // Backend noch nicht erreichbar – WebSocket übernimmt später
      });
  }, []);
}
