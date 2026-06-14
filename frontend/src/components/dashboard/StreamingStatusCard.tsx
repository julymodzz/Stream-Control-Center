import { useDashboardStore } from '../../store/useDashboardStore';
import { StatusBadge } from '../common/StatusBadge';

export function StreamingStatusCard() {
  const streaming = useDashboardStore((s) => s.dashboard?.streaming);

  if (!streaming) {
    return (
      <div className="card animate-pulse">
        <h2 className="mb-4 text-lg font-semibold">Streamingstatus</h2>
        <div className="h-32 rounded-lg bg-surface-lighter" />
      </div>
    );
  }

  return (
    <div className="card">
      <h2 className="mb-4 flex items-center gap-2 text-lg font-semibold">
        <svg className="h-5 w-5 text-accent" fill="none" viewBox="0 0 24 24" stroke="currentColor">
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 10l4.553-2.276A1 1 0 0121 8.618v6.764a1 1 0 01-1.447.894L15 14M5 18h8a2 2 0 002-2V8a2 2 0 00-2-2H5a2 2 0 00-2 2v8a2 2 0 002 2z" />
        </svg>
        Streamingstatus
      </h2>

      <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
        <div className="rounded-lg bg-surface-lighter/50 p-4">
          <div className="mb-2 flex items-center justify-between">
            <span className="font-medium">OBS Studio</span>
            <StatusBadge online={streaming.obsRunning} label={streaming.obsRunning ? 'Läuft' : 'Gestoppt'} />
          </div>
          <p className="text-sm text-gray-400">
            Szene: <span className="text-gray-200">{streaming.currentScene ?? '–'}</span>
          </p>
          <p className="mt-1 text-xs text-gray-500">
            WebSocket: {streaming.obs?.connected ? 'Verbunden' : 'Getrennt'}
          </p>
        </div>

        <div className="rounded-lg bg-surface-lighter/50 p-4">
          <div className="mb-2 flex items-center justify-between">
            <span className="font-medium">NOALBS</span>
            <StatusBadge online={streaming.noalbsRunning} label={streaming.noalbsRunning ? 'Läuft' : 'Gestoppt'} />
          </div>
        </div>

        <div className="rounded-lg bg-surface-lighter/50 p-4 sm:col-span-2">
          <div className="flex flex-wrap items-center gap-6">
            <div>
              <span className="text-xs uppercase tracking-wider text-gray-400">Stream</span>
              <div className="mt-1">
                <StatusBadge
                  online={streaming.streamOnline}
                  label={streaming.streamOnline ? 'Online' : 'Offline'}
                />
              </div>
            </div>
            <div>
              <span className="text-xs uppercase tracking-wider text-gray-400">Bitrate</span>
              <p className="mt-1 text-lg font-semibold">
                {streaming.bitrateKbps !== null ? `${streaming.bitrateKbps} kbps` : '–'}
              </p>
            </div>
            <div>
              <span className="text-xs uppercase tracking-wider text-gray-400">Aufnahme</span>
              <div className="mt-1">
                <StatusBadge
                  online={streaming.recordingActive ?? false}
                  label={streaming.recordingActive ? 'Aktiv' : 'Inaktiv'}
                />
              </div>
            </div>
            <div>
              <span className="text-xs uppercase tracking-wider text-gray-400">Twitch</span>
              <div className="mt-1">
                <StatusBadge
                  online={streaming.twitchConnected ?? false}
                  label={streaming.twitchConnected ? 'Verbunden' : 'Offline'}
                />
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
