export type { Permission } from '../iam/permissions';
export {
  ALL_PERMISSIONS,
  hasPermission,
  hasAnyPermission,
  normalizePermission,
  LEGACY_PERMISSION_MAP,
} from '../iam/permissions';
export type { Role } from '../iam/RoleStore';

/** @deprecated Verwende hasPermission mit permissions-Array aus JWT */
export function getPermissions(_role: string): string[] {
  return [];
}
