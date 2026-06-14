import { Registry, Counter, Histogram, Gauge, collectDefaultMetrics } from 'prom-client';
import { MetricsHistoryPoint } from '../types';
import { config } from '../config/env';

export const register = new Registry();
collectDefaultMetrics({ register });

export const httpRequestDuration = new Histogram({
  name: 'scc_http_request_duration_seconds',
  help: 'HTTP request duration in seconds',
  labelNames: ['method', 'route', 'status'],
  registers: [register],
});

export const httpRequestTotal = new Counter({
  name: 'scc_http_requests_total',
  help: 'Total HTTP requests',
  labelNames: ['method', 'route', 'status'],
  registers: [register],
});

export const activeConnections = new Gauge({
  name: 'scc_websocket_connections',
  help: 'Active WebSocket connections',
  registers: [register],
});

export const systemCpuGauge = new Gauge({
  name: 'scc_system_cpu_percent',
  help: 'Current CPU usage percent',
  registers: [register],
});

export const systemRamGauge = new Gauge({
  name: 'scc_system_ram_percent',
  help: 'Current RAM usage percent',
  registers: [register],
});

export class MetricsHistoryStore {
  private history: MetricsHistoryPoint[] = [];

  add(point: MetricsHistoryPoint): void {
    this.history.push(point);
    if (this.history.length > config.metrics.historySize) {
      this.history.shift();
    }
    systemCpuGauge.set(point.cpuPercent);
    systemRamGauge.set(point.ramPercent);
  }

  getHistory(): MetricsHistoryPoint[] {
    return [...this.history];
  }
}

export const metricsHistory = new MetricsHistoryStore();
