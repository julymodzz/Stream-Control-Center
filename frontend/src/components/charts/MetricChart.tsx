import {
  Area,
  AreaChart,
  CartesianGrid,
  Legend,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from 'recharts';
import { MetricsHistoryPoint } from '../../types';

interface MetricChartProps {
  data: MetricsHistoryPoint[];
  title: string;
}

export function MetricChart({ data, title }: MetricChartProps) {
  const chartData = (data ?? []).map((p) => ({
    time: new Date(p.timestamp).toLocaleTimeString('de-DE', { hour: '2-digit', minute: '2-digit', second: '2-digit' }),
    CPU: p.cpuPercent ?? 0,
    RAM: p.ramPercent ?? 0,
    Disk: p.diskPercent ?? 0,
  }));

  if (chartData.length === 0) {
    return (
      <div className="card flex h-64 items-center justify-center text-gray-500">
        Keine Metrikdaten verfügbar
      </div>
    );
  }

  return (
    <div className="card">
      <h3 className="mb-4 text-sm font-semibold text-gray-400">{title}</h3>
      <ResponsiveContainer width="100%" height={260}>
        <AreaChart data={chartData}>
          <CartesianGrid strokeDasharray="3 3" stroke="#374151" />
          <XAxis dataKey="time" stroke="#9ca3af" fontSize={11} />
          <YAxis domain={[0, 100]} stroke="#9ca3af" fontSize={11} unit="%" />
          <Tooltip contentStyle={{ background: '#22262e', border: '1px solid #374151' }} />
          <Legend />
          <Area type="monotone" dataKey="CPU" stroke="#3b82f6" fill="#3b82f640" />
          <Area type="monotone" dataKey="RAM" stroke="#22c55e" fill="#22c55e40" />
          <Area type="monotone" dataKey="Disk" stroke="#eab308" fill="#eab30840" />
        </AreaChart>
      </ResponsiveContainer>
    </div>
  );
}
