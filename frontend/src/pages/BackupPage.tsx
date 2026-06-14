import { useEffect, useState } from 'react';
import { createBackup, fetchBackups } from '../api/client';
import { BackupMetadata } from '../types';
import { useAuthStore } from '../store/useAuthStore';

export function BackupPage() {
  const [backups, setBackups] = useState<BackupMetadata[]>([]);
  const [loading, setLoading] = useState(true);
  const canManage = useAuthStore((s) => s.hasPermission('backup:manage'));

  const load = async () => {
    try {
      const data = await fetchBackups();
      setBackups(data ?? []);
    } catch {
      setBackups([]);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    load();
  }, []);

  const handleCreate = async () => {
    await createBackup();
    await load();
  };

  return (
    <div className="space-y-6 p-4 md:p-6">
      <div className="flex items-center justify-between">
        <h2 className="text-lg font-semibold">Backup & Wiederherstellung</h2>
        {canManage && (
          <button type="button" onClick={handleCreate} className="btn-primary">
            Backup erstellen
          </button>
        )}
      </div>

      <div className="card">
        {loading ? (
          <p className="text-gray-500">Laden…</p>
        ) : backups.length === 0 ? (
          <p className="text-gray-500">Keine Backups vorhanden</p>
        ) : (
          <table className="w-full text-left text-sm">
            <thead>
              <tr className="border-b border-gray-700 text-xs text-gray-500">
                <th className="pb-2">Datum</th>
                <th className="pb-2">Datei</th>
                <th className="pb-2">Typ</th>
                <th className="pb-2">Größe</th>
              </tr>
            </thead>
            <tbody>
              {backups.map((b) => (
                <tr key={b.id} className="border-b border-gray-800/50">
                  <td className="py-2">{new Date(b.createdAt).toLocaleString('de-DE')}</td>
                  <td className="py-2 font-mono text-xs">{b.filename}</td>
                  <td className="py-2">{b.type}</td>
                  <td className="py-2">{(b.sizeBytes / 1024).toFixed(1)} KB</td>
                </tr>
              ))}
            </tbody>
          </table>
        )}
      </div>
    </div>
  );
}
