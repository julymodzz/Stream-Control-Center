import { DashboardData } from '../types';
import { metricsHistory } from '../observability/metrics';
import { LogService } from './LogService';
import { NetworkService } from './NetworkService';
import { NotificationService } from './NotificationService';
import { StreamingService } from './StreamingService';
import { SystemService } from './SystemService';

export class MonitorService {
  constructor(
    private systemService: SystemService,
    private streamingService: StreamingService,
    private networkService: NetworkService,
    private notificationService: NotificationService,
    private logService: LogService
  ) {}

  async collectDashboardData(): Promise<DashboardData> {
    const [system, streaming, network] = await Promise.all([
      this.systemService.getStatus(),
      this.streamingService.getStatus(),
      this.networkService.getStatus(),
    ]);

    metricsHistory.add({
      timestamp: system.timestamp,
      cpuPercent: system.cpuPercent,
      ramPercent: system.ramPercent,
      diskPercent: system.diskPercent,
      uploadBytesPerSec: system.network.uploadBytesPerSec,
      downloadBytesPerSec: system.network.downloadBytesPerSec,
    });

    this.notificationService.checkAndGenerateAlerts({
      system,
      streaming,
      network,
      prevObsRunning: this.streamingService.wasObsRunning(),
      prevNoalbsRunning: this.streamingService.wasNoalbsRunning(),
      prevInternetOnline: this.notificationService.wasInternetOnline(),
      prevStreamOnline: this.streamingService.wasStreaming(),
      skipCrashAlerts: !this.streamingService.isInitialized(),
      skipInternetAlerts: !this.notificationService.isInitialized(),
    });

    return {
      system,
      streaming,
      network,
      alerts: this.notificationService.getActiveAlerts(),
    };
  }

  getLogService(): LogService {
    return this.logService;
  }

  getNotificationService(): NotificationService {
    return this.notificationService;
  }

  getStreamingService(): StreamingService {
    return this.streamingService;
  }
}
