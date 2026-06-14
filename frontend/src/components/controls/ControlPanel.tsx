import { useState } from 'react';
import { executeControl } from '../../api/client';
import { useAuthStore } from '../../store/useAuthStore';
import { useDashboardStore } from '../../store/useDashboardStore';
import { ControlAction } from '../../types';
import { ConfirmDialog } from './ConfirmDialog';

interface ControlButton {
  action: ControlAction;
  label: string;
  variant: 'success' | 'danger' | 'warning' | 'ghost';
  confirmMessage: string;
}

const OBS_CONTROLS: ControlButton[] = [
  { action: 'obs-start', label: 'OBS starten', variant: 'success', confirmMessage: 'OBS Studio wirklich starten?' },
  { action: 'obs-stop', label: 'OBS stoppen', variant: 'danger', confirmMessage: 'OBS Studio wirklich stoppen? Der Stream wird unterbrochen.' },
  { action: 'obs-restart', label: 'OBS neu starten', variant: 'warning', confirmMessage: 'OBS Studio wirklich neu starten? Der Stream wird kurz unterbrochen.' },
];

const NOALBS_CONTROLS: ControlButton[] = [
  { action: 'noalbs-start', label: 'NOALBS starten', variant: 'success', confirmMessage: 'NOALBS wirklich starten?' },
  { action: 'noalbs-stop', label: 'NOALBS stoppen', variant: 'danger', confirmMessage: 'NOALBS wirklich stoppen?' },
  { action: 'noalbs-restart', label: 'NOALBS neu starten', variant: 'warning', confirmMessage: 'NOALBS wirklich neu starten?' },
];

const variantClasses = {
  success: 'btn-success',
  danger: 'btn-danger',
  warning: 'btn-warning',
  ghost: 'btn-ghost',
};

export function ControlPanel() {
  const canExecute = useAuthStore((s) => s.hasAnyPermission(['obs.control', 'noalbs.control', 'control:execute']));
  const [pendingAction, setPendingAction] = useState<ControlButton | null>(null);
  const [resultMessage, setResultMessage] = useState<{ type: 'success' | 'error'; text: string } | null>(null);
  const controlLoading = useDashboardStore((s) => s.controlLoading);
  const setControlLoading = useDashboardStore((s) => s.setControlLoading);

  const handleConfirm = async () => {
    if (!pendingAction) return;

    setControlLoading(pendingAction.action);
    setResultMessage(null);

    try {
      const result = await executeControl(pendingAction.action);
      setResultMessage({
        type: result.success ? 'success' : 'error',
        text: result.message,
      });
    } catch {
      setResultMessage({ type: 'error', text: 'Steuerbefehl fehlgeschlagen' });
    } finally {
      setControlLoading(null);
      setPendingAction(null);
    }
  };

  const renderButtons = (controls: ControlButton[]) =>
    controls.map((ctrl) => (
      <button
        key={ctrl.action}
        className={variantClasses[ctrl.variant]}
        disabled={controlLoading !== null}
        onClick={() => setPendingAction(ctrl)}
      >
        {controlLoading === ctrl.action ? 'Wird ausgeführt…' : ctrl.label}
      </button>
    ));

  if (!canExecute) {
    return (
      <div className="card">
        <h2 className="mb-2 text-lg font-semibold">Steuerung</h2>
        <p className="text-sm text-gray-500">Nur-Lese-Zugriff – keine Steuerberechtigung</p>
      </div>
    );
  }

  return (
    <div className="card">
      <h2 className="mb-4 flex items-center gap-2 text-lg font-semibold">
        <svg className="h-5 w-5 text-accent-yellow" fill="none" viewBox="0 0 24 24" stroke="currentColor">
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 6V4m0 2a2 2 0 100 4m0-4a2 2 0 110 4m-6 8a2 2 0 100-4m0 4a2 2 0 110-4m0 4v2m0-6V4m6 6v10m6-2a2 2 0 100-4m0 4a2 2 0 110-4m0 4v2m0-6V4" />
        </svg>
        Steuerung
      </h2>

      {resultMessage && (
        <div
          className={`mb-4 rounded-lg px-4 py-2 text-sm ${
            resultMessage.type === 'success'
              ? 'bg-green-500/20 text-accent'
              : 'bg-red-500/20 text-accent-red'
          }`}
        >
          {resultMessage.text}
        </div>
      )}

      <div className="space-y-4">
        <div>
          <h3 className="mb-2 text-sm font-medium text-gray-400">OBS Studio</h3>
          <div className="flex flex-wrap gap-2">{renderButtons(OBS_CONTROLS)}</div>
        </div>

        <div>
          <h3 className="mb-2 text-sm font-medium text-gray-400">NOALBS</h3>
          <div className="flex flex-wrap gap-2">{renderButtons(NOALBS_CONTROLS)}</div>
        </div>

        <div className="border-t border-gray-700 pt-4">
          <h3 className="mb-2 text-sm font-medium text-gray-400">Server</h3>
          <button
            className="btn-danger"
            disabled={controlLoading !== null}
            onClick={() =>
              setPendingAction({
                action: 'server-reboot',
                label: 'Server neustarten',
                variant: 'danger',
                confirmMessage:
                  'Server wirklich neustarten? Alle Dienste werden in 1 Minute heruntergefahren.',
              })
            }
          >
            {controlLoading === 'server-reboot' ? 'Wird geplant…' : 'Server neustarten'}
          </button>
        </div>
      </div>

      {pendingAction && (
        <ConfirmDialog
          title="Aktion bestätigen"
          message={pendingAction.confirmMessage}
          confirmLabel={pendingAction.label}
          variant={
            pendingAction.variant === 'success'
              ? 'success'
              : pendingAction.variant === 'ghost'
                ? 'primary'
                : pendingAction.variant
          }
          onConfirm={handleConfirm}
          onCancel={() => setPendingAction(null)}
        />
      )}
    </div>
  );
}
