import bcrypt from 'bcryptjs';
import fs from 'fs/promises';
import path from 'path';
import { randomBytes, randomUUID } from 'crypto';
import { config } from '../config/env';
import { User, UserPreferences, UserPublic, UserStatus } from '../types';
import { logger } from '../observability/logger';
import { sanitizeUsername } from '../utils/sanitize';
import { PasswordService } from '../iam/PasswordService';
import { RoleStore } from '../iam/RoleStore';

interface UserStoreData {
  users: User[];
  preferences: Record<string, UserPreferences>;
}

const DEFAULT_PREFERENCES: UserPreferences = {
  theme: 'dark',
  dashboardLayout: [
    { id: 'system', type: 'system-status', x: 0, y: 0, w: 6, h: 4 },
    { id: 'streaming', type: 'streaming-status', x: 6, y: 0, w: 6, h: 4 },
    { id: 'network', type: 'network-status', x: 0, y: 4, w: 12, h: 3 },
    { id: 'controls', type: 'control-panel', x: 0, y: 7, w: 6, h: 4 },
    { id: 'alerts', type: 'alert-history', x: 6, y: 7, w: 6, h: 4 },
  ],
  notificationsEnabled: true,
};

const LEGACY_ROLE_MAP: Record<string, string> = {
  admin: 'role_admin',
  operator: 'role_operator',
  viewer: 'role_viewer',
};

export class UserStore {
  private data: UserStoreData = { users: [], preferences: {} };
  private filePath: string;
  private loaded = false;

  constructor(
    private roleStore: RoleStore,
    private passwordService: PasswordService
  ) {
    this.filePath = path.join(config.dataDir, 'users.json');
  }

  async initialize(): Promise<void> {
    await this.roleStore.initialize();
    await fs.mkdir(config.dataDir, { recursive: true });
    try {
      const content = await fs.readFile(this.filePath, 'utf-8');
      this.data = JSON.parse(content) as UserStoreData;
      await this.migrateUsers();
    } catch {
      this.data = { users: [], preferences: {} };
    }

    if (this.data.users.length === 0) {
      await this.createDefaultAdmin();
    }

    this.loaded = true;
    await this.persist();
  }

  private async migrateUsers(): Promise<void> {
    let changed = false;
    for (const user of this.data.users) {
      const legacy = user as User & { role?: string };
      if (!user.roleId && legacy.role) {
        user.roleId = LEGACY_ROLE_MAP[legacy.role] ?? 'role_super_admin';
        if (legacy.role === 'admin' && !this.data.users.some((u) => u.roleId === 'role_super_admin')) {
          user.roleId = 'role_super_admin';
        }
        delete legacy.role;
        changed = true;
      }
      if (!user.displayName) { user.displayName = user.username; changed = true; }
      if (!user.email) { user.email = ''; changed = true; }
      if (!user.status) {
        user.status = user.lockedUntil && new Date(user.lockedUntil) > new Date() ? 'locked' : 'active';
        changed = true;
      }
      if (user.mustChangePassword === undefined) { user.mustChangePassword = false; changed = true; }
      if (!user.passwordChangedAt) { user.passwordChangedAt = user.createdAt; changed = true; }
      if (!user.passwordHistory) { user.passwordHistory = []; changed = true; }
    }
    if (changed) await this.persist();
  }

  private async createDefaultAdmin(): Promise<void> {
    const passwordHash = await this.passwordService.hash(config.auth.defaultAdminPassword);
    const now = new Date().toISOString();
    const admin: User = {
      id: randomUUID(),
      username: sanitizeUsername(config.auth.defaultAdminUsername),
      displayName: 'Super Administrator',
      email: 'admin@localhost',
      passwordHash,
      roleId: 'role_super_admin',
      status: 'active',
      totpEnabled: false,
      mustChangePassword: true,
      passwordChangedAt: now,
      passwordHistory: [],
      createdAt: now,
      updatedAt: now,
      failedLoginAttempts: 0,
    };
    this.data.users.push(admin);
    this.data.preferences[admin.id] = { ...DEFAULT_PREFERENCES };
    logger.warn({ username: admin.username }, 'Standard-Super-Admin erstellt');
  }

  private async persist(): Promise<void> {
    await fs.writeFile(this.filePath, JSON.stringify(this.data, null, 2), 'utf-8');
  }

  toPublic(user: User): UserPublic {
    const role = this.roleStore.getByIdSync(user.roleId);
    return {
      id: user.id,
      username: user.username,
      displayName: user.displayName,
      email: user.email,
      roleId: user.roleId,
      roleName: role?.name,
      roleSlug: role?.slug,
      status: user.status,
      totpEnabled: user.totpEnabled,
      mustChangePassword: user.mustChangePassword,
      lastLoginAt: user.lastLoginAt,
      createdAt: user.createdAt,
      updatedAt: user.updatedAt,
      profileImage: user.profileImage,
    };
  }

  async findByUsername(username: string): Promise<User | undefined> {
    if (!this.loaded) await this.initialize();
    return this.data.users.find((u) => u.username === sanitizeUsername(username));
  }

  async findByEmail(email: string): Promise<User | undefined> {
    if (!this.loaded) await this.initialize();
    return this.data.users.find((u) => u.email.toLowerCase() === email.toLowerCase());
  }

  async findById(id: string): Promise<User | undefined> {
    if (!this.loaded) await this.initialize();
    return this.data.users.find((u) => u.id === id);
  }

  async listUsers(filters?: {
    query?: string;
    roleId?: string;
    status?: UserStatus;
    roleSlug?: string;
  }): Promise<UserPublic[]> {
    if (!this.loaded) await this.initialize();
    let users = this.data.users.map((u) => this.toPublic(u));

    if (filters?.query) {
      const q = filters.query.toLowerCase();
      users = users.filter(
        (u) =>
          u.username.toLowerCase().includes(q) ||
          u.displayName.toLowerCase().includes(q) ||
          u.email.toLowerCase().includes(q)
      );
    }
    if (filters?.roleId) {
      users = users.filter((u) => u.roleId === filters.roleId);
    }
    if (filters?.roleSlug) {
      users = users.filter((u) => u.roleSlug === filters.roleSlug);
    }
    if (filters?.status) {
      users = users.filter((u) => u.status === filters.status);
    }
    return users;
  }

  async updateUser(id: string, updates: Partial<User>): Promise<User | null> {
    if (!this.loaded) await this.initialize();
    const user = this.data.users.find((u) => u.id === id);
    if (!user) return null;
    Object.assign(user, updates, { updatedAt: new Date().toISOString() });
    await this.persist();
    return user;
  }

  async createUser(data: {
    username: string;
    displayName: string;
    email: string;
    password: string;
    roleId: string;
    mustChangePassword?: boolean;
    status?: UserStatus;
    createdBy?: string;
  }): Promise<UserPublic> {
    if (!this.loaded) await this.initialize();
    const normalized = sanitizeUsername(data.username);
    if (this.data.users.some((u) => u.username === normalized)) {
      throw new Error('Benutzername bereits vergeben');
    }
    if (data.email && this.data.users.some((u) => u.email.toLowerCase() === data.email.toLowerCase())) {
      throw new Error('E-Mail bereits vergeben');
    }
    const validation = this.passwordService.validate(data.password);
    if (!validation.valid) throw new Error(validation.errors.join(', '));

    const now = new Date().toISOString();
    const passwordHash = await this.passwordService.hash(data.password);
    const user: User = {
      id: randomUUID(),
      username: normalized,
      displayName: data.displayName || normalized,
      email: data.email || '',
      passwordHash,
      roleId: data.roleId,
      status: data.status ?? 'active',
      totpEnabled: false,
      mustChangePassword: data.mustChangePassword ?? false,
      passwordChangedAt: now,
      passwordHistory: [],
      createdAt: now,
      updatedAt: now,
      failedLoginAttempts: 0,
      createdBy: data.createdBy,
    };
    this.data.users.push(user);
    this.data.preferences[user.id] = { ...DEFAULT_PREFERENCES };
    await this.persist();
    return this.toPublic(user);
  }

  async deleteUser(id: string): Promise<boolean> {
    if (!this.loaded) await this.initialize();
    const user = this.data.users.find((u) => u.id === id);
    if (!user) return false;
    const role = this.roleStore.getByIdSync(user.roleId);
    if (role?.slug === 'super_admin') {
      const superAdmins = this.data.users.filter((u) => {
        const r = this.roleStore.getByIdSync(u.roleId);
        return r?.slug === 'super_admin';
      });
      if (superAdmins.length <= 1) throw new Error('Letzter Super-Admin kann nicht gelöscht werden');
    }
    this.data.users = this.data.users.filter((u) => u.id !== id);
    delete this.data.preferences[id];
    await this.persist();
    return true;
  }

  async verifyPassword(user: User, password: string): Promise<boolean> {
    return this.passwordService.verify(password, user.passwordHash);
  }

  async changePassword(userId: string, newPassword: string, skipValidation = false): Promise<void> {
    const user = await this.findById(userId);
    if (!user) throw new Error('Benutzer nicht gefunden');

    if (!skipValidation) {
      const validation = this.passwordService.validate(newPassword);
      if (!validation.valid) throw new Error(validation.errors.join(', '));
      if (await this.passwordService.isInHistory(newPassword, user.passwordHistory)) {
        throw new Error('Passwort wurde bereits verwendet');
      }
    }

    const hash = await this.passwordService.hash(newPassword);
    user.passwordHistory = this.passwordService.addToHistory(user.passwordHash, user.passwordHistory);
    user.passwordHash = hash;
    user.passwordChangedAt = new Date().toISOString();
    user.mustChangePassword = false;
    user.updatedAt = new Date().toISOString();
    await this.persist();
  }

  generateBackupCodes(): { plain: string[]; hashed: string[] } {
    const plain = Array.from({ length: 10 }, () =>
      randomBytes(4).toString('hex').toUpperCase()
    );
    const hashed = plain.map((c) => bcrypt.hashSync(c, 10));
    return { plain, hashed };
  }

  async verifyBackupCode(user: User, code: string): Promise<boolean> {
    if (!user.totpBackupCodes?.length) return false;
    const normalized = code.replace(/\s/g, '').toUpperCase();
    for (let i = 0; i < user.totpBackupCodes.length; i++) {
      if (await bcrypt.compare(normalized, user.totpBackupCodes[i])) {
        user.totpBackupCodes.splice(i, 1);
        await this.persist();
        return true;
      }
    }
    return false;
  }

  getPreferences(userId: string): UserPreferences {
    return this.data.preferences[userId] ?? { ...DEFAULT_PREFERENCES };
  }

  async setPreferences(userId: string, prefs: Partial<UserPreferences>): Promise<UserPreferences> {
    if (!this.loaded) await this.initialize();
    const current = this.getPreferences(userId);
    this.data.preferences[userId] = { ...current, ...prefs };
    await this.persist();
    return this.data.preferences[userId];
  }

  getAllRoleIds(): string[] {
    return this.data.users.map((u) => u.roleId);
  }
}
