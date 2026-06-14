import { config } from '../config/env';
import { NetworkStatus, PingResult } from '../types';
import { pingHost } from '../utils/shell';
import { mockStore } from './MockDataService';

export class NetworkService {
  private lastSuccessMap = new Map<string, string>();
  private mock = config.mockMode ? mockStore : null;

  async getStatus(): Promise<NetworkStatus> {
    if (this.mock) {
      return this.mock.getNetworkStatus();
    }

    const pings = await Promise.all(
      config.network.pingTargets.map((host) => this.pingHostSafe(host))
    );

    return {
      pings,
      internetOnline: pings.some((p) => p.reachable),
      timestamp: new Date().toISOString(),
    };
  }

  private async pingHostSafe(host: string): Promise<PingResult> {
    const result = await pingHost(host, config.network.pingTimeoutMs);
    const output = result.stdout + result.stderr;

    if (!result.success && !output.includes('time=')) {
      return {
        host,
        latencyMs: null,
        packetLossPercent: 100,
        reachable: false,
        lastSuccess: this.lastSuccessMap.get(host) || null,
      };
    }

    const lossMatch = output.match(/(\d+(?:\.\d+)?)% packet loss/);
    const packetLossPercent = lossMatch ? parseFloat(lossMatch[1]) : 100;

    const timeMatches = [...output.matchAll(/time[=<]([\d.]+)\s*ms/gi)];
    let latencyMs: number | null = null;

    if (timeMatches.length > 0) {
      const times = timeMatches.map((m) => parseFloat(m[1]));
      latencyMs = Math.round((times.reduce((a, b) => a + b, 0) / times.length) * 10) / 10;
    }

    const reachable = packetLossPercent < 100 && latencyMs !== null;

    if (reachable) {
      this.lastSuccessMap.set(host, new Date().toISOString());
    }

    return {
      host,
      latencyMs,
      packetLossPercent,
      reachable,
      lastSuccess: this.lastSuccessMap.get(host) || null,
    };
  }

  getHighLatencyHosts(pings: PingResult[]): PingResult[] {
    return pings.filter(
      (p) => p.latencyMs !== null && p.latencyMs > config.network.highLatencyThresholdMs
    );
  }

  getHighPacketLossHosts(pings: PingResult[]): PingResult[] {
    return pings.filter(
      (p) => p.packetLossPercent >= config.network.highPacketLossThreshold
    );
  }
}
