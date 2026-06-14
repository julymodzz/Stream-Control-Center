import { Monitor, Trash2 } from 'lucide-react';
import { Button } from '../ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '../ui/card';
import { Badge } from '../ui/badge';
import { UserSession } from '../../types';

interface SessionManagerProps {
  sessions: UserSession[];
  onRevoke: (id: string) => void;
  onRevokeOthers: () => void;
}

export function SessionManager({ sessions, onRevoke, onRevokeOthers }: SessionManagerProps) {
  return (
    <Card>
      <CardHeader className="flex flex-row items-center justify-between">
        <CardTitle className="flex items-center gap-2">
          <Monitor className="h-4 w-4" />
          Aktive Sitzungen
        </CardTitle>
        <Button variant="outline" size="sm" onClick={onRevokeOthers}>Alle anderen beenden</Button>
      </CardHeader>
      <CardContent className="space-y-2">
        {sessions.length === 0 ? (
          <p className="text-sm text-gray-500">Keine aktiven Sitzungen</p>
        ) : (
          sessions.map((s) => (
            <div key={s.id} className="flex items-center justify-between rounded-lg border border-gray-700/50 px-4 py-3">
              <div>
                <div className="flex items-center gap-2">
                  <span className="font-medium">{s.browser} · {s.device}</span>
                  {s.isCurrent && <Badge variant="success">Aktuell</Badge>}
                </div>
                <p className="text-xs text-gray-500">{s.ip} · Login: {new Date(s.createdAt).toLocaleString('de-DE')}</p>
                <p className="text-xs text-gray-600">Letzte Aktivität: {new Date(s.lastActiveAt).toLocaleString('de-DE')}</p>
              </div>
              {!s.isCurrent && (
                <Button variant="ghost" size="sm" onClick={() => onRevoke(s.id)}>
                  <Trash2 className="h-4 w-4" />
                </Button>
              )}
            </div>
          ))
        )}
      </CardContent>
    </Card>
  );
}
