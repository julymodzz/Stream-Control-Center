import fs from 'fs/promises';
import path from 'path';
import { createHash, randomBytes, randomUUID } from 'crypto';
import { config } from '../config/env';

export interface ApiToken {
  id: string;
  userId: string;
  name: string;
  tokenHash: string;
  tokenPrefix: string;
  permissions: string[];
  lastUsedAt?: string;
  expiresAt?: string;
  createdAt: string;
  revoked: boolean;
}

export class ApiTokenStore {
  private tokens: ApiToken[] = [];
  private filePath: string;
  private loaded = false;

  constructor() {
    this.filePath = path.join(config.dataDir, 'api-tokens.json');
  }

  async initialize(): Promise<void> {
    await fs.mkdir(config.dataDir, { recursive: true });
    try {
      const content = await fs.readFile(this.filePath, 'utf-8');
      this.tokens = JSON.parse(content) as ApiToken[];
    } catch {
      this.tokens = [];
    }
    this.loaded = true;
  }

  private async persist(): Promise<void> {
    await fs.writeFile(this.filePath, JSON.stringify(this.tokens, null, 2), 'utf-8');
  }

  private hashToken(token: string): string {
    return createHash('sha256').update(token).digest('hex');
  }

  async create(userId: string, name: string, permissions: string[], expiresInDays?: number): Promise<{ token: ApiToken; rawToken: string }> {
    if (!this.loaded) await this.initialize();
    const rawToken = `scc_${randomBytes(32).toString('hex')}`;
    const now = new Date().toISOString();
    const apiToken: ApiToken = {
      id: randomUUID(),
      userId,
      name,
      tokenHash: this.hashToken(rawToken),
      tokenPrefix: rawToken.slice(0, 12),
      permissions,
      createdAt: now,
      revoked: false,
      expiresAt: expiresInDays
        ? new Date(Date.now() + expiresInDays * 86400000).toISOString()
        : undefined,
    };
    this.tokens.push(apiToken);
    await this.persist();
    return { token: apiToken, rawToken };
  }

  async verify(rawToken: string): Promise<ApiToken | null> {
    if (!this.loaded) await this.initialize();
    const hash = this.hashToken(rawToken);
    const token = this.tokens.find((t) => t.tokenHash === hash && !t.revoked);
    if (!token) return null;
    if (token.expiresAt && new Date(token.expiresAt) < new Date()) return null;
    token.lastUsedAt = new Date().toISOString();
    await this.persist();
    return token;
  }

  async listForUser(userId: string): Promise<Omit<ApiToken, 'tokenHash'>[]> {
    if (!this.loaded) await this.initialize();
    return this.tokens
      .filter((t) => t.userId === userId && !t.revoked)
      .map(({ tokenHash: _, ...rest }) => rest);
  }

  async revoke(id: string, userId: string): Promise<boolean> {
    if (!this.loaded) await this.initialize();
    const token = this.tokens.find((t) => t.id === id && t.userId === userId);
    if (!token) return false;
    token.revoked = true;
    await this.persist();
    return true;
  }

  async revokeAllForUser(userId: string): Promise<void> {
    if (!this.loaded) await this.initialize();
    for (const token of this.tokens) {
      if (token.userId === userId) token.revoked = true;
    }
    await this.persist();
  }
}
