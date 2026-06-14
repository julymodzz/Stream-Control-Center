import { config } from '../config/env';
import { Alert, AlertConfig } from '../types';
import { logger } from '../observability/logger';

export class AlertDeliveryService {
  private config: AlertConfig = {
    enabled: true,
    discordWebhookUrl: config.notifications.discordWebhookUrl,
    emailEnabled: false,
    emailRecipients: [],
    browserNotifications: true,
    thresholds: {
      cpuPercent: config.thresholds.cpuPercent,
      ramPercent: config.thresholds.ramPercent,
      diskPercent: config.thresholds.diskPercent,
      packetLossPercent: config.network.highPacketLossThreshold,
      latencyMs: config.network.highLatencyThresholdMs,
    },
  };

  getConfig(): AlertConfig {
    return { ...this.config, thresholds: { ...this.config.thresholds } };
  }

  updateConfig(updates: Partial<AlertConfig>): AlertConfig {
    this.config = {
      ...this.config,
      ...updates,
      thresholds: { ...this.config.thresholds, ...updates.thresholds },
    };
    return this.getConfig();
  }

  async deliver(alert: Alert): Promise<void> {
    if (!this.config.enabled) return;

    const tasks: Promise<void>[] = [];

    if (this.config.discordWebhookUrl) {
      tasks.push(this.sendDiscord(alert));
    }

    if (this.config.emailEnabled && this.config.emailRecipients.length > 0) {
      tasks.push(this.sendEmail(alert));
    }

    await Promise.allSettled(tasks);
  }

  private async sendDiscord(alert: Alert): Promise<void> {
    const url = this.config.discordWebhookUrl;
    if (!url) return;

    try {
      await fetch(url, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          embeds: [{
            title: `🚨 ${alert.severity.toUpperCase()}: ${alert.type}`,
            description: alert.message,
            color: alert.severity === 'critical' ? 0xef4444 : alert.severity === 'warning' ? 0xeab308 : 0x3b82f6,
            timestamp: alert.timestamp,
          }],
        }),
      });
    } catch (error) {
      logger.error({ error, alertId: alert.id }, 'Discord-Webhook fehlgeschlagen');
    }
  }

  private async sendEmail(alert: Alert): Promise<void> {
    const smtp = config.notifications.smtp;
    if (!smtp.host) {
      logger.warn('E-Mail-Versand konfiguriert, aber SMTP_HOST fehlt');
      return;
    }
    logger.info({ alertId: alert.id, recipients: this.config.emailRecipients }, 'E-Mail-Alert (SMTP nicht vollständig implementiert – Log only)');
  }
}
