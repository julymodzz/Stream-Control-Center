import fs from 'fs/promises';
import path from 'path';
import { randomUUID } from 'crypto';
import { config } from '../config/env';
import { AuditLogEntry } from '../types';

export interface AuditContext {
  userId: string;
  username: string;
  sourceIp: string;
}

export class AuditService {
  private entries: AuditLogEntry[] = [];
  private filePath: string;
  private maxEntries = 10000;

  constructor() {
    this.filePath = path.join(config.dataDir, 'audit.json');
  }

  async initialize(): Promise<void> {
    await fs.mkdir(config.dataDir, { recursive: true });
    try {
      const content = await fs.readFile(this.filePath, 'utf-8');
      this.entries = JSON.parse(content) as AuditLogEntry[];
    } catch {
      this.entries = [];
    }
  }

  async log(
    ctx: AuditContext,
    action: string,
    resource: string,
    success: boolean,
    details?: string
  ): Promise<AuditLogEntry> {
    const entry: AuditLogEntry = {
      id: randomUUID(),
      userId: ctx.userId,
      username: ctx.username,
      action,
      resource,
      details,
      sourceIp: ctx.sourceIp,
      success,
      timestamp: new Date().toISOString(),
    };

    this.entries.unshift(entry);
    if (this.entries.length > this.maxEntries) {
      this.entries = this.entries.slice(0, this.maxEntries);
    }

    await this.persist();
    return entry;
  }

  search(options: {
    query?: string;
    userId?: string;
    action?: string;
    success?: boolean;
    from?: string;
    to?: string;
    limit?: number;
    offset?: number;
  }): { entries: AuditLogEntry[]; total: number } {
    let filtered = [...this.entries];

    if (options.userId) {
      filtered = filtered.filter((e) => e.userId === options.userId);
    }
    if (options.action) {
      filtered = filtered.filter((e) => e.action.includes(options.action!));
    }
    if (options.success !== undefined) {
      filtered = filtered.filter((e) => e.success === options.success);
    }
    if (options.from) {
      filtered = filtered.filter((e) => e.timestamp >= options.from!);
    }
    if (options.to) {
      filtered = filtered.filter((e) => e.timestamp <= options.to!);
    }
    if (options.query) {
      const q = options.query.toLowerCase();
      filtered = filtered.filter(
        (e) =>
          e.action.toLowerCase().includes(q) ||
          e.resource.toLowerCase().includes(q) ||
          e.username.toLowerCase().includes(q) ||
          (e.details?.toLowerCase().includes(q) ?? false)
      );
    }

    const total = filtered.length;
    const offset = options.offset ?? 0;
    const limit = options.limit ?? 50;
    return { entries: filtered.slice(offset, offset + limit), total };
  }

  private async persist(): Promise<void> {
    await fs.writeFile(this.filePath, JSON.stringify(this.entries, null, 2), 'utf-8');
  }
}
