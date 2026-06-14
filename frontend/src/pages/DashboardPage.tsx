import { AlertBanner } from '../components/alerts/AlertBanner';
import { AlertHistory } from '../components/alerts/AlertHistory';
import { ControlPanel } from '../components/controls/ControlPanel';
import { NetworkStatusCard } from '../components/dashboard/NetworkStatusCard';
import { StreamingStatusCard } from '../components/dashboard/StreamingStatusCard';
import { SystemStatusCard } from '../components/dashboard/SystemStatusCard';
import { ConnectionBanner } from '../components/layout/ConnectionBanner';
import { useInitialData } from '../hooks/useInitialData';
import { usePollingFallback } from '../hooks/usePollingFallback';
import { useSocket } from '../hooks/useSocket';

export function DashboardPage() {
  useSocket();
  useInitialData();
  usePollingFallback();

  return (
    <div className="space-y-6 p-4 md:p-6">
      <ConnectionBanner />
      <AlertBanner />

      <div className="grid grid-cols-1 gap-6 lg:grid-cols-2">
        <SystemStatusCard />
        <StreamingStatusCard />
      </div>

      <NetworkStatusCard />

      <div className="grid grid-cols-1 gap-6 lg:grid-cols-2">
        <ControlPanel />
        <AlertHistory />
      </div>
    </div>
  );
}
