import { randomUUID } from 'crypto';
import { config } from '../config/env';
import { AuthTokens, User } from '../types';
import { IamService } from '../iam/IamService';
import { SessionStore } from '../iam/SessionStore';
import { Permission } from '../iam/permissions';
import { TotpService } from './TotpService';
import { TokenService } from './TokenService';
import { UserStore } from './UserStore';
import { AuditService } from '../audit/AuditService';

export interface LoginResult {
  success: boolean;
  message: string;
  tokens?: AuthTokens;
  refreshToken?: string;
  sessionId?: string;
  requiresTotp?: boolean;
  mustChangePassword?: boolean;
  user?: {
    id: string;
    username: string;
    displayName: string;
    email: string;
    roleId: string;
    roleSlug: string;
    roleName: string;
    permissions: string[];
    totpEnabled: boolean;
    mustChangePassword: boolean;
  };
}

export class AuthService {
  constructor(
    private userStore: UserStore,
    private tokenService: TokenService,
    private totpService: TotpService,
    private iamService: IamService,
    private sessionStore: SessionStore,
    private auditService: AuditService
  ) {}

  private buildUserResponse(user: User, permissions: Permission[]) {
    const pub = this.userStore.toPublic(user);
    return {
      id: user.id,
      username: user.username,
      displayName: user.displayName,
      email: user.email,
      roleId: user.roleId,
      roleSlug: pub.roleSlug ?? 'viewer',
      roleName: pub.roleName ?? 'Viewer',
      permissions,
      totpEnabled: user.totpEnabled,
      mustChangePassword: user.mustChangePassword,
    };
  }

  async login(
    username: string,
    password: string,
    totpCode?: string,
    ip = 'unknown',
    userAgent = ''
  ): Promise<LoginResult> {
    const user = await this.userStore.findByUsername(username);
    if (!user) {
      return { success: false, message: 'Ungültige Anmeldedaten' };
    }

    if (user.status === 'disabled') {
      return { success: false, message: 'Konto ist deaktiviert' };
    }

    if (user.lockedUntil && new Date(user.lockedUntil) > new Date()) {
      return { success: false, message: 'Konto vorübergehend gesperrt' };
    }

    const validPassword = await this.userStore.verifyPassword(user, password);
    if (!validPassword) {
      const attempts = user.failedLoginAttempts + 1;
      const updates: Partial<User> = { failedLoginAttempts: attempts };
      if (attempts >= config.auth.loginLockoutThreshold) {
        updates.lockedUntil = new Date(Date.now() + config.auth.loginLockoutDurationMs).toISOString();
        updates.failedLoginAttempts = 0;
        updates.status = 'locked';
      }
      await this.userStore.updateUser(user.id, updates);
      return { success: false, message: 'Ungültige Anmeldedaten' };
    }

    if (user.totpEnabled && user.totpSecret) {
      if (!totpCode) {
        return { success: false, message: '2FA-Code erforderlich', requiresTotp: true };
      }
      const totpValid = this.totpService.verify(totpCode, user.totpSecret);
      const backupValid = !totpValid && (await this.userStore.verifyBackupCode(user, totpCode));
      if (!totpValid && !backupValid) {
        return { success: false, message: 'Ungültiger 2FA-Code' };
      }
    }

    const permissions = this.iamService.getUserPermissions(user);
    const pub = this.userStore.toPublic(user);
    const roleSlug = pub.roleSlug ?? 'viewer';

    const sessionId = randomUUID();
    const { token: refreshToken, tokenId } = this.tokenService.createRefreshToken(user.id, sessionId);
    const session = await this.sessionStore.create(user.id, tokenId, ip, userAgent, sessionId);
    const tokens = this.tokenService.issueTokens(user, roleSlug, permissions, session.id);

    await this.userStore.updateUser(user.id, {
      failedLoginAttempts: 0,
      lockedUntil: undefined,
      status: 'active',
      lastLoginAt: new Date().toISOString(),
    });

    await this.auditService.log(
      { userId: user.id, username: user.username, sourceIp: ip },
      'auth.login',
      'session',
      true
    );

    return {
      success: true,
      message: 'Anmeldung erfolgreich',
      tokens,
      refreshToken,
      sessionId: session.id,
      mustChangePassword: user.mustChangePassword,
      user: this.buildUserResponse(user, permissions),
    };
  }

  async refresh(refreshToken: string, ip = 'unknown'): Promise<LoginResult> {
    const verified = this.tokenService.verifyRefreshToken(refreshToken);
    if (!verified) {
      return { success: false, message: 'Ungültiger Refresh-Token' };
    }

    const session = await this.sessionStore.findByRefreshTokenId(verified.tokenId);
    if (!session || session.revoked) {
      return { success: false, message: 'Sitzung ungültig' };
    }

    const sessionAge = Date.now() - new Date(session.lastActiveAt).getTime();
    if (sessionAge > config.auth.sessionTimeoutMs) {
      await this.sessionStore.revoke(session.id);
      this.tokenService.revokeRefreshToken(verified.tokenId);
      return { success: false, message: 'Sitzung abgelaufen' };
    }

    const user = await this.userStore.findById(verified.userId);
    if (!user || user.status === 'disabled') {
      return { success: false, message: 'Benutzer nicht gefunden oder deaktiviert' };
    }

    this.tokenService.revokeRefreshToken(verified.tokenId);
    await this.sessionStore.touch(session.id);

    const permissions = this.iamService.getUserPermissions(user);
    const pub = this.userStore.toPublic(user);
    const roleSlug = pub.roleSlug ?? 'viewer';

    const tokens = this.tokenService.issueTokens(user, roleSlug, permissions, session.id);
    const newRefresh = this.tokenService.createRefreshToken(user.id, session.id);

    return {
      success: true,
      message: 'Token erneuert',
      tokens,
      refreshToken: newRefresh.token,
      sessionId: session.id,
      user: this.buildUserResponse(user, permissions),
    };
  }

  async logout(refreshToken: string | undefined, userId: string, ip: string): Promise<void> {
    if (refreshToken) {
      const verified = this.tokenService.verifyRefreshToken(refreshToken);
      if (verified) {
        this.tokenService.revokeRefreshToken(verified.tokenId);
        await this.sessionStore.revokeByRefreshTokenId(verified.tokenId);
      }
    }
    const user = await this.userStore.findById(userId);
    await this.auditService.log(
      { userId, username: user?.username ?? 'unknown', sourceIp: ip },
      'auth.logout',
      'session',
      true
    );
  }

  async setupTotp(userId: string): Promise<{ secret: string; qrCode: string } | null> {
    const user = await this.userStore.findById(userId);
    if (!user) return null;
    const secret = this.totpService.generateSecret();
    await this.userStore.updateUser(userId, { totpSecret: secret, totpEnabled: false });
    const qrCode = await this.totpService.generateQrCode(user.username, secret);
    return { secret, qrCode };
  }

  async enableTotp(userId: string, code: string): Promise<{ backupCodes: string[] } | null> {
    const user = await this.userStore.findById(userId);
    if (!user?.totpSecret) return null;
    if (!this.totpService.verify(code, user.totpSecret)) return null;
    const { plain, hashed } = this.userStore.generateBackupCodes();
    await this.userStore.updateUser(userId, { totpEnabled: true, totpBackupCodes: hashed });
    return { backupCodes: plain };
  }

  async disableTotp(userId: string, code: string): Promise<boolean> {
    const user = await this.userStore.findById(userId);
    if (!user?.totpSecret || !user.totpEnabled) return false;
    const totpValid = this.totpService.verify(code, user.totpSecret);
    const backupValid = !totpValid && (await this.userStore.verifyBackupCode(user, code));
    if (!totpValid && !backupValid) return false;
    await this.userStore.updateUser(userId, { totpEnabled: false, totpSecret: undefined, totpBackupCodes: undefined });
    return true;
  }

  async regenerateBackupCodes(userId: string, code: string): Promise<string[] | null> {
    const user = await this.userStore.findById(userId);
    if (!user?.totpEnabled || !user.totpSecret) return null;
    if (!this.totpService.verify(code, user.totpSecret)) return null;
    const { plain, hashed } = this.userStore.generateBackupCodes();
    await this.userStore.updateUser(userId, { totpBackupCodes: hashed });
    return plain;
  }
}
