import fs from 'fs/promises';
import { config } from '../config/env';
import { LogEntry, LogsResponse } from '../types';
import { sanitizeSearchQuery } from '../utils/sanitize';
import { mockStore } from './MockDataService';

export class LogService {
  private readonly maxLines = 500;
  private appLogs: LogEntry[] = [];
  private mock = config.mockMode ? mockStore : null;

  addAppLog(line: string): void {
    const entry: LogEntry = { line, timestamp: new Date().toISOString() };
    this.appLogs.unshift(entry);
    if (this.appLogs.length > this.maxLines) {
      this.appLogs = this.appLogs.slice(0, this.maxLines);
    }
  }

  async getLogs(source: 'obs' | 'noalbs' | 'app', search?: string): Promise<LogsResponse> {
    const safeSearch = search ? sanitizeSearchQuery(search) : undefined;

    if (source === 'app') {
      let lines = [...this.appLogs];
      if (safeSearch) {
        const q = safeSearch.toLowerCase();
        lines = lines.filter((l) => l.line.toLowerCase().includes(q));
      }
      return { source: 'app', lines, totalLines: lines.length };
    }

    if (this.mock) {
      const logs = this.mock.getLogs(source);
      if (safeSearch) {
        const q = safeSearch.toLowerCase();
        logs.lines = logs.lines.filter((l) => l.line.toLowerCase().includes(q));
      }
      return logs;
    }

    const logPath = source === 'obs' ? config.obs.logPath : config.noalbs.logPath;
    let rawLines = await this.readLogLines(logPath);

    if (safeSearch) {
      const q = safeSearch.toLowerCase();
      rawLines = rawLines.filter((line) => line.toLowerCase().includes(q));
    }

    const lines: LogEntry[] = rawLines.slice(-this.maxLines).map((line) => ({
      line,
      timestamp: this.extractTimestamp(line),
    }));

    return { source, lines, totalLines: rawLines.length };
  }

  async getLogsAsText(source: 'obs' | 'noalbs' | 'app'): Promise<string> {
    const response = await this.getLogs(source);
    return response.lines.map((l) => l.line).join('\n');
  }

  private async readLogLines(logPath: string): Promise<string[]> {
    try {
      await fs.access(logPath);
      const content = await fs.readFile(logPath, 'utf-8');
      return content.split('\n').filter((line) => line.trim().length > 0);
    } catch {
      return [`[${new Date().toISOString()}] Log-Datei nicht gefunden oder nicht lesbar: ${logPath}`];
    }
  }

  private extractTimestamp(line: string): string | null {
    const isoMatch = line.match(/\d{4}-\d{2}-\d{2}[T ]\d{2}:\d{2}:\d{2}/);
    if (isoMatch) return isoMatch[0];
    const timeMatch = line.match(/\d{2}:\d{2}:\d{2}/);
    if (timeMatch) return timeMatch[0];
    return null;
  }
}
