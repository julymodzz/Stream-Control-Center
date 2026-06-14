import { NavLink } from 'react-router-dom';
import {
  Activity,
  Bell,
  FileSearch,
  LayoutDashboard,
  Layers,
  Radio,
  Settings,
  Shield,
  Twitch,
  Users,
} from 'lucide-react';
import { useAuthStore } from '../../store/useAuthStore';
import { cn } from '../../lib/utils';

const links = [
  { to: '/', label: 'Dashboard', icon: LayoutDashboard },
  { to: '/monitoring', label: 'Monitoring', icon: Activity, permission: 'monitoring.view' },
  { to: '/obs', label: 'OBS', icon: Radio, permission: 'dashboard.view' },
  { to: '/twitch', label: 'Twitch', icon: Twitch, permission: 'dashboard.view' },
  { to: '/noalbs', label: 'NOALBS', icon: Layers, permission: 'dashboard.view' },
  { to: '/alerts', label: 'Alerts', icon: Bell, permission: 'alerts.view' },
  { to: '/audit', label: 'Audit Logs', icon: FileSearch, permission: 'audit.view' },
  { to: '/users', label: 'Benutzer & Rollen', icon: Users, permission: 'users.view' },
  { to: '/settings', label: 'Einstellungen', icon: Settings, permission: 'settings.view' },
];

export function Sidebar() {
  const hasPermission = useAuthStore((s) => s.hasPermission);

  return (
    <aside className="hidden w-60 shrink-0 border-r border-gray-700/50 bg-surface-light md:block">
      <nav className="space-y-0.5 p-3">
        {links
          .filter((l) => !l.permission || hasPermission(l.permission))
          .map((link) => (
            <NavLink
              key={link.to}
              to={link.to}
              end={link.to === '/'}
              className={({ isActive }) =>
                cn(
                  'flex items-center gap-3 rounded-lg px-3 py-2.5 text-sm font-medium transition-colors',
                  isActive
                    ? 'bg-accent-blue/10 text-accent-blue'
                    : 'text-gray-400 hover:bg-white/5 hover:text-gray-200'
                )
              }
            >
              <link.icon className="h-4 w-4 shrink-0" />
              {link.label}
            </NavLink>
          ))}

        <div className="my-3 border-t border-gray-700/50" />

        <NavLink
          to="/profile"
          className={({ isActive }) =>
            cn('flex items-center gap-3 rounded-lg px-3 py-2.5 text-sm', isActive ? 'bg-white/5 text-white' : 'text-gray-500 hover:text-gray-300')
          }
        >
          <Users className="h-4 w-4" />
          Profil
        </NavLink>
        <NavLink
          to="/security"
          className={({ isActive }) =>
            cn('flex items-center gap-3 rounded-lg px-3 py-2.5 text-sm', isActive ? 'bg-white/5 text-white' : 'text-gray-500 hover:text-gray-300')
          }
        >
          <Shield className="h-4 w-4" />
          Sicherheit
        </NavLink>
      </nav>
    </aside>
  );
}
