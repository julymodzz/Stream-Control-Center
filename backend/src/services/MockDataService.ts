import os from 'os';
import { LogsResponse, NetworkStatus, StreamingStatus } from '../types';

class MockDataStore {
  private static instance: MockDataStore;
  private tick = 0;
  obsRunning = true;
  noalbsRunning = true;
  streamOnline = true;
  recordingActive = false;

  static getInstance(): MockDataStore {
    if (!MockDataStore.instance) {
      MockDataStore.instance = new MockDataStore();
    }
    return MockDataStore.instance;
  }

  nextTick(): number {
    this.tick++;
    return this.tick;
  }

  getSystemStatus() {
    const tick = this.nextTick();
    const baseCpu = 25 + Math.sin(tick * 0.3) * 15;
    const baseRam = 55 + Math.cos(tick * 0.2) * 10;

    return {
      cpuPercent: Math.round(baseCpu * 10) / 10,
      ramPercent: Math.round(baseRam * 10) / 10,
      ramUsedMb: Math.round((os.totalmem() * baseRam) / 100 / 1024 / 1024),
      ramTotalMb: Math.round(os.totalmem() / 1024 / 1024),
      diskPercent: 42.5,
      diskUsedGb: 128.4,
      diskTotalGb: 512,
      uptimeSeconds: Math.floor(os.uptime()),
      network: {
        uploadBytesPerSec: Math.round(2_500_000 + Math.sin(tick) * 500_000),
        downloadBytesPerSec: Math.round(800_000 + Math.cos(tick) * 200_000),
      },
      timestamp: new Date().toISOString(),
    };
  }

  getStreamingStatus(): StreamingStatus {
    const scenes = ['Live - Main Camera', 'BRB', 'Starting Soon', 'Offline'];
    const currentScene = scenes[0];
    return {
      obsRunning: this.obsRunning,
      noalbsRunning: this.noalbsRunning,
      currentScene,
      streamOnline: this.streamOnline,
      recordingActive: this.recordingActive,
      bitrateKbps: 6000 + Math.round(Math.sin(this.tick * 0.5) * 200),
      obs: {
        connected: this.obsRunning,
        currentScene,
        streamOnline: this.streamOnline,
        recordingActive: this.recordingActive,
        bitrateKbps: 6000,
        scenes,
      },
      noalbs: {
        running: this.noalbsRunning,
        lastSceneSwitch: new Date().toISOString(),
        sceneSwitchHistory: [
          { from: 'BRB', to: currentScene, timestamp: new Date().toISOString(), reason: 'manual' },
        ],
        failoverHistory: [],
        autoRecoveryEnabled: true,
        connectionDiagnostics: ['NOALBS verbunden', 'OBS WebSocket erreichbar'],
      },
      twitchConnected: this.streamOnline,
      dockerContainers: [
        { name: 'stream-control-center', status: 'healthy', running: true },
      ],
      timestamp: new Date().toISOString(),
    };
  }

  getNetworkStatus(): NetworkStatus {
    const hosts = ['8.8.8.8', 'twitch.tv', 'google.com'];
    return {
      pings: hosts.map((host) => ({
        host,
        latencyMs: Math.round(15 + Math.random() * 30),
        packetLossPercent: 0,
        reachable: true,
        lastSuccess: new Date().toISOString(),
      })),
      internetOnline: true,
      timestamp: new Date().toISOString(),
    };
  }

  getLogs(source: 'obs' | 'noalbs'): LogsResponse {
    const now = new Date().toISOString();
    const prefix = source === 'obs' ? 'OBS' : 'NOALBS';
    const lines = Array.from({ length: 20 }, (_, i) => ({
      line: `[${prefix}] ${now} – Simulierter Log-Eintrag #${i + 1}`,
      timestamp: now,
    }));
    return { source, lines, totalLines: lines.length };
  }

  simulateControl(action: string): { success: boolean; message: string } {
    if (action.startsWith('obs-')) {
      if (action === 'obs-start') this.obsRunning = true;
      if (action === 'obs-stop') {
        this.obsRunning = false;
        this.streamOnline = false;
        this.recordingActive = false;
      }
      if (action === 'obs-restart') {
        this.obsRunning = true;
        this.streamOnline = true;
      }
    }
    if (action.startsWith('noalbs-')) {
      if (action === 'noalbs-start') this.noalbsRunning = true;
      if (action === 'noalbs-stop') this.noalbsRunning = false;
      if (action === 'noalbs-restart') this.noalbsRunning = true;
    }
    if (action === 'server-reboot') {
      return { success: true, message: '[Mock] Server-Neustart simuliert' };
    }
    return { success: true, message: `[Mock] ${action} simuliert` };
  }
}

export const mockStore = MockDataStore.getInstance();
