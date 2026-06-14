import { Line, LineChart, ResponsiveContainer, Tooltip, XAxis, YAxis } from 'recharts';
import { MetricsHistoryPoint } from '../../types';

interface NetworkChartProps {
  data: MetricsHistoryPoint[];
}

export function NetworkChart({ data }: NetworkChartProps) {
  const chartData = (data ?? []).map((p) => ({
    time: new Date(p.timestamp).toLocaleTimeString('de-DE', { hour: '2-digit', minute: '2-digit' }),
    Upload: Math.round((p.uploadBytesPerSec ?? 0) / 1024),
    Download: Math.round((p.downloadBytesPerSec ?? 0) / 1024),
  }));

  if (chartData.length === 0) {
    return (
      <div className="card flex h-48 items-center justify-center text-gray-500">
        Keine Netzwerkdaten
      </div>
    );
  }

  return (
    <div className="card">
      <h3 className="mb-4 text-sm font-semibold text-gray-400">Netzwerk-Traffic (KB/s)</h3>
      <ResponsiveContainer width="100%" height={200}>
        <LineChart data={chartData}>
          <XAxis dataKey="time" stroke="#9ca3af" fontSize={11} />
          <YAxis stroke="#9ca3af" fontSize={11} />
          <Tooltip contentStyle={{ background: '#22262e', border: '1px solid #374151' }} />
          <Line type="monotone" dataKey="Upload" stroke="#22c55e" dot={false} />
          <Line type="monotone" dataKey="Download" stroke="#3b82f6" dot={false} />
        </LineChart>
      </ResponsiveContainer>
    </div>
  );
}
