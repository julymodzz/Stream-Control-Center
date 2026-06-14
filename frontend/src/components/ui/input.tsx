import { cn } from '../../lib/utils';

export function Input({ className, ...props }: React.InputHTMLAttributes<HTMLInputElement>) {
  return (
    <input
      className={cn(
        'flex h-9 w-full rounded-lg border border-gray-600 bg-surface px-3 py-1 text-sm text-gray-100 placeholder:text-gray-500 focus:border-accent-blue focus:outline-none focus:ring-1 focus:ring-accent-blue',
        className
      )}
      {...props}
    />
  );
}

export function Label({ className, ...props }: React.LabelHTMLAttributes<HTMLLabelElement>) {
  return <label className={cn('text-xs font-medium text-gray-400', className)} {...props} />;
}
