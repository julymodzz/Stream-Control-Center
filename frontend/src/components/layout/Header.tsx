import { logout } from '../../api/client';
import { useAuthStore } from '../../store/useAuthStore';
import { useDashboardStore } from '../../store/useDashboardStore';
import { useThemeStore } from '../../store/useThemeStore';

export function Header() {
  const user = useAuthStore((s) => s.user);
  const connected = useDashboardStore((s) => s.connected);
  const { theme, setTheme } = useThemeStore();

  const cycleTheme = () => {
    const next = theme === 'dark' ? 'light' : theme === 'light' ? 'system' : 'dark';
    setTheme(next);
  };

  return (
    <header className="sticky top-0 z-50 border-b border-gray-700/50 bg-surface/95 backdrop-blur">
      <div className="flex items-center justify-between px-4 py-3 md:px-6">
        <div className="flex items-center gap-3">
          <div className="flex h-9 w-9 items-center justify-center rounded-lg bg-accent/20 text-lg">
            📡
          </div>
          <div>
            <h1 className="text-lg font-bold tracking-tight">Stream Control Center</h1>
            <p className="text-xs text-gray-500">v2.0 · Security-First</p>
          </div>
        </div>

        <div className="flex items-center gap-3">
          <span
            className={`hidden items-center gap-1.5 rounded-full px-2.5 py-1 text-xs sm:flex ${
              connected ? 'bg-green-500/20 text-green-400' : 'bg-red-500/20 text-red-400'
            }`}
          >
            <span className={`h-1.5 w-1.5 rounded-full ${connected ? 'bg-green-400' : 'bg-red-400'}`} />
            {connected ? 'Live' : 'Offline'}
          </span>

          <button type="button" onClick={cycleTheme} className="btn-ghost px-2 py-1 text-xs" title="Theme wechseln">
            {theme === 'dark' ? '🌙' : theme === 'light' ? '☀️' : '🖥️'}
          </button>

          {user && (
            <div className="flex items-center gap-2">
              <span className="hidden text-sm text-gray-400 sm:inline">
                {user.displayName || user.username}{' '}
                <span className="text-gray-600">({user.roleName ?? user.roleSlug})</span>
              </span>
              <button type="button" onClick={() => logout()} className="btn-ghost text-xs">
                Abmelden
              </button>
            </div>
          )}
        </div>
      </div>
    </header>
  );
}
