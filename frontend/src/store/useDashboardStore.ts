import { create } from 'zustand';
import {
  Alert,
  ControlAction,
  DashboardData,
  LogsResponse,
} from '../types';

interface DashboardState {
  dashboard: DashboardData | null;
  obsLogs: LogsResponse | null;
  noalbsLogs: LogsResponse | null;
  connected: boolean;
  lastUpdate: string | null;
  controlLoading: ControlAction | null;
  alertHistory: Alert[];

  setDashboard: (data: DashboardData) => void;
  setObsLogs: (logs: LogsResponse) => void;
  setNoalbsLogs: (logs: LogsResponse) => void;
  setConnected: (connected: boolean) => void;
  setControlLoading: (action: ControlAction | null) => void;
  addToHistory: (alerts: Alert[]) => void;
  acknowledgeAlert: (id: string) => void;
  acknowledgeAllAlerts: () => void;
}

function logsEqual(a: LogsResponse | null, b: LogsResponse): boolean {
  if (!a) return false;
  if (a.totalLines !== b.totalLines || a.lines.length !== b.lines.length) return false;
  const lastA = a.lines[a.lines.length - 1]?.line;
  const lastB = b.lines[b.lines.length - 1]?.line;
  return lastA === lastB;
}

export const useDashboardStore = create<DashboardState>((set, get) => ({
  dashboard: null,
  obsLogs: null,
  noalbsLogs: null,
  connected: false,
  lastUpdate: null,
  controlLoading: null,
  alertHistory: [],

  setDashboard: (data) => {
    const current = get().dashboard;
    if (
      current &&
      current.system.timestamp === data.system.timestamp &&
      current.streaming.timestamp === data.streaming.timestamp &&
      current.network.timestamp === data.network.timestamp &&
      current.alerts.length === data.alerts.length &&
      current.alerts.every((a, i) => a.id === data.alerts[i]?.id)
    ) {
      return;
    }

    set((state) => {
      const prevAlerts = current?.alerts ?? [];
      const historyIds = new Set(state.alertHistory.map((a) => a.id));
      const newAlerts = data.alerts.filter(
        (a) => !prevAlerts.some((p) => p.id === a.id) && !historyIds.has(a.id)
      );

      return {
        dashboard: data,
        lastUpdate: data.system.timestamp,
        alertHistory:
          newAlerts.length > 0
            ? [...newAlerts, ...state.alertHistory].slice(0, 100)
            : state.alertHistory,
      };
    });
  },

  setObsLogs: (logs) => {
    if (logsEqual(get().obsLogs, logs)) return;
    set({ obsLogs: logs });
  },

  setNoalbsLogs: (logs) => {
    if (logsEqual(get().noalbsLogs, logs)) return;
    set({ noalbsLogs: logs });
  },

  setConnected: (connected) => {
    if (get().connected === connected) return;
    set({ connected });
  },

  setControlLoading: (action) => {
    if (get().controlLoading === action) return;
    set({ controlLoading: action });
  },

  addToHistory: (alerts) => {
    if (alerts.length === 0) return;
    set((state) => ({
      alertHistory: [...alerts, ...state.alertHistory].slice(0, 100),
    }));
  },

  acknowledgeAlert: (id) =>
    set((state) => {
      if (!state.dashboard) return state;
      const filtered = state.dashboard.alerts.filter((a) => a.id !== id);
      if (filtered.length === state.dashboard.alerts.length) return state;
      return {
        dashboard: { ...state.dashboard, alerts: filtered },
      };
    }),

  acknowledgeAllAlerts: () =>
    set((state) => {
      if (!state.dashboard || state.dashboard.alerts.length === 0) return state;
      return {
        dashboard: { ...state.dashboard, alerts: [] },
      };
    }),
}));
