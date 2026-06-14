import { useDashboardStore } from '../../store/useDashboardStore';
import { formatBytes, formatUptime, getPercentColor } from '../../utils/format';
import { MetricCard } from '../common/MetricCard';
import { ProgressBar } from '../common/ProgressBar';

export function SystemStatusCard() {
  const system = useDashboardStore((s) => s.dashboard?.system);

  if (!system) {
    return (
      <div className="card animate-pulse">
        <h2 className="mb-4 text-lg font-semibold">Systemstatus</h2>
        <div className="grid grid-cols-2 gap-4 lg:grid-cols-3">
          {[...Array(6)].map((_, i) => (
            <div key={i} className="h-20 rounded-lg bg-surface-lighter" />
          ))}
        </div>
      </div>
    );
  }

  return (
    <div className="card">
      <h2 className="mb-4 flex items-center gap-2 text-lg font-semibold">
        <svg className="h-5 w-5 text-accent-blue" fill="none" viewBox="0 0 24 24" stroke="currentColor">
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 3v2m6-2v2M9 19v2m6-2v2M5 9H3m2 6H3m18-6h-2m2 6h-2M7 19h10a2 2 0 002-2V7a2 2 0 00-2-2H7a2 2 0 00-2 2v10a2 2 0 002 2zM9 9h6v6H9V9z" />
        </svg>
        Systemstatus
      </h2>

      <div className="mb-4 grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-3">
        <MetricCard
          label="CPU"
          value={system.cpuPercent}
          unit="%"
          valueClassName={getPercentColor(system.cpuPercent)}
        />
        <MetricCard
          label="RAM"
          value={system.ramPercent}
          unit="%"
          subtext={`${system.ramUsedMb} / ${system.ramTotalMb} MB`}
          valueClassName={getPercentColor(system.ramPercent)}
        />
        <MetricCard
          label="Festplatte"
          value={system.diskPercent}
          unit="%"
          subtext={`${system.diskUsedGb} / ${system.diskTotalGb} GB`}
          valueClassName={getPercentColor(system.diskPercent)}
        />
        <MetricCard
          label="Uptime"
          value={formatUptime(system.uptimeSeconds)}
          valueClassName="text-gray-100"
        />
        <MetricCard
          label="Upload"
          value={formatBytes(system.network.uploadBytesPerSec)}
          valueClassName="text-accent-blue"
        />
        <MetricCard
          label="Download"
          value={formatBytes(system.network.downloadBytesPerSec)}
          valueClassName="text-accent-blue"
        />
      </div>

      <div className="space-y-3">
        <ProgressBar percent={system.cpuPercent} label="CPU-Auslastung" />
        <ProgressBar percent={system.ramPercent} label="RAM-Auslastung" />
        <ProgressBar percent={system.diskPercent} label="Festplattenauslastung" />
      </div>
    </div>
  );
}
