interface StatusBadgeProps {
  online: boolean;
  label?: string;
}

export function StatusBadge({ online, label }: StatusBadgeProps) {
  return (
    <span
      className={`inline-flex items-center gap-1.5 rounded-full px-2.5 py-0.5 text-xs font-semibold ${
        online
          ? 'bg-green-500/20 text-accent'
          : 'bg-red-500/20 text-accent-red'
      }`}
    >
      <span
        className={`h-2 w-2 rounded-full ${online ? 'bg-accent animate-pulse' : 'bg-accent-red'}`}
      />
      {label ?? (online ? 'Online' : 'Offline')}
    </span>
  );
}
