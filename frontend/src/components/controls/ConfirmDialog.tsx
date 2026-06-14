interface ConfirmDialogProps {
  title: string;
  message: string;
  confirmLabel: string;
  variant?: 'primary' | 'danger' | 'warning' | 'success';
  onConfirm: () => void;
  onCancel: () => void;
}

const confirmClasses = {
  primary: 'btn-primary',
  danger: 'btn-danger',
  warning: 'btn-warning',
  success: 'btn-success',
};

export function ConfirmDialog({
  title,
  message,
  confirmLabel,
  variant = 'danger',
  onConfirm,
  onCancel,
}: ConfirmDialogProps) {
  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 p-4 backdrop-blur-sm">
      <div className="w-full max-w-md rounded-xl border border-gray-600 bg-surface-light p-6 shadow-2xl">
        <h3 className="text-lg font-semibold">{title}</h3>
        <p className="mt-2 text-sm text-gray-400">{message}</p>
        <div className="mt-6 flex justify-end gap-3">
          <button className="btn-ghost" onClick={onCancel}>
            Abbrechen
          </button>
          <button className={confirmClasses[variant]} onClick={onConfirm}>
            {confirmLabel}
          </button>
        </div>
      </div>
    </div>
  );
}
