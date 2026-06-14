import fs from 'fs/promises';
import { config } from '../config/env';
import { FailoverEvent, NoalbsStatus, SceneSwitchEvent } from '../types';
import { trySystemctlIsActive } from '../utils/shell';
import { mockStore } from './MockDataService';

export class NoalbsService {
  private sceneHistory: SceneSwitchEvent[] = [];
  private failoverHistory: FailoverEvent[] = [];
  private mock = config.mockMode ? mockStore : null;

  async getStatus(): Promise<NoalbsStatus> {
    if (this.mock) {
      return this.mock.getStreamingStatus().noalbs;
    }

    const running = await trySystemctlIsActive(config.noalbs.serviceName);
    const diagnostics = await this.runDiagnostics(running);
    await this.parseLogForEvents();

    return {
      running,
      lastSceneSwitch: this.sceneHistory[0]?.timestamp,
      sceneSwitchHistory: [...this.sceneHistory].slice(0, 50),
      failoverHistory: [...this.failoverHistory].slice(0, 50),
      autoRecoveryEnabled: true,
      connectionDiagnostics: diagnostics,
    };
  }

  private async runDiagnostics(running: boolean): Promise<string[]> {
    const results: string[] = [];
    results.push(running ? 'NOALBS-Dienst aktiv' : 'NOALBS-Dienst nicht aktiv');

    try {
      await fs.access(config.noalbs.logPath);
      results.push('Log-Datei erreichbar');
    } catch {
      results.push('Log-Datei nicht erreichbar');
    }

    return results;
  }

  private async parseLogForEvents(): Promise<void> {
    try {
      const content = await fs.readFile(config.noalbs.logPath, 'utf-8');
      const lines = content.split('\n').slice(-200);

      for (const line of lines) {
        const switchMatch = line.match(/switching.*?from\s+(.+?)\s+to\s+(.+)/i);
        if (switchMatch) {
          const event: SceneSwitchEvent = {
            from: switchMatch[1].trim(),
            to: switchMatch[2].trim(),
            timestamp: new Date().toISOString(),
            reason: 'auto',
          };
          if (!this.sceneHistory.some((e) => e.to === event.to && e.from === event.from)) {
            this.sceneHistory.unshift(event);
          }
        }

        const failoverMatch = line.match(/failover|recovery/i);
        if (failoverMatch) {
          const event: FailoverEvent = {
            trigger: 'log-detected',
            action: line.slice(0, 120),
            timestamp: new Date().toISOString(),
            success: !line.toLowerCase().includes('fail'),
          };
          this.failoverHistory.unshift(event);
        }
      }

      this.sceneHistory = this.sceneHistory.slice(0, 100);
      this.failoverHistory = this.failoverHistory.slice(0, 100);
    } catch {
      // Log nicht lesbar
    }
  }
}
