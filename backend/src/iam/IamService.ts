import { AuditService } from '../audit/AuditService';
import { User, UserPublic, UserStatus } from '../types';
import { ApiTokenStore } from './ApiTokenStore';
import { PasswordService } from './PasswordService';
import { Permission, canManageUser } from './permissions';
import { RoleStore } from './RoleStore';
import { SessionStore } from './SessionStore';
import { UserStore } from '../auth/UserStore';
import { TotpService } from '../auth/TotpService';

export class IamService {
  constructor(
    private userStore: UserStore,
    private roleStore: RoleStore,
    private sessionStore: SessionStore,
    private apiTokenStore: ApiTokenStore,
    private passwordService: PasswordService,
    private totpService: TotpService,
    private auditService: AuditService
  ) {}

  async initialize(): Promise<void> {
    await this.roleStore.initialize();
    await this.userStore.initialize();
    await this.sessionStore.initialize();
    await this.apiTokenStore.initialize();
  }

  getUserPermissions(user: User): Permission[] {
    return this.roleStore.getPermissionsForRole(user.roleId) as Permission[];
  }

  async getUserWithPermissions(id: string): Promise<{
    user: UserPublic;
    permissions: Permission[];
  } | null> {
    const user = await this.userStore.findById(id);
    if (!user) return null;
    return {
      user: this.userStore.toPublic(user),
      permissions: this.getUserPermissions(user),
    };
  }

  async listUsers(filters?: Parameters<UserStore['listUsers']>[0]): Promise<UserPublic[]> {
    return this.userStore.listUsers(filters);
  }

  async createUser(
    actorId: string,
    actorSlug: string,
    actorPerms: string[],
    data: Parameters<UserStore['createUser']>[0],
    ip: string
  ): Promise<UserPublic> {
    const role = await this.roleStore.findById(data.roleId);
    if (!role) throw new Error('Rolle nicht gefunden');
    if (!canManageUser(actorPerms, actorSlug, role.slug)) {
      throw new Error('Keine Berechtigung für diese Rolle');
    }

    const actor = await this.userStore.findById(actorId);
    const user = await this.userStore.createUser({ ...data, createdBy: actorId });
    await this.auditService.log(
      { userId: actorId, username: actor?.username ?? 'system', sourceIp: ip },
      'users.create',
      user.username,
      true,
      `Rolle: ${role.name}`
    );
    return user;
  }

  async updateUser(
    actorId: string,
    actorSlug: string,
    actorPerms: string[],
    userId: string,
    updates: Partial<Pick<User, 'displayName' | 'email' | 'roleId' | 'status' | 'profileImage'>>,
    ip: string
  ): Promise<UserPublic | null> {
    const target = await this.userStore.findById(userId);
    if (!target) return null;

    const targetRole = await this.roleStore.findById(target.roleId);
    if (!canManageUser(actorPerms, actorSlug, targetRole?.slug ?? '')) {
      throw new Error('Keine Berechtigung');
    }

    if (updates.roleId) {
      const newRole = await this.roleStore.findById(updates.roleId);
      if (!newRole || !canManageUser(actorPerms, actorSlug, newRole.slug)) {
        throw new Error('Keine Berechtigung für Zielrolle');
      }
    }

    const actor = await this.userStore.findById(actorId);
    const updated = await this.userStore.updateUser(userId, updates);
    if (updated) {
      await this.auditService.log(
        { userId: actorId, username: actor?.username ?? 'system', sourceIp: ip },
        'users.edit',
        updated.username,
        true
      );
      return this.userStore.toPublic(updated);
    }
    return null;
  }

  async disableUser(actorId: string, userId: string, ip: string): Promise<boolean> {
    return this.setStatus(actorId, userId, 'disabled', ip, 'users.disable');
  }

  async enableUser(actorId: string, userId: string, ip: string): Promise<boolean> {
    return this.setStatus(actorId, userId, 'active', ip, 'users.enable');
  }

  private async setStatus(
    actorId: string,
    userId: string,
    status: UserStatus,
    ip: string,
    action: string
  ): Promise<boolean> {
    const actor = await this.userStore.findById(actorId);
    const updated = await this.userStore.updateUser(userId, { status });
    if (updated) {
      await this.auditService.log(
        { userId: actorId, username: actor?.username ?? 'system', sourceIp: ip },
        action,
        updated.username,
        true
      );
      return true;
    }
    return false;
  }

  async resetPassword(
    actorId: string,
    userId: string,
    newPassword: string,
    mustChange: boolean,
    ip: string
  ): Promise<boolean> {
    await this.userStore.changePassword(userId, newPassword);
    await this.userStore.updateUser(userId, { mustChangePassword: mustChange });
    const actor = await this.userStore.findById(actorId);
    const target = await this.userStore.findById(userId);
    await this.auditService.log(
      { userId: actorId, username: actor?.username ?? 'system', sourceIp: ip },
      'users.reset_password',
      target?.username ?? userId,
      true
    );
    return true;
  }

  async deleteUser(actorId: string, actorSlug: string, actorPerms: string[], userId: string, ip: string): Promise<boolean> {
    const target = await this.userStore.findById(userId);
    if (!target) return false;
    const targetRole = await this.roleStore.findById(target.roleId);
    if (!canManageUser(actorPerms, actorSlug, targetRole?.slug ?? '')) {
      throw new Error('Keine Berechtigung');
    }
    const actor = await this.userStore.findById(actorId);
    const ok = await this.userStore.deleteUser(userId);
    if (ok) {
      await this.sessionStore.revokeAllForUser(userId);
      await this.apiTokenStore.revokeAllForUser(userId);
      await this.auditService.log(
        { userId: actorId, username: actor?.username ?? 'system', sourceIp: ip },
        'users.delete',
        target.username,
        true
      );
    }
    return ok;
  }

  async reset2fa(actorId: string, userId: string, ip: string): Promise<boolean> {
    const updated = await this.userStore.updateUser(userId, {
      totpEnabled: false,
      totpSecret: undefined,
      totpBackupCodes: undefined,
    });
    if (updated) {
      const actor = await this.userStore.findById(actorId);
      await this.auditService.log(
        { userId: actorId, username: actor?.username ?? 'system', sourceIp: ip },
        'users.reset_2fa',
        updated.username,
        true
      );
      return true;
    }
    return false;
  }

  // Roles
  async listRoles() {
    const roles = await this.roleStore.list();
    const roleIds = this.userStore.getAllRoleIds();
    return roles.map((r) => ({
      ...r,
      userCount: this.roleStore.countUsersWithRole(r.id, roleIds),
    }));
  }

  async createRole(data: { name: string; slug: string; description: string; permissions: Permission[] }) {
    return this.roleStore.create(data);
  }

  async updateRole(id: string, data: Partial<{ name: string; description: string; permissions: Permission[] }>) {
    return this.roleStore.update(id, data);
  }

  async deleteRole(id: string) {
    const role = await this.roleStore.findById(id);
    if (!role) return false;
    const count = this.roleStore.countUsersWithRole(id, this.userStore.getAllRoleIds());
    if (count > 0) throw new Error('Rolle wird noch von Benutzern verwendet');
    return this.roleStore.delete(id);
  }

  // Sessions
  async listSessions(userId: string, currentSessionId?: string) {
    const sessions = await this.sessionStore.listForUser(userId);
    return sessions.map((s) => ({ ...s, isCurrent: s.id === currentSessionId }));
  }

  async revokeSession(userId: string, sessionId: string, tokenService: { revokeRefreshToken: (id: string) => void }) {
    const session = await this.sessionStore.findById(sessionId);
    if (!session || session.userId !== userId) return false;
    tokenService.revokeRefreshToken(session.refreshTokenId);
    return this.sessionStore.revoke(sessionId);
  }

  // API Tokens
  async createApiToken(userId: string, name: string, permissions: string[], expiresInDays?: number) {
    return this.apiTokenStore.create(userId, name, permissions, expiresInDays);
  }

  async listApiTokens(userId: string) {
    return this.apiTokenStore.listForUser(userId);
  }

  async revokeApiToken(userId: string, tokenId: string) {
    return this.apiTokenStore.revoke(tokenId, userId);
  }

  getPasswordService() {
    return this.passwordService;
  }

  getRoleStore() {
    return this.roleStore;
  }

  getSessionStore() {
    return this.sessionStore;
  }

  getTotpService() {
    return this.totpService;
  }
}
