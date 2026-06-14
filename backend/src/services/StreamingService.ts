import { config } from '../config/env';
import { DockerContainerHealth, StreamingStatus } from '../types';
import { trySystemctlIsActive } from '../utils/shell';
import { mockStore } from './MockDataService';
import { NoalbsService } from './NoalbsService';
import { ObsControlService } from './ObsControlService';

export class StreamingService {
  private lastObsRunning = false;
  private lastNoalbsRunning = false;
  private prevObsRunning = false;
  private prevNoalbsRunning = false;
  private wasStreamOnline = false;
  private initialized = false;
  private mock = config.mockMode ? mockStore : null;

  constructor(
    private obsControl: ObsControlService,
    private noalbsService: NoalbsService
  ) {}

  async getStatus(): Promise<StreamingStatus> {
    if (this.mock) {
      if (!this.initialized) this.initialized = true;
      this.prevObsRunning = this.lastObsRunning;
      this.prevNoalbsRunning = this.lastNoalbsRunning;
      const status = this.mock.getStreamingStatus();
      this.lastObsRunning = status.obsRunning;
      this.lastNoalbsRunning = status.noalbsRunning;
      return status;
    }

    this.prevObsRunning = this.lastObsRunning;
    this.prevNoalbsRunning = this.lastNoalbsRunning;

    const [obsRunning, noalbsRunning] = await Promise.all([
      trySystemctlIsActive(config.obs.serviceName),
      trySystemctlIsActive(config.noalbs.serviceName),
    ]);

    const [obsStatus, noalbsStatus] = await Promise.all([
      obsRunning
        ? this.obsControl.getExtendedStatus()
        : Promise.resolve({
            connected: false,
            currentScene: null,
            streamOnline: false,
            recordingActive: false,
            bitrateKbps: null,
            scenes: [] as string[],
          }),
      this.noalbsService.getStatus(),
    ]);

    const twitchConnected = obsStatus.streamOnline;
    this.lastObsRunning = obsRunning;
    this.lastNoalbsRunning = noalbsRunning;
    this.wasStreamOnline = obsStatus.streamOnline;
    this.initialized = true;

    return {
      obsRunning,
      noalbsRunning,
      currentScene: obsStatus.currentScene,
      streamOnline: obsStatus.streamOnline,
      recordingActive: obsStatus.recordingActive,
      bitrateKbps: obsStatus.bitrateKbps,
      obs: obsStatus,
      noalbs: noalbsStatus,
      twitchConnected,
      dockerContainers: this.getDockerHealth(),
      timestamp: new Date().toISOString(),
    };
  }

  private getDockerHealth(): DockerContainerHealth[] {
    return [{ name: 'stream-control-center', status: 'healthy', running: true }];
  }

  wasObsRunning(): boolean {
    return this.prevObsRunning;
  }

  wasNoalbsRunning(): boolean {
    return this.prevNoalbsRunning;
  }

  wasStreaming(): boolean {
    return this.wasStreamOnline;
  }

  isInitialized(): boolean {
    return this.initialized;
  }
}
