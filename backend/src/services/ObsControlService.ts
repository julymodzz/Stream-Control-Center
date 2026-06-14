import OBSWebSocket from 'obs-websocket-js';
import { config } from '../config/env';
import { ControlResult, ObsControlAction } from '../types';
import { mockStore } from './MockDataService';

export class ObsControlService {
  private obsWs: OBSWebSocket | null = null;
  private connected = false;
  private mock = config.mockMode ? mockStore : null;

  async execute(action: ObsControlAction, params: {
    sceneName?: string;
    sourceName?: string;
    visible?: boolean;
    muted?: boolean;
  }): Promise<ControlResult> {
    const timestamp = new Date().toISOString();

    if (this.mock) {
      return { success: true, action, message: `[Mock] OBS ${action} ausgeführt`, timestamp };
    }

    try {
      await this.ensureConnected();
      const message = await this.runAction(action, params);
      return { success: true, action, message, timestamp };
    } catch (error) {
      return {
        success: false,
        action,
        message: error instanceof Error ? error.message : String(error),
        timestamp,
      };
    }
  }

  async getExtendedStatus(): Promise<{
    connected: boolean;
    currentScene: string | null;
    streamOnline: boolean;
    recordingActive: boolean;
    bitrateKbps: number | null;
    scenes: string[];
  }> {
    if (this.mock) {
      const s = this.mock.getStreamingStatus();
      return s.obs;
    }

    try {
      await this.ensureConnected();
      const [sceneResponse, streamStatus, recordStatus, sceneList] = await Promise.all([
        this.obsWs!.call('GetCurrentProgramScene'),
        this.obsWs!.call('GetStreamStatus'),
        this.obsWs!.call('GetRecordStatus'),
        this.obsWs!.call('GetSceneList'),
      ]);

      const stream = streamStatus as { outputActive?: boolean; outputBytes?: number };
      const record = recordStatus as { outputActive?: boolean };
      const sceneData = sceneList as { scenes?: Array<{ sceneName?: string; name?: string }> };
      const scenes = sceneData.scenes?.map((s) => s.sceneName ?? s.name ?? '').filter(Boolean) ?? [];

      return {
        connected: true,
        currentScene: (sceneResponse as { sceneName?: string }).sceneName || null,
        streamOnline: Boolean(stream.outputActive),
        recordingActive: Boolean(record.outputActive),
        bitrateKbps: null,
        scenes,
      };
    } catch {
      await this.disconnect();
      return {
        connected: false,
        currentScene: null,
        streamOnline: false,
        recordingActive: false,
        bitrateKbps: null,
        scenes: [],
      };
    }
  }

  private async runAction(
    action: ObsControlAction,
    params: { sceneName?: string; sourceName?: string; visible?: boolean; muted?: boolean }
  ): Promise<string> {
    switch (action) {
      case 'set-scene':
        if (!params.sceneName) throw new Error('sceneName erforderlich');
        await this.obsWs!.call('SetCurrentProgramScene', { sceneName: params.sceneName });
        return `Szene gewechselt zu ${params.sceneName}`;
      case 'start-stream':
        await this.obsWs!.call('StartStream');
        return 'Stream gestartet';
      case 'stop-stream':
        await this.obsWs!.call('StopStream');
        return 'Stream gestoppt';
      case 'start-recording':
        await this.obsWs!.call('StartRecord');
        return 'Aufnahme gestartet';
      case 'stop-recording':
        await this.obsWs!.call('StopRecord');
        return 'Aufnahme gestoppt';
      case 'set-source-visibility':
        if (!params.sourceName || params.visible === undefined) {
          throw new Error('sourceName und visible erforderlich');
        }
        await this.obsWs!.call('SetSceneItemEnabled', {
          sceneName: params.sceneName || (await this.obsWs!.call('GetCurrentProgramScene') as { sceneName: string }).sceneName,
          sceneItemId: await this.resolveSceneItemId(params.sourceName),
          sceneItemEnabled: params.visible,
        });
        return `Quelle ${params.sourceName} Sichtbarkeit: ${params.visible}`;
      case 'set-source-mute':
        if (!params.sourceName || params.muted === undefined) {
          throw new Error('sourceName und muted erforderlich');
        }
        await this.obsWs!.call('SetInputMute', { inputName: params.sourceName, inputMuted: params.muted });
        return `Quelle ${params.sourceName} stumm: ${params.muted}`;
      default:
        throw new Error(`Unbekannte OBS-Aktion: ${action}`);
    }
  }

  private async resolveSceneItemId(sourceName: string): Promise<number> {
    const scene = await this.obsWs!.call('GetCurrentProgramScene') as { sceneName: string };
    const items = await this.obsWs!.call('GetSceneItemList', { sceneName: scene.sceneName }) as {
      sceneItems: { sceneItemId: number; sourceName: string }[];
    };
    const item = items.sceneItems.find((i) => i.sourceName === sourceName);
    if (!item) throw new Error(`Quelle nicht gefunden: ${sourceName}`);
    return item.sceneItemId;
  }

  private async ensureConnected(): Promise<void> {
    if (!this.obsWs) this.obsWs = new OBSWebSocket();
    if (!this.connected) {
      const url = `ws://${config.obs.websocketHost}:${config.obs.websocketPort}`;
      await this.obsWs.connect(url, config.obs.websocketPassword || undefined);
      this.connected = true;
    }
  }

  private async disconnect(): Promise<void> {
    if (this.obsWs && this.connected) {
      try {
        await this.obsWs.disconnect();
      } catch {
        // ignore
      }
    }
    this.connected = false;
  }
}
