interface ProgressBarProps {
  percent: number;
  label?: string;
}

export function ProgressBar({ percent, label }: ProgressBarProps) {
  const clamped = Math.min(100, Math.max(0, percent));
  const color =
    clamped >= 90 ? 'bg-accent-red' : clamped >= 70 ? 'bg-accent-yellow' : 'bg-accent';

  return (
    <div className="w-full">
      {label && (
        <div className="mb-1 flex justify-between text-xs text-gray-400">
          <span>{label}</span>
          <span>{clamped.toFixed(1)}%</span>
        </div>
      )}
      <div className="h-2 w-full overflow-hidden rounded-full bg-gray-700">
        <div
          className={`h-full rounded-full transition-all duration-500 ${color}`}
          style={{ width: `${clamped}%` }}
        />
      </div>
    </div>
  );
}
