import fs from 'fs/promises';
import path from 'path';
import { randomUUID } from 'crypto';
import { config } from '../config/env';
import { Permission, SYSTEM_ROLE_PERMISSIONS } from './permissions';

export interface Role {
  id: string;
  name: string;
  slug: string;
  description: string;
  permissions: Permission[];
  isSystem: boolean;
  createdAt: string;
  updatedAt: string;
}

const SYSTEM_ROLES: Omit<Role, 'id' | 'createdAt' | 'updatedAt'>[] = [
  { name: 'Super Admin', slug: 'super_admin', description: 'Vollzugriff auf alle Systemfunktionen', permissions: SYSTEM_ROLE_PERMISSIONS.super_admin, isSystem: true },
  { name: 'Admin', slug: 'admin', description: 'Benutzer- und Systemverwaltung', permissions: SYSTEM_ROLE_PERMISSIONS.admin, isSystem: true },
  { name: 'Operator', slug: 'operator', description: 'Monitoring und Steuerung', permissions: SYSTEM_ROLE_PERMISSIONS.operator, isSystem: true },
  { name: 'Viewer', slug: 'viewer', description: 'Nur-Lese-Zugriff', permissions: SYSTEM_ROLE_PERMISSIONS.viewer, isSystem: true },
];

export class RoleStore {
  private roles: Role[] = [];
  private filePath: string;
  private loaded = false;

  constructor() {
    this.filePath = path.join(config.dataDir, 'roles.json');
  }

  async initialize(): Promise<void> {
    await fs.mkdir(config.dataDir, { recursive: true });
    try {
      const content = await fs.readFile(this.filePath, 'utf-8');
      this.roles = JSON.parse(content) as Role[];
    } catch {
      this.roles = [];
    }
    await this.ensureSystemRoles();
    this.loaded = true;
    await this.persist();
  }

  private async ensureSystemRoles(): Promise<void> {
    const now = new Date().toISOString();
    for (const sys of SYSTEM_ROLES) {
      const existing = this.roles.find((r) => r.slug === sys.slug);
      if (!existing) {
        this.roles.push({
          ...sys,
          id: `role_${sys.slug}`,
          createdAt: now,
          updatedAt: now,
        });
      } else if (existing.isSystem) {
        existing.permissions = sys.permissions;
        existing.name = sys.name;
        existing.description = sys.description;
      }
    }
  }

  private async persist(): Promise<void> {
    await fs.writeFile(this.filePath, JSON.stringify(this.roles, null, 2), 'utf-8');
  }

  async list(): Promise<Role[]> {
    if (!this.loaded) await this.initialize();
    return [...this.roles];
  }

  async findById(id: string): Promise<Role | undefined> {
    if (!this.loaded) await this.initialize();
    return this.roles.find((r) => r.id === id);
  }

  async findBySlug(slug: string): Promise<Role | undefined> {
    if (!this.loaded) await this.initialize();
    return this.roles.find((r) => r.slug === slug);
  }

  getByIdSync(id: string): Role | undefined {
    return this.roles.find((r) => r.id === id);
  }

  getPermissionsForRole(roleId: string): Permission[] {
    const role = this.roles.find((r) => r.id === roleId);
    return role?.permissions ?? [];
  }

  getPermissionsForSlug(slug: string): Permission[] {
    const role = this.roles.find((r) => r.slug === slug);
    return role?.permissions ?? SYSTEM_ROLE_PERMISSIONS[slug] ?? [];
  }

  countUsersWithRole(roleId: string, userRoleIds: string[]): number {
    return userRoleIds.filter((id) => id === roleId).length;
  }

  async create(data: { name: string; slug: string; description: string; permissions: Permission[] }): Promise<Role> {
    if (!this.loaded) await this.initialize();
    if (this.roles.some((r) => r.slug === data.slug)) {
      throw new Error('Rollen-Slug bereits vergeben');
    }
    const now = new Date().toISOString();
    const role: Role = {
      id: randomUUID(),
      name: data.name,
      slug: data.slug,
      description: data.description,
      permissions: data.permissions,
      isSystem: false,
      createdAt: now,
      updatedAt: now,
    };
    this.roles.push(role);
    await this.persist();
    return role;
  }

  async update(id: string, data: Partial<Pick<Role, 'name' | 'description' | 'permissions'>>): Promise<Role | null> {
    if (!this.loaded) await this.initialize();
    const role = this.roles.find((r) => r.id === id);
    if (!role) return null;
    if (role.isSystem && data.permissions) {
      throw new Error('Systemrollen-Berechtigungen können nicht geändert werden');
    }
    Object.assign(role, data, { updatedAt: new Date().toISOString() });
    await this.persist();
    return role;
  }

  async delete(id: string): Promise<boolean> {
    if (!this.loaded) await this.initialize();
    const role = this.roles.find((r) => r.id === id);
    if (!role || role.isSystem) return false;
    this.roles = this.roles.filter((r) => r.id !== id);
    await this.persist();
    return true;
  }
}
