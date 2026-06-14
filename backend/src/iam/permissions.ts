/** Enterprise PBAC – alle Systemberechtigungen */
export const ALL_PERMISSIONS = [
  'users.create',
  'users.edit',
  'users.delete',
  'users.reset_password',
  'users.change_role',
  'users.view',
  'users.disable',
  'users.reset_2fa',
  'dashboard.view',
  'monitoring.view',
  'logs.view',
  'obs.control',
  'noalbs.control',
  'alerts.manage',
  'alerts.view',
  'audit.view',
  'audit.delete',
  'settings.manage',
  'settings.view',
  'roles.manage',
  'roles.view',
  'backup.view',
  'backup.manage',
  'api_tokens.manage',
  'sessions.manage',
  'profile.edit',
] as const;

export type Permission = (typeof ALL_PERMISSIONS)[number];

/** Abwärtskompatibilität v2.0 → Enterprise PBAC */
export const LEGACY_PERMISSION_MAP: Record<string, Permission> = {
  'dashboard:read': 'dashboard.view',
  'metrics:read': 'monitoring.view',
  'logs:read': 'logs.view',
  'alerts:read': 'alerts.view',
  'alerts:manage': 'alerts.manage',
  'audit:read': 'audit.view',
  'control:read': 'dashboard.view',
  'control:execute': 'obs.control',
  'obs:control': 'obs.control',
  'backup:read': 'backup.view',
  'backup:manage': 'backup.manage',
  'users:read': 'users.view',
  'users:manage': 'users.edit',
  'settings:read': 'settings.view',
  'settings:manage': 'settings.manage',
};

export const SYSTEM_ROLE_PERMISSIONS: Record<string, Permission[]> = {
  super_admin: [...ALL_PERMISSIONS],
  admin: [
    'users.create', 'users.edit', 'users.delete', 'users.reset_password',
    'users.change_role', 'users.view', 'users.disable', 'users.reset_2fa',
    'dashboard.view', 'monitoring.view', 'logs.view',
    'obs.control', 'noalbs.control',
    'alerts.manage', 'alerts.view',
    'audit.view', 'settings.manage', 'settings.view',
    'roles.view', 'backup.view', 'backup.manage',
    'sessions.manage', 'profile.edit', 'api_tokens.manage',
  ],
  operator: [
    'dashboard.view', 'monitoring.view', 'logs.view',
    'obs.control', 'noalbs.control',
    'alerts.view', 'alerts.manage',
    'settings.view', 'profile.edit', 'sessions.manage',
  ],
  viewer: [
    'dashboard.view', 'monitoring.view', 'logs.view',
    'alerts.view', 'settings.view', 'profile.edit', 'sessions.manage',
  ],
};

export function normalizePermission(perm: string): Permission | null {
  if ((ALL_PERMISSIONS as readonly string[]).includes(perm)) {
    return perm as Permission;
  }
  return LEGACY_PERMISSION_MAP[perm] ?? null;
}

export function hasPermission(userPermissions: string[], required: string): boolean {
  const normalized = normalizePermission(required);
  if (!normalized) return false;
  return userPermissions.includes(normalized);
}

export function hasAnyPermission(userPermissions: string[], required: string[]): boolean {
  return required.some((p) => hasPermission(userPermissions, p));
}

export function canManageUser(
  actorPermissions: string[],
  actorRoleSlug: string,
  targetRoleSlug: string
): boolean {
  if (!hasPermission(actorPermissions, 'users.edit')) return false;
  if (targetRoleSlug === 'super_admin' && actorRoleSlug !== 'super_admin') return false;
  return true;
}
