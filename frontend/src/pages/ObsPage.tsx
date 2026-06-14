import { useState } from 'react';
import { Radio } from 'lucide-react';
import { executeObsControl } from '../api/client';
import { ControlPanel } from '../components/controls/ControlPanel';
import { StreamingStatusCard } from '../components/dashboard/StreamingStatusCard';
import { useDashboardStore } from '../store/useDashboardStore';
import { useAuthStore } from '../store/useAuthStore';
import { Button } from '../components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '../components/ui/card';
import { Badge } from '../components/ui/badge';

export function ObsPage() {
  const streaming = useDashboardStore((s) => s.dashboard?.streaming);
  const canControl = useAuthStore((s) => s.hasPermission('obs.control'));
  const [message, setMessage] = useState('');
  const obs = streaming?.obs;

  const runAction = async (action: string, extra?: Record<string, unknown>) => {
    try {
      const result = await executeObsControl({ action, ...extra });
      setMessage(result.message);
    } catch (e) {
      setMessage(String(e));
    }
  };

  return (
    <div className="space-y-6 p-4 md:p-6">
      <h1 className="flex items-center gap-2 text-2xl font-bold">
        <Radio className="h-6 w-6 text-accent" />
        OBS Studio
      </h1>
      <StreamingStatusCard />

      {canControl && obs?.scenes && obs.scenes.length > 0 && (
        <Card>
          <CardHeader><CardTitle>Szenensteuerung</CardTitle></CardHeader>
          <CardContent className="flex flex-wrap gap-2">
            {obs.scenes.map((scene) => (
              <Button
                key={scene}
                variant={obs.currentScene === scene ? 'default' : 'outline'}
                size="sm"
                onClick={() => runAction('set-scene', { sceneName: scene })}
              >
                {scene}
              </Button>
            ))}
          </CardContent>
        </Card>
      )}

      {canControl && (
        <Card>
          <CardHeader><CardTitle>Stream & Aufnahme</CardTitle></CardHeader>
          <CardContent className="flex flex-wrap gap-2">
            <Button variant="success" size="sm" onClick={() => runAction('start-stream')}>Stream starten</Button>
            <Button variant="destructive" size="sm" onClick={() => runAction('stop-stream')}>Stream stoppen</Button>
            <Button variant="outline" size="sm" onClick={() => runAction('start-recording')}>Aufnahme starten</Button>
            <Button variant="outline" size="sm" onClick={() => runAction('stop-recording')}>Aufnahme stoppen</Button>
          </CardContent>
        </Card>
      )}

      {message && <Badge variant="outline">{message}</Badge>}
      {canControl && <ControlPanel />}
    </div>
  );
}
