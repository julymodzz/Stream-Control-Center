import { useEffect, useState } from 'react';
import { fetchMetricsHistory } from '../api/client';
import { MetricChart } from '../components/charts/MetricChart';
import { NetworkChart } from '../components/charts/NetworkChart';
import { MetricsHistoryPoint } from '../types';

export function MetricsPage() {
  const [history, setHistory] = useState<MetricsHistoryPoint[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const load = async () => {
      try {
        const data = await fetchMetricsHistory();
        setHistory(data ?? []);
      } catch {
        setHistory([]);
      } finally {
        setLoading(false);
      }
    };
    load();
    const interval = setInterval(load, 5000);
    return () => clearInterval(interval);
  }, []);

  if (loading) {
    return <div className="p-6 text-gray-500">Metriken werden geladen…</div>;
  }

  return (
    <div className="space-y-6 p-4 md:p-6">
      <h2 className="text-lg font-semibold">Live-Metriken</h2>
      <MetricChart data={history} title="System-Auslastung (%)" />
      <NetworkChart data={history} />
    </div>
  );
}
