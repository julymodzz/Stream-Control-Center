import { describe, expect, it } from 'vitest';
import { hasPermission, canManageUser, normalizePermission } from '../iam/permissions';

describe('Enterprise PBAC', () => {
  const superAdminPerms = ['users.create', 'users.delete', 'audit.delete', 'roles.manage'];

  it('super admin has all permissions', () => {
    expect(hasPermission(superAdminPerms, 'users.delete')).toBe(true);
    expect(hasPermission(superAdminPerms, 'audit.delete')).toBe(true);
  });

  it('operator cannot manage users', () => {
    const operatorPerms = ['dashboard.view', 'obs.control', 'noalbs.control'];
    expect(hasPermission(operatorPerms, 'obs.control')).toBe(true);
    expect(hasPermission(operatorPerms, 'users.create')).toBe(false);
  });

  it('maps legacy permissions', () => {
    expect(normalizePermission('dashboard:read')).toBe('dashboard.view');
    expect(normalizePermission('audit:read')).toBe('audit.view');
  });

  it('admin cannot manage super_admin users', () => {
    const adminPerms = ['users.edit', 'users.change_role'];
    expect(canManageUser(adminPerms, 'admin', 'operator')).toBe(true);
    expect(canManageUser(adminPerms, 'admin', 'super_admin')).toBe(false);
  });

  it('viewer is read-only', () => {
    const viewerPerms = ['dashboard.view', 'monitoring.view', 'logs.view'];
    expect(hasPermission(viewerPerms, 'dashboard.view')).toBe(true);
    expect(hasPermission(viewerPerms, 'obs.control')).toBe(false);
  });
});
