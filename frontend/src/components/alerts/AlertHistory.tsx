import { useShallow } from 'zustand/react/shallow';
import { useDashboardStore } from '../../store/useDashboardStore';
import { formatTimestamp } from '../../utils/format';

const typeLabels: Record<string, string> = {
  obs_crash: 'OBS Absturz',
  noalbs_crash: 'NOALBS Absturz',
  internet_down: 'Internet ausgefallen',
  high_latency: 'Hohe Latenz',
};

export function AlertHistory() {
  const history = useDashboardStore(useShallow((s) => s.alertHistory));

  if (history.length === 0) {
    return (
      <div className="card">
        <h2 className="mb-2 text-lg font-semibold">Ereignishistorie</h2>
        <p className="text-sm text-gray-500">Noch keine Ereignisse aufgezeichnet.</p>
      </div>
    );
  }

  return (
    <div className="card">
      <h2 className="mb-4 flex items-center gap-2 text-lg font-semibold">
        <svg className="h-5 w-5 text-gray-400" fill="none" viewBox="0 0 24 24" stroke="currentColor">
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 8v4l3 3m6-3a9 9 0 11-18 0 9 9 0 0118 0z" />
        </svg>
        Ereignishistorie
      </h2>

      <div className="max-h-48 space-y-2 overflow-y-auto">
        {history.map((alert) => (
          <div
            key={alert.id}
            className="flex items-start justify-between rounded-lg bg-surface-lighter/50 px-3 py-2 text-sm"
          >
            <div>
              <span className="font-medium">{typeLabels[alert.type] ?? alert.type}</span>
              <p className="text-gray-400">{alert.message}</p>
            </div>
            <span className="shrink-0 text-xs text-gray-500">
              {formatTimestamp(alert.timestamp)}
            </span>
          </div>
        ))}
      </div>
    </div>
  );
}
