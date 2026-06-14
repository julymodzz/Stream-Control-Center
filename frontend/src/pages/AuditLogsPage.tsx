import { useEffect, useState } from 'react';
import { fetchAuditLogs } from '../api/client';
import { AuditLogEntry } from '../types';

export function AuditLogsPage() {
  const [entries, setEntries] = useState<AuditLogEntry[]>([]);
  const [total, setTotal] = useState(0);
  const [query, setQuery] = useState('');
  const [loading, setLoading] = useState(true);

  const load = async (search = query) => {
    setLoading(true);
    try {
      const result = await fetchAuditLogs({ query: search, limit: '100' });
      setEntries(result?.entries ?? []);
      setTotal(result?.total ?? 0);
    } catch {
      setEntries([]);
      setTotal(0);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    load();
  }, []);

  return (
    <div className="space-y-4 p-4 md:p-6">
      <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
        <h2 className="text-lg font-semibold">Audit Logs ({total})</h2>
        <div className="flex gap-2">
          <input
            type="search"
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            placeholder="Suchen…"
            className="rounded-lg border border-gray-600 bg-surface px-3 py-1.5 text-sm"
          />
          <button type="button" onClick={() => load(query)} className="btn-primary">
            Suchen
          </button>
        </div>
      </div>

      <div className="card overflow-x-auto">
        {loading ? (
          <p className="text-gray-500">Laden…</p>
        ) : entries.length === 0 ? (
          <p className="text-gray-500">Keine Audit-Einträge gefunden</p>
        ) : (
          <table className="w-full text-left text-sm">
            <thead>
              <tr className="border-b border-gray-700 text-xs text-gray-500">
                <th className="pb-2 pr-4">Zeit</th>
                <th className="pb-2 pr-4">Benutzer</th>
                <th className="pb-2 pr-4">Aktion</th>
                <th className="pb-2 pr-4">Ressource</th>
                <th className="pb-2 pr-4">IP</th>
                <th className="pb-2">Status</th>
              </tr>
            </thead>
            <tbody>
              {entries.map((e) => (
                <tr key={e.id} className="border-b border-gray-800/50">
                  <td className="py-2 pr-4 font-mono text-xs text-gray-500">
                    {new Date(e.timestamp).toLocaleString('de-DE')}
                  </td>
                  <td className="py-2 pr-4">{e.username}</td>
                  <td className="py-2 pr-4">{e.action}</td>
                  <td className="py-2 pr-4 text-gray-400">{e.resource}</td>
                  <td className="py-2 pr-4 font-mono text-xs">{e.sourceIp}</td>
                  <td className="py-2">
                    <span className={e.success ? 'text-green-400' : 'text-red-400'}>
                      {e.success ? 'OK' : 'Fehler'}
                    </span>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        )}
      </div>
    </div>
  );
}
