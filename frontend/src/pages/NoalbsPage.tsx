import { Layers } from 'lucide-react';
import { useDashboardStore } from '../store/useDashboardStore';
import { Badge } from '../components/ui/badge';
import { Card, CardContent, CardHeader, CardTitle } from '../components/ui/card';
import { ControlPanel } from '../components/controls/ControlPanel';
import { useAuthStore } from '../store/useAuthStore';

export function NoalbsPage() {
  const streaming = useDashboardStore((s) => s.dashboard?.streaming);
  const noalbs = streaming?.noalbs;
  const canControl = useAuthStore((s) => s.hasAnyPermission(['noalbs.control', 'obs.control', 'control:execute']));

  return (
    <div className="space-y-6 p-4 md:p-6">
      <h1 className="flex items-center gap-2 text-2xl font-bold">
        <Layers className="h-6 w-6 text-accent-blue" />
        NOALBS
      </h1>

      <Card>
        <CardHeader><CardTitle>Status</CardTitle></CardHeader>
        <CardContent className="space-y-3">
          <div className="flex items-center gap-2">
            <span>Dienst:</span>
            <Badge variant={noalbs?.running ? 'success' : 'destructive'}>
              {noalbs?.running ? 'Aktiv' : 'Offline'}
            </Badge>
          </div>
          <div className="flex items-center gap-2">
            <span>Auto-Recovery:</span>
            <Badge variant="outline">{noalbs?.autoRecoveryEnabled ? 'Aktiv' : 'Inaktiv'}</Badge>
          </div>
          {noalbs?.lastSceneSwitch && (
            <p className="text-sm text-gray-500">Letzter Szenenwechsel: {new Date(noalbs.lastSceneSwitch).toLocaleString('de-DE')}</p>
          )}
        </CardContent>
      </Card>

      {(noalbs?.connectionDiagnostics ?? []).length > 0 && (
        <Card>
          <CardHeader><CardTitle>Diagnose</CardTitle></CardHeader>
          <CardContent>
            <ul className="space-y-1 text-sm text-gray-400">
              {noalbs?.connectionDiagnostics.map((d, i) => <li key={i}>• {d}</li>)}
            </ul>
          </CardContent>
        </Card>
      )}

      {(noalbs?.sceneSwitchHistory ?? []).length > 0 && (
        <Card>
          <CardHeader><CardTitle>Szenenwechsel-Historie</CardTitle></CardHeader>
          <CardContent className="space-y-2">
            {noalbs?.sceneSwitchHistory.map((e, i) => (
              <div key={i} className="flex justify-between text-sm border-b border-gray-800/50 py-2">
                <span>{e.from ?? '–'} → {e.to}</span>
                <span className="text-gray-500">{new Date(e.timestamp).toLocaleString('de-DE')}</span>
              </div>
            ))}
          </CardContent>
        </Card>
      )}

      {(noalbs?.failoverHistory ?? []).length > 0 && (
        <Card>
          <CardHeader><CardTitle>Failover-Historie</CardTitle></CardHeader>
          <CardContent className="space-y-2">
            {noalbs?.failoverHistory.map((e, i) => (
              <div key={i} className="text-sm border-b border-gray-800/50 py-2">
                <Badge variant={e.success ? 'success' : 'destructive'} className="mr-2">{e.success ? 'OK' : 'Fehler'}</Badge>
                {e.action}
              </div>
            ))}
          </CardContent>
        </Card>
      )}

      {canControl && <ControlPanel />}
    </div>
  );
}
