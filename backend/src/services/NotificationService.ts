import { randomUUID } from 'crypto';
import { config } from '../config/env';
import { Alert, AlertType, NetworkStatus, StreamingStatus, SystemStatus } from '../types';
import { AlertDeliveryService } from './AlertDeliveryService';
import { NetworkService } from './NetworkService';

interface AlertCheckContext {
  system: SystemStatus;
  streaming: StreamingStatus;
  network: NetworkStatus;
  prevObsRunning: boolean;
  prevNoalbsRunning: boolean;
  prevInternetOnline: boolean;
  prevStreamOnline: boolean;
  skipCrashAlerts?: boolean;
  skipInternetAlerts?: boolean;
}

export class NotificationService {
  private alerts: Alert[] = [];
  private prevInternetOnline = true;
  private notifiedTypes = new Set<string>();
  private initialized = false;

  constructor(
    private networkService: NetworkService,
    private alertDelivery: AlertDeliveryService
  ) {}

  wasInternetOnline(): boolean {
    return this.prevInternetOnline;
  }

  checkAndGenerateAlerts(context: AlertCheckContext): Alert[] {
    const newAlerts: Alert[] = [];
    const thresholds = this.alertDelivery.getConfig().thresholds;

    if (!context.skipCrashAlerts && context.prevObsRunning && !context.streaming.obsRunning) {
      newAlerts.push(this.createAlert('obs_crash', 'critical', 'OBS ist abgestürzt oder wurde beendet'));
    }

    if (!context.streaming.obs.connected && context.streaming.obsRunning) {
      newAlerts.push(this.createAlert('obs_disconnected', 'warning', 'OBS WebSocket nicht verbunden'));
    }

    if (!context.skipCrashAlerts && context.prevNoalbsRunning && !context.streaming.noalbsRunning) {
      newAlerts.push(this.createAlert('noalbs_crash', 'critical', 'NOALBS ist abgestürzt oder wurde beendet'));
    }

    if (context.streaming.noalbsRunning === false) {
      this.maybeAlert(newAlerts, 'noalbs_offline', 'warning', 'NOALBS ist offline');
    }

    if (context.prevStreamOnline && !context.streaming.streamOnline) {
      newAlerts.push(this.createAlert('stream_offline', 'critical', 'Stream unerwartet offline'));
    }

    if (
      !context.skipInternetAlerts &&
      context.prevInternetOnline &&
      !context.network.internetOnline &&
      !this.notifiedTypes.has('internet_down')
    ) {
      newAlerts.push(this.createAlert('internet_down', 'critical', 'Internetverbindung ausgefallen'));
      this.notifiedTypes.add('internet_down');
    }

    if (context.system.cpuPercent >= thresholds.cpuPercent) {
      this.maybeAlert(newAlerts, 'high_cpu', 'warning', `Hohe CPU-Auslastung: ${context.system.cpuPercent}%`);
    }

    if (context.system.ramPercent >= thresholds.ramPercent) {
      this.maybeAlert(newAlerts, 'high_ram', 'warning', `Hohe RAM-Auslastung: ${context.system.ramPercent}%`);
    }

    if (context.system.diskPercent >= thresholds.diskPercent) {
      this.maybeAlert(newAlerts, 'disk_full', 'critical', `Festplatte fast voll: ${context.system.diskPercent}%`);
    }

    for (const ping of this.networkService.getHighLatencyHosts(context.network.pings)) {
      const key = `high_latency_${ping.host}`;
      if (!this.notifiedTypes.has(key)) {
        newAlerts.push(
          this.createAlert('high_latency', 'warning', `Hohe Latenz zu ${ping.host}: ${ping.latencyMs} ms`)
        );
        this.notifiedTypes.add(key);
      }
    }

    for (const ping of this.networkService.getHighPacketLossHosts(context.network.pings)) {
      const key = `high_packet_loss_${ping.host}`;
      if (!this.notifiedTypes.has(key)) {
        newAlerts.push(
          this.createAlert('high_packet_loss', 'warning', `Hoher Paketverlust zu ${ping.host}: ${ping.packetLossPercent}%`)
        );
        this.notifiedTypes.add(key);
      }
    }

    for (const ping of context.network.pings) {
      if (ping.latencyMs !== null && ping.latencyMs <= thresholds.latencyMs) {
        this.notifiedTypes.delete(`high_latency_${ping.host}`);
      }
      if (ping.packetLossPercent < thresholds.packetLossPercent) {
        this.notifiedTypes.delete(`high_packet_loss_${ping.host}`);
      }
    }

    if (context.network.internetOnline) {
      this.notifiedTypes.delete('internet_down');
    }

    this.prevInternetOnline = context.network.internetOnline;
    this.initialized = true;

    for (const alert of newAlerts) {
      this.addAlert(alert);
      void this.alertDelivery.deliver(alert);
    }

    return newAlerts;
  }

  private maybeAlert(alerts: Alert[], type: AlertType, severity: Alert['severity'], message: string): void {
    const key = type;
    if (!this.notifiedTypes.has(key)) {
      alerts.push(this.createAlert(type, severity, message));
      this.notifiedTypes.add(key);
    }
  }

  isInitialized(): boolean {
    return this.initialized;
  }

  getActiveAlerts(): Alert[] {
    return this.alerts.filter((a) => !a.acknowledged);
  }

  getHistory(): Alert[] {
    return [...this.alerts];
  }

  acknowledgeAlert(id: string): boolean {
    const alert = this.alerts.find((a) => a.id === id);
    if (alert) {
      alert.acknowledged = true;
      return true;
    }
    return false;
  }

  acknowledgeAll(): void {
    this.alerts.forEach((a) => {
      a.acknowledged = true;
    });
  }

  private createAlert(type: AlertType, severity: Alert['severity'], message: string): Alert {
    return {
      id: randomUUID(),
      type,
      severity,
      message,
      timestamp: new Date().toISOString(),
      acknowledged: false,
    };
  }

  // Functional: Create rich Twitch event alert (integrated with existing system + delivery)
  createTwitchEventAlert(eventType: 'raid' | 'prediction' | 'sub' | 'hype', details: string) {
    const typeMap: Record<string, AlertType> = {
      raid: 'twitch_raid',
      prediction: 'twitch_prediction',
      sub: 'twitch_sub',
      hype: 'twitch_hype',
    };
    const alert = this.createAlert(typeMap[eventType] || 'twitch_raid', 'info', details);
    this.addAlert(alert);
    void this.alertDelivery.deliver(alert);
    return alert;
  }

  private addAlert(alert: Alert): void {
    this.alerts.unshift(alert);
    if (this.alerts.length > config.notifications.maxHistory) {
      this.alerts = this.alerts.slice(0, config.notifications.maxHistory);
    }
  }
}
