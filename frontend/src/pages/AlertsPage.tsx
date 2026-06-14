import { useEffect, useState } from 'react';
import { acknowledgeAllAlerts, fetchNotifications } from '../api/client';
import { AlertHistory } from '../components/alerts/AlertHistory';
import { Alert, AlertConfig } from '../types';
import { useAuthStore } from '../store/useAuthStore';

export function AlertsPage() {
  const [config, setConfig] = useState<AlertConfig | null>(null);
  const [active, setActive] = useState<Alert[]>([]);
  const canManage = useAuthStore((s) => s.hasPermission('alerts:manage'));

  useEffect(() => {
    fetchNotifications()
      .then((data) => {
        setConfig(data?.config ?? null);
        setActive(data?.active ?? []);
      })
      .catch(() => {
        setConfig(null);
        setActive([]);
      });
  }, []);

  const requestBrowserPermission = () => {
    if ('Notification' in window) {
      Notification.requestPermission();
    }
  };

  return (
    <div className="space-y-6 p-4 md:p-6">
      <div className="flex items-center justify-between">
        <h2 className="text-lg font-semibold">Alerts & Benachrichtigungen</h2>
        {active.length > 0 && canManage && (
          <button type="button" onClick={() => acknowledgeAllAlerts()} className="btn-ghost text-xs">
            Alle bestätigen
          </button>
        )}
      </div>

      <div className="grid grid-cols-1 gap-6 lg:grid-cols-2">
        <AlertHistory />

        <div className="card space-y-4">
          <h3 className="font-semibold">Alert-Konfiguration</h3>
          {config ? (
            <dl className="space-y-2 text-sm">
              <div className="flex justify-between">
                <dt className="text-gray-500">Aktiv</dt>
                <dd>{config.enabled ? 'Ja' : 'Nein'}</dd>
              </div>
              <div className="flex justify-between">
                <dt className="text-gray-500">Discord Webhook</dt>
                <dd>{config.discordWebhookUrl ? 'Konfiguriert' : 'Nicht gesetzt'}</dd>
              </div>
              <div className="flex justify-between">
                <dt className="text-gray-500">E-Mail</dt>
                <dd>{config.emailEnabled ? 'Aktiv' : 'Inaktiv'}</dd>
              </div>
              <div className="flex justify-between">
                <dt className="text-gray-500">CPU-Schwellwert</dt>
                <dd>{config.thresholds?.cpuPercent ?? '-'}%</dd>
              </div>
              <div className="flex justify-between">
                <dt className="text-gray-500">RAM-Schwellwert</dt>
                <dd>{config.thresholds?.ramPercent ?? '-'}%</dd>
              </div>
            </dl>
          ) : (
            <p className="text-gray-500">Konfiguration nicht verfügbar</p>
          )}
          <button type="button" onClick={requestBrowserPermission} className="btn-ghost text-xs">
            Browser-Benachrichtigungen aktivieren
          </button>
        </div>
      </div>
    </div>
  );
}
