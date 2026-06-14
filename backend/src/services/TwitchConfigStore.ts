import fs from 'fs/promises';
import path from 'path';
import { config as appConfig } from '../config/env';
import { logger } from '../observability/logger';

export interface TwitchStoredConfig {
  clientId?: string;
  clientSecret?: string;
  accessToken?: string;
  refreshToken?: string;
  broadcasterUserId?: string;
  scopes?: string[];
  connectedAt?: string;
  lastRefreshedAt?: string;

  // Functional: User-configurable mappings for OBS sources and scenes (core for easy streamer automation and USP)
  sourceMappings?: {
    raidOverlay?: string;
    raidText?: string;
    predictionOverlay?: string;
    predictionText?: string;
    hypeTrainOverlay?: string;
    subAlert?: string;
    [key: string]: string | undefined;
  };
  sceneNameOverrides?: {
    raid?: string;
    startingSoon?: string;
    brb?: string;
    justChatting?: string;
    gameplay?: string;
    ending?: string;
    [key: string]: string | undefined;
  };
}

export class TwitchConfigStore {
  private filePath: string;
  private data: TwitchStoredConfig = {};
  private loaded = false;

  constructor() {
    this.filePath = path.join(appConfig.dataDir, 'twitch.json');
  }

  async load(): Promise<void> {
    try {
      await fs.mkdir(path.dirname(this.filePath), { recursive: true });
      const raw = await fs.readFile(this.filePath, 'utf-8');
      this.data = JSON.parse(raw);
      this.loaded = true;
      logger.info('[TwitchConfigStore] Config geladen');
    } catch {
      this.data = {};
      this.loaded = true;
      logger.debug('[TwitchConfigStore] Keine bestehende twitch.json – starte leer');
    }
  }

  async save(): Promise<void> {
    try {
      await fs.writeFile(this.filePath, JSON.stringify(this.data, null, 2), 'utf-8');
      logger.debug('[TwitchConfigStore] Config gespeichert');
    } catch (e) {
      logger.error({ err: e }, '[TwitchConfigStore] Fehler beim Speichern');
    }
  }

  getConfig(): TwitchStoredConfig {
    if (!this.loaded) {
      // Lazy load if not initialized yet
      // In practice we call load() in bootstrap
    }
    return { ...this.data };
  }

  async updateTokens(update: Partial<TwitchStoredConfig>): Promise<void> {
    this.data = {
      ...this.data,
      ...update,
      lastRefreshedAt: new Date().toISOString(),
    };
    await this.save();
  }

  async setFullConfig(full: TwitchStoredConfig): Promise<void> {
    this.data = {
      ...full,
      connectedAt: this.data.connectedAt || new Date().toISOString(),
    };
    await this.save();
  }

  async clear(): Promise<void> {
    this.data = {};
    await this.save();
  }

  isConnected(): boolean {
    return !!this.data.accessToken && !!this.data.broadcasterUserId;
  }

  // Functional helpers for configurable mappings (prevents hardcoding, gives streamers full control over their OBS setup)
  getSourceMappings() {
    return this.data.sourceMappings || {};
  }

  async setSourceMappings(mappings: TwitchStoredConfig['sourceMappings']) {
    this.data.sourceMappings = { ...this.data.sourceMappings, ...mappings };
    await this.save();
  }

  getSceneNameOverrides() {
    return this.data.sceneNameOverrides || {};
  }

  async setSceneNameOverrides(overrides: TwitchStoredConfig['sceneNameOverrides']) {
    this.data.sceneNameOverrides = { ...this.data.sceneNameOverrides, ...overrides };
    await this.save();
  }

  // Resolve with fallback to defaults
  resolveSceneName(key: string, defaultName: string): string {
    const overrides = this.getSceneNameOverrides();
    return overrides[key as keyof typeof overrides] || defaultName;
  }

  resolveSourceName(key: string, defaultName: string): string {
    const mappings = this.getSourceMappings();
    return mappings[key as keyof typeof mappings] || defaultName;
  }
}
