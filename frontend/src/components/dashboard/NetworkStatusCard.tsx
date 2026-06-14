import { useDashboardStore } from '../../store/useDashboardStore';
import { formatTimestamp } from '../../utils/format';
import { StatusBadge } from '../common/StatusBadge';

export function NetworkStatusCard() {
  const network = useDashboardStore((s) => s.dashboard?.network);

  if (!network) {
    return (
      <div className="card animate-pulse">
        <h2 className="mb-4 text-lg font-semibold">Netzwerküberwachung</h2>
        <div className="h-32 rounded-lg bg-surface-lighter" />
      </div>
    );
  }

  return (
    <div className="card">
      <div className="mb-4 flex items-center justify-between">
        <h2 className="flex items-center gap-2 text-lg font-semibold">
          <svg className="h-5 w-5 text-accent-blue" fill="none" viewBox="0 0 24 24" stroke="currentColor">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M21 12a9 9 0 01-9 9m9-9a9 9 0 00-9-9m9 9H3m9 9a9 9 0 01-9-9m9 9c1.657 0 3-4.03 3-9s-1.343-9-3-9m0 18c-1.657 0-3-4.03-3-9s1.343-9 3-9m-9 9a9 9 0 019-9" />
          </svg>
          Netzwerküberwachung
        </h2>
        <StatusBadge
          online={network.internetOnline}
          label={network.internetOnline ? 'Internet OK' : 'Internet ausgefallen'}
        />
      </div>

      <div className="overflow-x-auto">
        <table className="w-full text-sm">
          <thead>
            <tr className="border-b border-gray-700 text-left text-xs uppercase tracking-wider text-gray-400">
              <th className="pb-3 pr-4">Ziel</th>
              <th className="pb-3 pr-4">Ping</th>
              <th className="pb-3 pr-4">Paketverlust</th>
              <th className="pb-3">Letzte Verbindung</th>
            </tr>
          </thead>
          <tbody>
            {network.pings.map((ping) => (
              <tr key={ping.host} className="border-b border-gray-700/50">
                <td className="py-3 pr-4 font-medium">{ping.host}</td>
                <td className="py-3 pr-4">
                  {ping.latencyMs !== null ? (
                    <span
                      className={
                        ping.latencyMs > 200
                          ? 'font-semibold text-accent-yellow'
                          : ping.reachable
                            ? 'text-accent'
                            : 'text-accent-red'
                      }
                    >
                      {ping.latencyMs} ms
                    </span>
                  ) : (
                    <span className="text-accent-red">Timeout</span>
                  )}
                </td>
                <td className="py-3 pr-4">
                  <span className={ping.packetLossPercent > 0 ? 'text-accent-yellow' : 'text-accent'}>
                    {ping.packetLossPercent}%
                  </span>
                </td>
                <td className="py-3 text-gray-400">{formatTimestamp(ping.lastSuccess)}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}
