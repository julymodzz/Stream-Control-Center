import { ReactNode } from 'react';

interface MetricCardProps {
  label: string;
  value: string | number;
  unit?: string;
  subtext?: string;
  valueClassName?: string;
  icon?: ReactNode;
}

export function MetricCard({
  label,
  value,
  unit,
  subtext,
  valueClassName = '',
  icon,
}: MetricCardProps) {
  return (
    <div className="rounded-lg bg-surface-lighter/50 p-4">
      <div className="mb-1 flex items-center justify-between">
        <span className="text-xs font-medium uppercase tracking-wider text-gray-400">
          {label}
        </span>
        {icon && <span className="text-gray-500">{icon}</span>}
      </div>
      <div className={`metric-value ${valueClassName}`}>
        {value}
        {unit && <span className="ml-1 text-sm font-normal text-gray-400">{unit}</span>}
      </div>
      {subtext && <p className="mt-1 text-xs text-gray-500">{subtext}</p>}
    </div>
  );
}
