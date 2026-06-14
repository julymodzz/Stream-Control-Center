import { useDashboardStore } from '../store/useDashboardStore';
import { StatusBadge } from '../components/common/StatusBadge';
import { formatUptime } from '../utils/format';

export function SystemHealthPage() {
  const dashboard = useDashboardStore((s) => s.dashboard);
  const system = dashboard?.system;
  const streaming = dashboard?.streaming;

  if (!system || !streaming) {
    return <div className="p-6 text-gray-500">Systemdaten werden geladen…</div>;
  }

  const checks = [
    { name: 'CPU', ok: (system.cpuPercent ?? 0) < 90, value: `${system.cpuPercent ?? 0}%` },
    { name: 'RAM', ok: (system.ramPercent ?? 0) < 90, value: `${system.ramPercent ?? 0}%` },
    { name: 'Festplatte', ok: (system.diskPercent ?? 0) < 90, value: `${system.diskPercent ?? 0}%` },
    { name: 'OBS Prozess', ok: streaming.obsRunning, value: streaming.obsRunning ? 'Aktiv' : 'Gestoppt' },
    { name: 'OBS WebSocket', ok: streaming.obs?.connected ?? false, value: streaming.obs?.connected ? 'Verbunden' : 'Getrennt' },
    { name: 'NOALBS', ok: streaming.noalbsRunning, value: streaming.noalbsRunning ? 'Aktiv' : 'Gestoppt' },
    { name: 'Stream', ok: streaming.streamOnline, value: streaming.streamOnline ? 'Online' : 'Offline' },
    { name: 'Twitch', ok: streaming.twitchConnected ?? false, value: streaming.twitchConnected ? 'Verbunden' : 'Unbekannt' },
    { name: 'Internet', ok: dashboard.network?.internetOnline ?? false, value: dashboard.network?.internetOnline ? 'Online' : 'Offline' },
  ];

  return (
    <div className="space-y-6 p-4 md:p-6">
      <h2 className="text-lg font-semibold">System Health</h2>

      <div className="card">
        <p className="text-sm text-gray-500">
          Uptime: {formatUptime(system.uptimeSeconds ?? 0)}
        </p>
      </div>

      <div className="grid grid-cols-1 gap-3 sm:grid-cols-2 lg:grid-cols-3">
        {checks.map((check) => (
          <div key={check.name} className="card flex items-center justify-between">
            <span>{check.name}</span>
            <div className="flex items-center gap-2">
              <span className="text-sm text-gray-400">{check.value}</span>
              <StatusBadge online={check.ok} label={check.ok ? 'OK' : 'Warnung'} />
            </div>
          </div>
        ))}
      </div>

      {(streaming.dockerContainers ?? []).length > 0 && (
        <div className="card">
          <h3 className="mb-3 font-semibold">Docker Container</h3>
          <div className="space-y-2">
            {streaming.dockerContainers.map((c) => (
              <div key={c.name} className="flex justify-between text-sm">
                <span>{c.name}</span>
                <StatusBadge online={c.status === 'healthy'} label={c.status} />
              </div>
            ))}
          </div>
        </div>
      )}

      {(streaming.noalbs?.connectionDiagnostics ?? []).length > 0 && (
        <div className="card">
          <h3 className="mb-3 font-semibold">NOALBS Diagnose</h3>
          <ul className="space-y-1 text-sm text-gray-400">
            {streaming.noalbs.connectionDiagnostics.map((d, i) => (
              <li key={i}>• {d}</li>
            ))}
          </ul>
        </div>
      )}
    </div>
  );
}
