import { create } from 'zustand';
import { persist } from 'zustand/middleware';
import { AuthUser } from '../types';

const LEGACY_MAP: Record<string, string> = {
  'dashboard:read': 'dashboard.view',
  'metrics:read': 'monitoring.view',
  'logs:read': 'logs.view',
  'alerts:read': 'alerts.view',
  'alerts:manage': 'alerts.manage',
  'audit:read': 'audit.view',
  'control:execute': 'obs.control',
  'obs:control': 'obs.control',
  'backup:read': 'backup.view',
  'backup:manage': 'backup.manage',
  'users:read': 'users.view',
  'users:manage': 'users.edit',
  'settings:read': 'settings.view',
  'settings:manage': 'settings.manage',
};

function normalizePerm(perm: string): string {
  return LEGACY_MAP[perm] ?? perm;
}

interface AuthState {
  accessToken: string | null;
  user: AuthUser | null;
  setAuth: (token: string, user: AuthUser) => void;
  clearAuth: () => void;
  hasPermission: (permission: string) => boolean;
  hasAnyPermission: (permissions: string[]) => boolean;
}

export const useAuthStore = create<AuthState>()(
  persist(
    (set, get) => ({
      accessToken: null,
      user: null,
      setAuth: (token, user) => set({ accessToken: token, user }),
      clearAuth: () => set({ accessToken: null, user: null }),
      hasPermission: (permission) => {
        const perms = get().user?.permissions ?? [];
        const normalized = normalizePerm(permission);
        return perms.includes(normalized) || perms.includes(permission);
      },
      hasAnyPermission: (required) => required.some((p) => get().hasPermission(p)),
    }),
    { name: 'scc-auth', partialize: (s) => ({ accessToken: s.accessToken, user: s.user }) }
  )
);
