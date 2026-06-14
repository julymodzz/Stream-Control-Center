import fs from 'fs/promises';
import os from 'os';
import { config } from '../config/env';
import { SystemStatus } from '../types';
import { procFile } from '../utils/procPath';
import { mockStore } from './MockDataService';

/**
 * Überwacht Systemressourcen über /proc und os-APIs.
 */
export class SystemService {
  private prevNetworkStats: { rx: number; tx: number; time: number } | null = null;
  private mock = config.mockMode ? mockStore : null;

  async getStatus(): Promise<SystemStatus> {
    if (this.mock) {
      return this.mock.getSystemStatus();
    }

    const [cpuPercent, memory, disk, uptimeSeconds, network] = await Promise.all([
      this.getCpuUsage(),
      this.getMemoryUsage(),
      this.getDiskUsage(),
      this.getUptime(),
      this.getNetworkTraffic(),
    ]);

    return {
      cpuPercent,
      ramPercent: memory.percent,
      ramUsedMb: memory.usedMb,
      ramTotalMb: memory.totalMb,
      diskPercent: disk.percent,
      diskUsedGb: disk.usedGb,
      diskTotalGb: disk.totalGb,
      uptimeSeconds,
      network,
      timestamp: new Date().toISOString(),
    };
  }

  private async getCpuUsage(): Promise<number> {
    try {
      const stat1 = await this.readCpuStat();
      await this.sleep(200);
      const stat2 = await this.readCpuStat();

      const idle = stat2.idle - stat1.idle;
      const total = stat2.total - stat1.total;

      if (total === 0) return 0;
      return Math.round(((total - idle) / total) * 100 * 10) / 10;
    } catch {
      const load = os.loadavg()[0];
      const cores = os.cpus().length;
      return Math.min(100, Math.round((load / cores) * 100 * 10) / 10);
    }
  }

  private async readCpuStat(): Promise<{ idle: number; total: number }> {
    const content = await fs.readFile(procFile('stat'), 'utf-8');
    const line = content.split('\n')[0];
    const parts = line.split(/\s+/).slice(1).map(Number);
    const idle = parts[3] + (parts[4] || 0);
    const total = parts.reduce((a, b) => a + b, 0);
    return { idle, total };
  }

  private getMemoryUsage(): { percent: number; usedMb: number; totalMb: number } {
    const total = os.totalmem();
    const free = os.freemem();
    const used = total - free;
    return {
      percent: Math.round((used / total) * 100 * 10) / 10,
      usedMb: Math.round(used / 1024 / 1024),
      totalMb: Math.round(total / 1024 / 1024),
    };
  }

  private async getDiskUsage(): Promise<{ percent: number; usedGb: number; totalGb: number }> {
    try {
      if (config.isLinux) {
        const content = await fs.readFile(procFile('mounts'), 'utf-8');
        const rootMount = content.split('\n').find((line) => line.split(' ')[1] === '/');
        const device = rootMount?.split(' ')[0] || '/';

        const { execSync } = await import('child_process');
        const output = execSync(`df -B1 ${device} 2>/dev/null | tail -1`, {
          encoding: 'utf-8',
          timeout: 5000,
        });

        const parts = output.trim().split(/\s+/);
        const total = parseInt(parts[1], 10);
        const used = parseInt(parts[2], 10);
        const percent = parseInt(parts[4], 10);

        return {
          percent: isNaN(percent) ? 0 : percent,
          usedGb: Math.round((used / 1024 / 1024 / 1024) * 10) / 10,
          totalGb: Math.round((total / 1024 / 1024 / 1024) * 10) / 10,
        };
      }

      if (process.platform === 'win32') {
        const { execSync } = await import('child_process');
        const output = execSync('wmic logicaldisk where "DeviceID=\'C:\'" get Size,FreeSpace /format:csv', {
          encoding: 'utf-8',
          timeout: 5000,
        });
        const line = output.split('\n').find((l) => l.includes('C:'));
        if (line) {
          const parts = line.split(',');
          const free = parseInt(parts[1], 10);
          const total = parseInt(parts[2], 10);
          const used = total - free;
          return {
            percent: Math.round((used / total) * 100 * 10) / 10,
            usedGb: Math.round((used / 1024 / 1024 / 1024) * 10) / 10,
            totalGb: Math.round((total / 1024 / 1024 / 1024) * 10) / 10,
          };
        }
      }
    } catch {
      // Fallback unten
    }

    return { percent: 0, usedGb: 0, totalGb: 0 };
  }

  private async getUptime(): Promise<number> {
    try {
      const content = await fs.readFile(procFile('uptime'), 'utf-8');
      return Math.floor(parseFloat(content.split(' ')[0]));
    } catch {
      return Math.floor(os.uptime());
    }
  }

  private async getNetworkTraffic(): Promise<{
    uploadBytesPerSec: number;
    downloadBytesPerSec: number;
  }> {
    try {
      const content = await fs.readFile(procFile('net/dev'), 'utf-8');
      const lines = content.split('\n').slice(2);
      let totalRx = 0;
      let totalTx = 0;

      for (const line of lines) {
        const parts = line.trim().split(/\s+/);
        if (parts.length < 10) continue;
        const iface = parts[0].replace(':', '');
        if (iface === 'lo') continue;
        totalRx += parseInt(parts[1], 10) || 0;
        totalTx += parseInt(parts[9], 10) || 0;
      }

      const now = Date.now();
      if (this.prevNetworkStats) {
        const elapsed = (now - this.prevNetworkStats.time) / 1000;
        if (elapsed > 0) {
          const download = Math.max(0, (totalRx - this.prevNetworkStats.rx) / elapsed);
          const upload = Math.max(0, (totalTx - this.prevNetworkStats.tx) / elapsed);
          this.prevNetworkStats = { rx: totalRx, tx: totalTx, time: now };
          return {
            downloadBytesPerSec: Math.round(download),
            uploadBytesPerSec: Math.round(upload),
          };
        }
      }

      this.prevNetworkStats = { rx: totalRx, tx: totalTx, time: now };
      return { uploadBytesPerSec: 0, downloadBytesPerSec: 0 };
    } catch {
      return { uploadBytesPerSec: 0, downloadBytesPerSec: 0 };
    }
  }

  private sleep(ms: number): Promise<void> {
    return new Promise((resolve) => setTimeout(resolve, ms));
  }
}
