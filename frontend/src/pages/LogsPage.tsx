import { LogViewer } from '../components/logs/LogViewer';

export function LogsPage() {
  return (
    <div className="space-y-6 p-4 md:p-6">
      <h2 className="text-lg font-semibold">Logs</h2>
      <div className="grid grid-cols-1 gap-6 lg:grid-cols-2">
        <LogViewer source="obs" title="OBS Logs" />
        <LogViewer source="noalbs" title="NOALBS Logs" />
        <LogViewer source="app" title="Anwendungs-Logs" />
      </div>
    </div>
  );
}
