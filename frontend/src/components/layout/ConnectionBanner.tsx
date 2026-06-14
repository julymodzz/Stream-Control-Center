import { useDashboardStore } from '../../store/useDashboardStore';

export function ConnectionBanner() {
  const connected = useDashboardStore((s) => s.connected);
  const dashboard = useDashboardStore((s) => s.dashboard);

  if (connected && dashboard) return null;

  return (
    <div className="border-b border-accent-yellow/30 bg-yellow-500/10 px-6 py-2 text-center text-sm text-accent-yellow">
      {!connected
        ? 'Verbindung zum Server unterbrochen – Reconnect wird versucht…'
        : 'Warte auf erste Dashboard-Daten…'}
    </div>
  );
}
