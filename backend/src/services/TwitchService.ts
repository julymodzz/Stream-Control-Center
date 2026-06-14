import WebSocket from 'ws'; // Wird bei npm install ws hinzugefügt (leichtgewichtig)
import { config } from '../config/env';
import { logger } from '../observability/logger';
import { ObsControlService } from './ObsControlService';
import { TwitchConfigStore } from './TwitchConfigStore';
import { mockStore } from './MockDataService';

export interface TwitchStreamInfo {
  isLive: boolean;
  title: string;
  categoryName: string;
  categoryId: string;
  viewerCount: number;
  startedAt: string | null;
  language: string;
}

export interface TwitchChannelInfo {
  broadcasterUserId: string;
  broadcasterName: string;
  title: string;
  categoryName: string;
}

export interface TwitchRaidEvent {
  fromBroadcasterUserId: string;
  fromBroadcasterUserName: string;
  toBroadcasterUserId: string;
  toBroadcasterUserName: string;
  viewers: number;
}

export interface TwitchEventSubSubscription {
  id: string;
  type: string;
  status: string;
  createdAt: string;
}

export class TwitchService {
  private obsControl: ObsControlService;
  private configStore: TwitchConfigStore;
  private ws: WebSocket | null = null;
  private sessionId: string | null = null;
  private keepaliveTimeout: NodeJS.Timeout | null = null;
  private reconnectAttempts = 0;
  private readonly maxReconnectAttempts = 10;
  private mock = config.mockMode ? mockStore : null;

  private accessToken: string | null = null;
  private refreshToken: string | null = null;
  private broadcasterUserId: string | null = null;
  private clientId: string | null = null;
  private clientSecret: string | null = null;

  // Twitch-spezifische Szenen-Namen - jetzt über ConfigStore auflösbar (funktionaler USP: Streamer kann eigene OBS-Namen verwenden)
  private readonly DEFAULT_TWITCH_SCENES = {
    RAID: 'Raid',
    STARTING_SOON: 'Starting Soon',
    BRB: 'BRB',
    JUST_CHATTING: 'Just Chatting',
    GAMEPLAY: 'Gameplay',
    ENDING: 'Ending Screen',
    OFFLINE: 'Offline',
  };

  constructor(obsControl: ObsControlService, configStore: TwitchConfigStore) {
    this.obsControl = obsControl;
    this.configStore = configStore;
  }

  private notificationService: any = null;
  setNotificationService(ns: any) {
    this.notificationService = ns;
  }

  async initialize(): Promise<void> {
    if (this.mock) {
      logger.info('[TwitchService] Mock-Modus aktiv – Twitch Integration simuliert');
      return;
    }

    // Lade persistierte Werte (haben Vorrang vor .env)
    const stored = this.configStore.getConfig();
    this.clientId = stored.clientId || config.twitch.clientId || null;
    this.clientSecret = stored.clientSecret || config.twitch.clientSecret || null;
    this.accessToken = stored.accessToken || config.twitch.accessToken || null;
    this.refreshToken = stored.refreshToken || config.twitch.refreshToken || null;
    this.broadcasterUserId = stored.broadcasterUserId || config.twitch.broadcasterUserId || null;

    if (!this.accessToken || !this.clientId) {
      logger.warn('[TwitchService] Kein Twitch Access Token oder Client ID konfiguriert. EventSub deaktiviert. Bitte über /twitch/auth-url verbinden.');
      return;
    }

    // Auto-Refresh versuchen, falls Refresh-Token vorhanden
    if (this.refreshToken && this.clientSecret) {
      try {
        await this.refreshAccessToken();
      } catch (e) {
        logger.warn({ err: e }, '[TwitchService] Token-Refresh fehlgeschlagen – alte Token werden weiterverwendet');
      }
    }

    if (!this.broadcasterUserId) {
      try {
        const me = await this.getCurrentUser();
        this.broadcasterUserId = me.id;
        await this.configStore.updateTokens({ broadcasterUserId: this.broadcasterUserId });
        logger.info({ broadcasterUserId: this.broadcasterUserId }, '[TwitchService] Broadcaster User ID automatisch ermittelt und gespeichert');
      } catch (e) {
        logger.error({ err: e }, '[TwitchService] Konnte Broadcaster User ID nicht ermitteln');
      }
    }

    if (config.twitch.eventSubEnabled) {
      await this.connectEventSub();
    }

    logger.info('[TwitchService] TwitchService initialisiert (Twitch primär, persistente Speicherung aktiv)');
  }

  // ===================== HELIX API =====================

  private async helixFetch<T>(path: string, method: 'GET' | 'POST' | 'PATCH' = 'GET', body?: any): Promise<T> {
    if (!this.accessToken || !this.clientId) {
      throw new Error('Twitch Credentials fehlen');
    }

    const url = `https://api.twitch.tv/helix${path}`;
    const headers: Record<string, string> = {
      'Client-ID': this.clientId,
      'Authorization': `Bearer ${this.accessToken}`,
      'Content-Type': 'application/json',
    };

    let res = await fetch(url, {
      method,
      headers,
      body: body ? JSON.stringify(body) : undefined,
    });

    if (res.status === 401 && this.refreshToken && this.clientSecret) {
      // Versuch Refresh bei Unauthorized
      const refreshed = await this.refreshAccessToken();
      if (refreshed && this.accessToken) {
        headers['Authorization'] = `Bearer ${this.accessToken}`;
        res = await fetch(url, {
          method,
          headers,
          body: body ? JSON.stringify(body) : undefined,
        });
      }
    }

    if (!res.ok) {
      const text = await res.text();
      logger.error({ status: res.status, body: text }, 'Twitch Helix API Fehler');
      throw new Error(`Twitch API Fehler ${res.status}: ${text}`);
    }

    return res.json() as Promise<T>;
  }

  async getCurrentUser(): Promise<{ id: string; login: string; display_name: string }> {
    const data = await this.helixFetch<{ data: any[] }>('/users');
    return data.data[0];
  }

  async getStreamInfo(): Promise<TwitchStreamInfo | null> {
    if (!this.broadcasterUserId) return null;

    const data = await this.helixFetch<{ data: any[] }>(`/streams?user_id=${this.broadcasterUserId}`);
    const stream = data.data[0];

    if (!stream) {
      return {
        isLive: false,
        title: '',
        categoryName: '',
        categoryId: '',
        viewerCount: 0,
        startedAt: null,
        language: '',
      };
    }

    return {
      isLive: true,
      title: stream.title,
      categoryName: stream.game_name,
      categoryId: stream.game_id,
      viewerCount: stream.viewer_count,
      startedAt: stream.started_at,
      language: stream.language,
    };
  }

  async getChannelInfo(): Promise<TwitchChannelInfo | null> {
    if (!this.broadcasterUserId) return null;

    const data = await this.helixFetch<{ data: any[] }>(`/channels?broadcaster_id=${this.broadcasterUserId}`);
    const ch = data.data[0];
    if (!ch) return null;

    return {
      broadcasterUserId: ch.broadcaster_id,
      broadcasterName: ch.broadcaster_name,
      title: ch.title,
      categoryName: ch.game_name,
    };
  }

  /**
   * Refresh Access Token using refresh_token + client_secret (recommended for long-running service)
   */
  private async refreshAccessToken(): Promise<boolean> {
    if (!this.refreshToken || !this.clientId || !this.clientSecret) {
      return false;
    }

    try {
      const body = new URLSearchParams({
        grant_type: 'refresh_token',
        refresh_token: this.refreshToken,
        client_id: this.clientId,
        client_secret: this.clientSecret,
      });

      const res = await fetch('https://id.twitch.tv/oauth2/token', {
        method: 'POST',
        headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
        body: body.toString(),
      });

      if (!res.ok) {
        const errText = await res.text();
        throw new Error(`Token refresh failed: ${res.status} ${errText}`);
      }

      const tokenData = await res.json() as { access_token: string; refresh_token?: string; expires_in: number };

      this.accessToken = tokenData.access_token;
      if (tokenData.refresh_token) {
        this.refreshToken = tokenData.refresh_token;
      }

      await this.configStore.updateTokens({
        accessToken: this.accessToken,
        refreshToken: this.refreshToken,
      });

      logger.info('[TwitchService] Access Token erfolgreich refreshed');
      return true;
    } catch (e) {
      logger.error({ err: e }, '[TwitchService] Token Refresh fehlgeschlagen');
      return false;
    }
  }

  /**
   * Aktualisiert Stream-Titel und/oder Kategorie auf Twitch (Helix)
   * Wird vom Dashboard oder automatisch bei Szenenwechseln genutzt.
   */
  async updateStreamInfo(title?: string, categoryIdOrName?: string): Promise<boolean> {
    if (!this.broadcasterUserId || !this.accessToken) {
      logger.warn('[Twitch] updateStreamInfo: Keine Credentials');
      return false;
    }

    const body: any = {};
    if (title) body.title = title;
    if (categoryIdOrName) {
      // Wenn es eine Zahl ist → game_id, sonst versuchen name zu ID zu konvertieren (vereinfacht)
      if (/^\d+$/.test(categoryIdOrName)) {
        body.game_id = categoryIdOrName;
      } else {
        // Für echte Nutzung sollte man /games?name= abfragen. Hier als Komfort vereinfacht.
        body.game_name = categoryIdOrName; // Helix akzeptiert game_name in manchen Kontexten, besser game_id
      }
    }

    try {
      await this.helixFetch(`/channels?broadcaster_id=${this.broadcasterUserId}`, 'PATCH', body);
      logger.info({ title, categoryIdOrName }, '[Twitch] Stream-Info erfolgreich aktualisiert');
      return true;
    } catch (e) {
      logger.error({ err: e }, '[Twitch] updateStreamInfo fehlgeschlagen');
      return false;
    }
  }

  // ===================== EVENTSUB (WebSocket) =====================

  private async connectEventSub(): Promise<void> {
    if (this.ws) {
      this.ws.close();
    }

    this.ws = new WebSocket('wss://eventsub.wss.twitch.tv/ws');

    this.ws.on('open', () => {
      logger.info('[Twitch EventSub] WebSocket verbunden');
      this.reconnectAttempts = 0;
    });

    this.ws.on('message', async (data: Buffer) => {
      try {
        const msg = JSON.parse(data.toString());
        await this.handleEventSubMessage(msg);
      } catch (e) {
        logger.error({ err: e }, 'EventSub Message Parsing Fehler');
      }
    });

    this.ws.on('close', () => {
      logger.warn('[Twitch EventSub] Verbindung geschlossen – Reconnect...');
      this.scheduleReconnect();
    });

    this.ws.on('error', (err) => {
      logger.error({ err }, '[Twitch EventSub] WS Fehler');
    });
  }

  private scheduleReconnect() {
    if (this.reconnectAttempts >= this.maxReconnectAttempts) {
      logger.error('[Twitch] Max Reconnect-Versuche erreicht');
      return;
    }
    const delay = Math.min(1000 * Math.pow(2, this.reconnectAttempts), 30000);
    this.reconnectAttempts++;
    setTimeout(() => this.connectEventSub(), delay);
  }

  private async handleEventSubMessage(msg: any) {
    const metadata = msg.metadata;
    const payload = msg.payload;

    switch (metadata.message_type) {
      case 'session_welcome':
        this.sessionId = payload.session.id;
        logger.info({ sessionId: this.sessionId }, '[Twitch EventSub] Session Welcome – jetzt Subscriptions anlegen');
        await this.subscribeToAllEvents();
        break;

      case 'session_keepalive':
        if (this.keepaliveTimeout) clearTimeout(this.keepaliveTimeout);
        break;

      case 'notification':
        await this.handleNotification(payload);
        break;

      case 'session_reconnect':
        logger.info('[Twitch] Reconnect angefordert – neue URL');
        // In Produktion die reconnect_url aus payload nutzen
        this.connectEventSub();
        break;

      case 'revocation':
        logger.warn({ subscription: payload.subscription }, 'EventSub Subscription widerrufen');
        break;
    }
  }

  /**
   * Registriert alle relevanten EventSub Subscriptions für einen Twitch-Streamer.
   * Benötigte Scopes im User Token:
   * - channel:read:raids
   * - channel:read:subscriptions
   * - channel:read:redemptions (optional)
   * - channel:manage:broadcast (für Titel-Updates)
   * - moderator:read:followers (optional)
   */
  private async subscribeToAllEvents() {
    if (!this.sessionId || !this.broadcasterUserId) return;

    const events = [
      { type: 'channel.raid', condition: { to_broadcaster_user_id: this.broadcasterUserId } },
      { type: 'channel.update', condition: { broadcaster_user_id: this.broadcasterUserId } },
      { type: 'stream.online', condition: { broadcaster_user_id: this.broadcasterUserId } },
      { type: 'stream.offline', condition: { broadcaster_user_id: this.broadcasterUserId } },
      { type: 'channel.follow', condition: { broadcaster_user_id: this.broadcasterUserId } },
      { type: 'channel.subscribe', condition: { broadcaster_user_id: this.broadcasterUserId } },
      { type: 'channel.subscription.message', condition: { broadcaster_user_id: this.broadcasterUserId } },
      { type: 'channel.cheer', condition: { broadcaster_user_id: this.broadcasterUserId } },
      { type: 'channel.hype_train.begin', condition: { broadcaster_user_id: this.broadcasterUserId } },
      { type: 'channel.prediction.begin', condition: { broadcaster_user_id: this.broadcasterUserId } },
    ];

    for (const event of events) {
      try {
        await this.createEventSubSubscription(event.type, event.condition);
      } catch (e) {
        logger.warn({ type: event.type, err: e }, 'Subscription fehlgeschlagen (Scope fehlt möglicherweise)');
      }
    }
  }

  private async createEventSubSubscription(type: string, condition: Record<string, string | undefined>) {
    // Hier wird normalerweise der App Access Token + EventSub Transport verwendet.
    // Da wir User Token haben, funktioniert es über den gleichen Auth-Header.
    // Für echte Produktion besser separater App Token für Subscriptions nutzen.
    const body = {
      type,
      version: '1',
      condition,
      transport: {
        method: 'websocket',
        session_id: this.sessionId,
      },
    };

    await this.helixFetch('/eventsub/subscriptions', 'POST', body);
    logger.info({ type }, '[Twitch EventSub] Subscription angelegt');
  }

  private async handleNotification(payload: any) {
    const { subscription, event } = payload;
    const type = subscription.type;

    logger.info({ type, event: JSON.stringify(event).slice(0, 300) }, '[Twitch] EventSub Notification empfangen');

    switch (type) {
      case 'channel.raid':
        await this.onRaid({
          fromBroadcasterUserName: event.from_broadcaster_user_name,
          viewers: event.viewers,
        } as any);
        break;

      case 'channel.update':
        // Titel oder Category hat sich geändert (z.B. durch Streamer im Dashboard)
        await this.onChannelUpdate(event);
        break;

      case 'stream.online':
        await this.onStreamOnline();
        break;

      case 'stream.offline':
        await this.onStreamOffline();
        break;

      case 'channel.hype_train.begin':
        const justChattingScene = this.configStore.resolveSceneName('justChatting', this.DEFAULT_TWITCH_SCENES.JUST_CHATTING);
        await this.obsControl.execute('set-scene', { sceneName: justChattingScene });
        await this.toggleSource(this.configStore.resolveSourceName('hypeTrainOverlay', 'Hype Train Overlay'), true);
        break;

      case 'channel.prediction.begin':
        await this.toggleSource(this.configStore.resolveSourceName('predictionOverlay', 'Prediction Overlay'), true);
        try {
          await this.obsControl['obsWs']?.call('SetInputSettings', {
            inputName: this.configStore.resolveSourceName('predictionText', 'Prediction-Text'),
            inputSettings: { text: (event?.title || 'Neue Prediction!') as any },
          });
        } catch { /* ignore */ }
        break;

      case 'channel.prediction.end':
      case 'channel.prediction.lock':
        await this.toggleSource(this.configStore.resolveSourceName('predictionOverlay', 'Prediction Overlay'), false);
        break;

      case 'channel.subscribe':
      case 'channel.subscription.message':
        const subAlertSrc = this.configStore.resolveSourceName('subAlert', 'Sub Alert');
        await this.toggleSource(subAlertSrc, true);
        setTimeout(() => this.toggleSource(subAlertSrc, false), 8000);
        break;

      // Weitere Events können hier einfach erweitert werden
      default:
        logger.debug({ type }, 'EventSub Event nicht weiter verarbeitet');
    }
  }

  // ===================== EVENT HANDLER → OBS AUTOMATION =====================

  private async onRaid(raid: { fromBroadcasterUserName: string; viewers: number }) {
    logger.info({ raider: raid.fromBroadcasterUserName, viewers: raid.viewers }, '!!! RAID EINGEGANGEN !!!');

    // Use configurable names from store (functional improvement: no more hardcoding, streamer defines own OBS source/scene names)
    const raidScene = this.configStore.resolveSceneName('raid', this.DEFAULT_TWITCH_SCENES.RAID);
    const raidOverlaySource = this.configStore.resolveSourceName('raidOverlay', 'Raid Overlay');
    const raidTextSource = this.configStore.resolveSourceName('raidText', 'Raid-Text');

    const result = await this.obsControl.execute('set-scene', { sceneName: raidScene });

    if (result.success) {
      await this.obsControl.execute('set-source-visibility', {
        sourceName: raidOverlaySource,
        visible: true,
      });

      try {
        await this.obsControl['obsWs']?.call('SetInputSettings', {
          inputName: raidTextSource,
          inputSettings: {
            text: `RAID von ${raid.fromBroadcasterUserName} (${raid.viewers} Viewer)`,
          },
        });
      } catch {
        logger.debug('Raid text source not found or wrong type - using configurable name');
      }
    }

    // Rich contextual Twitch alert (integrated into NotificationService)
    this.notificationService?.createTwitchEventAlert?.('raid', `Raid von ${raid.fromBroadcasterUserName} mit ${raid.viewers} Viewern`);
  }

  private async onChannelUpdate(event: any) {
    // Hier könnte man OBS-Texte oder Browser-Sources synchronisieren
    logger.info({ newTitle: event.title, newGame: event.category_name }, 'Channel Update von Twitch');
  }

  private async onStreamOnline() {
    logger.info('[Twitch] Stream ist jetzt LIVE laut Twitch');
    // Optional: Szene auf "Just Chatting" oder letzte bekannte Szene stellen
  }

  private async onStreamOffline() {
    logger.info('[Twitch] Stream OFFLINE laut Twitch');
    const endingScene = this.configStore.resolveSceneName('ending', this.DEFAULT_TWITCH_SCENES.ENDING);
    await this.obsControl.execute('set-scene', { sceneName: endingScene });
  }

  // ===================== ÖFFENTLICHE HILFSMETHODEN =====================

  async manualRaidTrigger(raiderName: string, viewerCount: number = 50) {
    await this.onRaid({ fromBroadcasterUserName: raiderName, viewers: viewerCount });
  }

  async getLiveStats(): Promise<any> {
    const stream = await this.getStreamInfo();
    return {
      ...stream,
      twitchConnected: !!this.accessToken,
      lastEventSubSession: this.sessionId,
    };
  }

  async setAccessToken(token: string, refresh?: string, broadcasterId?: string) {
    this.accessToken = token;
    if (refresh) this.refreshToken = refresh;
    if (broadcasterId) this.broadcasterUserId = broadcasterId;

    await this.configStore.updateTokens({
      accessToken: this.accessToken || undefined,
      refreshToken: this.refreshToken || undefined,
      broadcasterUserId: this.broadcasterUserId || undefined,
    });

    logger.info('[TwitchService] Neue Access Token gesetzt und persistent gespeichert – EventSub wird neu verbunden');
    if (this.ws) this.ws.close();
    await this.connectEventSub();
  }

  private async toggleSource(sourceName: string, visible: boolean) {
    try {
      const currentScene = (await this.obsControl['obsWs']?.call('GetCurrentProgramScene'))?.sceneName;
      if (!currentScene) return;
      const items = await this.obsControl['obsWs']?.call('GetSceneItemList', { sceneName: currentScene });
      const item = items?.sceneItems?.find((i: any) => i.sourceName === sourceName);
      if (item && item.sceneItemId != null) {
        await this.obsControl['obsWs']?.call('SetSceneItemEnabled', {
          sceneName: currentScene,
          sceneItemId: item.sceneItemId as number,
          sceneItemEnabled: visible,
        });
      }
    } catch {
      // Source existiert nicht – ignorieren
    }
  }

  shutdown() {
    if (this.ws) {
      this.ws.close();
      this.ws = null;
    }
    if (this.keepaliveTimeout) clearTimeout(this.keepaliveTimeout);
    logger.info('[TwitchService] Heruntergefahren');
  }
}
