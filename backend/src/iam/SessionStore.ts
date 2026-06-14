import fs from 'fs/promises';
import path from 'path';
import { randomUUID } from 'crypto';
import { config } from '../config/env';

export interface UserSession {
  id: string;
  userId: string;
  refreshTokenId: string;
  device: string;
  browser: string;
  ip: string;
  userAgent: string;
  createdAt: string;
  lastActiveAt: string;
  revoked: boolean;
}

export function parseUserAgent(ua: string): { device: string; browser: string } {
  const browser = /Edg\//.test(ua) ? 'Edge'
    : /Chrome\//.test(ua) ? 'Chrome'
    : /Firefox\//.test(ua) ? 'Firefox'
    : /Safari\//.test(ua) ? 'Safari'
    : 'Unbekannt';
  const device = /Mobile|Android|iPhone/i.test(ua) ? 'Mobil'
    : /Tablet|iPad/i.test(ua) ? 'Tablet'
    : 'Desktop';
  return { device, browser };
}

export class SessionStore {
  private sessions: UserSession[] = [];
  private filePath: string;
  private loaded = false;

  constructor() {
    this.filePath = path.join(config.dataDir, 'sessions.json');
  }

  async initialize(): Promise<void> {
    await fs.mkdir(config.dataDir, { recursive: true });
    try {
      const content = await fs.readFile(this.filePath, 'utf-8');
      this.sessions = JSON.parse(content) as UserSession[];
    } catch {
      this.sessions = [];
    }
    this.loaded = true;
  }

  private async persist(): Promise<void> {
    await fs.writeFile(this.filePath, JSON.stringify(this.sessions, null, 2), 'utf-8');
  }

  async create(
    userId: string,
    refreshTokenId: string,
    ip: string,
    userAgent: string,
    id?: string
  ): Promise<UserSession> {
    if (!this.loaded) await this.initialize();
    const { device, browser } = parseUserAgent(userAgent);
    const now = new Date().toISOString();
    const session: UserSession = {
      id: id ?? randomUUID(),
      userId,
      refreshTokenId,
      device,
      browser,
      ip,
      userAgent,
      createdAt: now,
      lastActiveAt: now,
      revoked: false,
    };
    this.sessions.unshift(session);
    await this.persist();
    return session;
  }

  async findByRefreshTokenId(tokenId: string): Promise<UserSession | undefined> {
    if (!this.loaded) await this.initialize();
    return this.sessions.find((s) => s.refreshTokenId === tokenId && !s.revoked);
  }

  async findById(id: string): Promise<UserSession | undefined> {
    if (!this.loaded) await this.initialize();
    return this.sessions.find((s) => s.id === id);
  }

  async listForUser(userId: string): Promise<UserSession[]> {
    if (!this.loaded) await this.initialize();
    return this.sessions.filter((s) => s.userId === userId && !s.revoked);
  }

  async touch(sessionId: string): Promise<void> {
    const session = this.sessions.find((s) => s.id === sessionId);
    if (session) {
      session.lastActiveAt = new Date().toISOString();
      await this.persist();
    }
  }

  async revoke(sessionId: string): Promise<boolean> {
    if (!this.loaded) await this.initialize();
    const session = this.sessions.find((s) => s.id === sessionId);
    if (!session) return false;
    session.revoked = true;
    await this.persist();
    return true;
  }

  async revokeByRefreshTokenId(tokenId: string): Promise<boolean> {
    if (!this.loaded) await this.initialize();
    const session = this.sessions.find((s) => s.refreshTokenId === tokenId);
    if (!session) return false;
    session.revoked = true;
    await this.persist();
    return true;
  }

  async revokeAllForUser(userId: string, exceptSessionId?: string): Promise<number> {
    if (!this.loaded) await this.initialize();
    let count = 0;
    for (const session of this.sessions) {
      if (session.userId === userId && !session.revoked && session.id !== exceptSessionId) {
        session.revoked = true;
        count++;
      }
    }
    if (count > 0) await this.persist();
    return count;
  }
}
