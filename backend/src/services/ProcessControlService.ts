import { config } from '../config/env';
import { ControlAction, ControlResult } from '../types';
import { scheduleReboot, ShellError, sudoSystemctl } from '../utils/shell';
import { mockStore } from './MockDataService';

export class ProcessControlService {
  private mock = config.mockMode ? mockStore : null;

  async execute(action: ControlAction): Promise<ControlResult> {
    const timestamp = new Date().toISOString();

    if (this.mock) {
      const result = this.mock.simulateControl(action);
      return { success: result.success, action, message: result.message, timestamp };
    }

    try {
      const message = await this.runAction(action);
      return { success: true, action, message, timestamp };
    } catch (error) {
      const message =
        error instanceof ShellError
          ? `${error.message}${error.stderr ? `: ${error.stderr}` : ''}`
          : String(error);
      return { success: false, action, message, timestamp };
    }
  }

  private async runAction(action: ControlAction): Promise<string> {
    switch (action) {
      case 'obs-start':
        return this.systemctl('start', config.obs.serviceName, 'OBS gestartet');
      case 'obs-stop':
        return this.systemctl('stop', config.obs.serviceName, 'OBS gestoppt');
      case 'obs-restart':
        return this.systemctl('restart', config.obs.serviceName, 'OBS neu gestartet');
      case 'noalbs-start':
        return this.systemctl('start', config.noalbs.serviceName, 'NOALBS gestartet');
      case 'noalbs-stop':
        return this.systemctl('stop', config.noalbs.serviceName, 'NOALBS gestoppt');
      case 'noalbs-restart':
        return this.systemctl('restart', config.noalbs.serviceName, 'NOALBS neu gestartet');
      case 'server-reboot':
        await scheduleReboot();
        return 'Server-Neustart in 1 Minute geplant';
      default:
        throw new Error(`Unbekannte Aktion: ${action}`);
    }
  }

  private async systemctl(
    command: 'start' | 'stop' | 'restart',
    serviceName: string,
    successMessage: string
  ): Promise<string> {
    await sudoSystemctl(command, serviceName, 30000);
    return successMessage;
  }
}
