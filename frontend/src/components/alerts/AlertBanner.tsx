import { useShallow } from 'zustand/react/shallow';
import { acknowledgeAlert, acknowledgeAllAlerts } from '../../api/client';
import { EMPTY_ALERTS } from '../../store/constants';
import { useDashboardStore } from '../../store/useDashboardStore';
import { Alert } from '../../types';
import { formatTimestamp } from '../../utils/format';

const severityStyles = {
  info: 'border-accent-blue/50 bg-blue-500/10 text-accent-blue',
  warning: 'border-accent-yellow/50 bg-yellow-500/10 text-accent-yellow',
  critical: 'border-accent-red/50 bg-red-500/10 text-accent-red',
};

export function AlertBanner() {
  const alerts = useDashboardStore(
    useShallow((s) => s.dashboard?.alerts ?? EMPTY_ALERTS)
  );

  if (alerts.length === 0) return null;

  const handleAcknowledge = async (id: string) => {
    await acknowledgeAlert(id);
    useDashboardStore.getState().acknowledgeAlert(id);
  };

  const handleAcknowledgeAll = async () => {
    await acknowledgeAllAlerts();
    useDashboardStore.getState().acknowledgeAllAlerts();
  };

  return (
    <div className="space-y-2 px-6 py-3">
      <div className="mx-auto flex max-w-7xl items-center justify-between">
        <span className="text-sm font-medium text-gray-400">
          {alerts.length} aktive Warnung{alerts.length !== 1 ? 'en' : ''}
        </span>
        <button className="text-xs text-accent-blue hover:underline" onClick={handleAcknowledgeAll}>
          Alle bestätigen
        </button>
      </div>
      {alerts.map((alert) => (
        <AlertItem key={alert.id} alert={alert} onAcknowledge={handleAcknowledge} />
      ))}
    </div>
  );
}

function AlertItem({
  alert,
  onAcknowledge,
}: {
  alert: Alert;
  onAcknowledge: (id: string) => void;
}) {
  return (
    <div
      className={`mx-auto flex max-w-7xl items-center justify-between rounded-lg border px-4 py-3 ${severityStyles[alert.severity]}`}
    >
      <div>
        <p className="font-medium">{alert.message}</p>
        <p className="text-xs opacity-70">{formatTimestamp(alert.timestamp)}</p>
      </div>
      <button
        className="ml-4 shrink-0 text-xs opacity-80 hover:opacity-100"
        onClick={() => onAcknowledge(alert.id)}
      >
        Bestätigen
      </button>
    </div>
  );
}
