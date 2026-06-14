import { useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import { Shield, UserCog } from 'lucide-react';
import { fetchPreferences, savePreferences } from '../api/client';
import { UserPreferences } from '../types';
import { useThemeStore } from '../store/useThemeStore';

export function SettingsPage() {
  const [prefs, setPrefs] = useState<UserPreferences | null>(null);
  const { setTheme } = useThemeStore();

  useEffect(() => {
    fetchPreferences()
      .then(setPrefs)
      .catch(() => setPrefs(null));
  }, []);

  const updateTheme = async (theme: UserPreferences['theme']) => {
    setTheme(theme);
    const updated = await savePreferences({ theme });
    setPrefs(updated);
  };

  return (
    <div className="space-y-6 p-4 md:p-6">
      <h2 className="text-lg font-semibold">Einstellungen</h2>

      <div className="card space-y-4">
        <h3 className="font-semibold">Darstellung</h3>
        <div className="flex gap-2">
          {(['dark', 'light', 'system'] as const).map((t) => (
            <button
              key={t}
              type="button"
              onClick={() => updateTheme(t)}
              className={`btn-ghost ${prefs?.theme === t ? 'border-accent text-accent' : ''}`}
            >
              {t === 'dark' ? 'Dunkel' : t === 'light' ? 'Hell' : 'System'}
            </button>
          ))}
        </div>
      </div>

      <div className="card space-y-3">
        <h3 className="font-semibold">Identity & Access</h3>
        <div className="flex flex-wrap gap-2">
          <Link to="/users" className="btn-ghost inline-flex items-center gap-2 text-sm"><UserCog className="h-4 w-4" /> Benutzer</Link>
          <Link to="/roles" className="btn-ghost inline-flex items-center gap-2 text-sm"><Shield className="h-4 w-4" /> Rollen</Link>
          <Link to="/security" className="btn-ghost inline-flex items-center gap-2 text-sm"><Shield className="h-4 w-4" /> Sicherheit</Link>
          <Link to="/profile" className="btn-ghost inline-flex items-center gap-2 text-sm">Profil</Link>
        </div>
      </div>

      <div className="card space-y-2">
        <h3 className="font-semibold">Benachrichtigungen</h3>
        <p className="text-sm text-gray-500">
          Browser-Benachrichtigungen: {prefs?.notificationsEnabled ? 'Aktiv' : 'Inaktiv'}
        </p>
      </div>

      <div className="card space-y-2">
        <h3 className="font-semibold">Dashboard-Widgets</h3>
        <p className="text-sm text-gray-500">
          {prefs?.dashboardLayout?.length ?? 0} Widgets konfiguriert. Drag-and-Drop auf dem Dashboard verfügbar.
        </p>
      </div>
    </div>
  );
}
