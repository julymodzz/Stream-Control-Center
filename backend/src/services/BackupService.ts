import fs from 'fs/promises';
import path from 'path';
import { randomUUID } from 'crypto';
import { config } from '../config/env';
import { BackupMetadata } from '../types';
import { logger } from '../observability/logger';

export class BackupService {
  private backupDir: string;
  private metadataPath: string;
  private metadata: BackupMetadata[] = [];

  constructor() {
    this.backupDir = path.join(config.dataDir, 'backups');
    this.metadataPath = path.join(config.dataDir, 'backups.json');
  }

  async initialize(): Promise<void> {
    await fs.mkdir(this.backupDir, { recursive: true });
    try {
      const content = await fs.readFile(this.metadataPath, 'utf-8');
      this.metadata = JSON.parse(content) as BackupMetadata[];
    } catch {
      this.metadata = [];
    }
  }

  async createBackup(type: 'manual' | 'scheduled' = 'manual'): Promise<BackupMetadata> {
    const id = randomUUID();
    const timestamp = new Date().toISOString().replace(/[:.]/g, '-');
    const filename = `backup-${timestamp}.json`;
    const filePath = path.join(this.backupDir, filename);

    const data: Record<string, unknown> = {};

    for (const file of ['users.json', 'audit.json', 'alert-config.json']) {
      try {
        const content = await fs.readFile(path.join(config.dataDir, file), 'utf-8');
        data[file] = JSON.parse(content);
      } catch {
        // Datei existiert nicht
      }
    }

    const backupContent = JSON.stringify({ version: '2.0', createdAt: new Date().toISOString(), data }, null, 2);
    await fs.writeFile(filePath, backupContent, 'utf-8');

    const stat = await fs.stat(filePath);
    const meta: BackupMetadata = {
      id,
      filename,
      createdAt: new Date().toISOString(),
      sizeBytes: stat.size,
      type,
    };

    this.metadata.unshift(meta);
    await this.enforceRetention();
    await this.persistMetadata();

    logger.info({ backupId: id, filename }, 'Backup erstellt');
    return meta;
  }

  async restore(backupId: string): Promise<boolean> {
    const meta = this.metadata.find((b) => b.id === backupId);
    if (!meta) return false;

    const content = await fs.readFile(path.join(this.backupDir, meta.filename), 'utf-8');
    const backup = JSON.parse(content) as { data: Record<string, string> };

    for (const [file, fileData] of Object.entries(backup.data)) {
      if (!['users.json', 'audit.json', 'alert-config.json'].includes(file)) continue;
      await fs.writeFile(path.join(config.dataDir, file), JSON.stringify(fileData, null, 2), 'utf-8');
    }

    logger.info({ backupId }, 'Backup wiederhergestellt');
    return true;
  }

  async exportSettings(): Promise<string> {
    const backup = await this.createBackup('manual');
    return await fs.readFile(path.join(this.backupDir, backup.filename), 'utf-8');
  }

  async importSettings(json: string): Promise<boolean> {
    const parsed = JSON.parse(json) as { data?: Record<string, unknown> };
    if (!parsed.data) return false;
    await this.createBackup('manual');
    for (const [file, fileData] of Object.entries(parsed.data)) {
      if (!['users.json', 'audit.json', 'alert-config.json'].includes(file)) continue;
      await fs.writeFile(path.join(config.dataDir, file), JSON.stringify(fileData, null, 2), 'utf-8');
    }
    return true;
  }

  listBackups(): BackupMetadata[] {
    return [...this.metadata];
  }

  private async enforceRetention(): Promise<void> {
    while (this.metadata.length > config.backup.retentionCount) {
      const removed = this.metadata.pop();
      if (removed) {
        try {
          await fs.unlink(path.join(this.backupDir, removed.filename));
        } catch {
          // ignore
        }
      }
    }
  }

  private async persistMetadata(): Promise<void> {
    await fs.writeFile(this.metadataPath, JSON.stringify(this.metadata, null, 2), 'utf-8');
  }
}
