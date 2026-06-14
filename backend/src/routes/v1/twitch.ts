import { Router, Request, Response } from 'express';
import { config } from '../../config/env';
import { logger } from '../../observability/logger';
import { AuditService } from '../../audit/AuditService';
import { MonitorService } from '../../services/MonitorService';
import { ObsControlService } from '../../services/ObsControlService';
import { ObsSettingsService } from '../../services/ObsSettingsService';
import { TwitchConfigStore } from '../../services/TwitchConfigStore';
import { TwitchService } from '../../services/TwitchService';
import { broadcastDashboard } from '../../socket';
import { authorize } from '../../middleware/auth';
import { validate } from '../../middleware/validate';
import { z } from 'zod';
import { randomUUID } from 'crypto';

const updateStreamSchema = z.object({
  title: z.string().min(1).max(140).optional(),
  categoryIdOrName: z.string().min(1).max(100).optional(),
});

const raidTriggerSchema = z.object({
  raiderName: z.string().min(1),
  viewerCount: z.number().int().min(1).optional(),
});

const applyProfileSchema = z.object({
  profileId: z.string(),
});

const setCredentialsSchema = z.object({
  accessToken: z.string().min(20),
  refreshToken: z.string().optional(),
  broadcasterUserId: z.string().optional(),
});

// ==================== TWITCH OAUTH ====================
const TWITCH_AUTH_BASE = 'https://id.twitch.tv/oauth2/authorize';
const TWITCH_TOKEN_URL = 'https://id.twitch.tv/oauth2/token';
const TWITCH_SCOPES = [
  'channel:manage:broadcast',
  'channel:read:raids',
  'channel:read:subscriptions',
  'channel:read:redemptions',
  'moderator:read:followers',
].join(' ');

// In Produktion sollte TWITCH_REDIRECT_URI in .env auf die öffentliche URL zeigen
const DEFAULT_REDIRECT = process.env.TWITCH_REDIRECT_URI || 'http://localhost:3001/api/v1/twitch/callback';

// In-Memory State für OAuth (für bessere Sicherheit in Prod: Redis/DB)
const oauthStates = new Map<string, { created: number }>();

export function createTwitchRouter(
  twitchService: TwitchService,
  twitchConfigStore: TwitchConfigStore,
  obsSettingsService: ObsSettingsService,
  obsControl: ObsControlService,
  monitor: MonitorService,
  auditService: AuditService
): Router {
  const router = Router();

  // Status & Live-Info
  router.get('/status', async (_req: Request, res: Response) => {
    try {
      const stats = await twitchService.getLiveStats();
      res.json({ success: true, data: stats });
    } catch (e) {
      res.status(500).json({ success: false, error: 'Twitch Status konnte nicht geladen werden' });
    }
  });

  // Stream Titel + Kategorie aktualisieren (wichtig für Twitch)
  router.post('/update-stream-info', validate(updateStreamSchema), async (req: Request, res: Response) => {
    const { title, categoryIdOrName } = req.body;
    const ok = await twitchService.updateStreamInfo(title, categoryIdOrName);

    await auditService.log(
      { userId: req.user!.sub, username: req.user!.username, sourceIp: 'internal' },
      'twitch.update_stream_info',
      'twitch',
      ok,
      `Titel: ${title || '-'} | Category: ${categoryIdOrName || '-'}`
    );

    if (ok) await broadcastDashboard(monitor);
    res.json({ success: ok, message: ok ? 'Stream-Info auf Twitch aktualisiert' : 'Fehler beim Aktualisieren' });
  });

  // Manuelles Raid-Trigger (für Tests oder manuelle Bedienung)
  router.post('/trigger-raid', validate(raidTriggerSchema), async (req: Request, res: Response) => {
    const { raiderName, viewerCount = 50 } = req.body;
    await twitchService.manualRaidTrigger(raiderName, viewerCount);

    await auditService.log(
      { userId: req.user!.sub, username: req.user!.username, sourceIp: 'internal' },
      'twitch.manual_raid',
      'twitch',
      true,
      `Manueller Raid von ${raiderName} mit ${viewerCount} Viewern getriggert`
    );

    await broadcastDashboard(monitor);
    res.json({ success: true, message: `Raid-Szene für ${raiderName} aktiviert` });
  });

  // Encoder / Output Einstellungen
  router.get('/encoder-profiles', (_req, res) => {
    const profiles = obsSettingsService.getTwitchRecommendedProfiles();
    res.json({ success: true, data: profiles });
  });

  router.get('/current-output', async (_req, res) => {
    try {
      const current = await obsSettingsService.getCurrentOutputSettings();
      res.json({ success: true, data: current });
    } catch (e: any) {
      res.status(500).json({ success: false, error: e.message });
    }
  });

  router.get('/intel-diagnostics', async (_req, res) => {
    try {
      const diag = await obsSettingsService.getIntelDiagnostics();
      res.json({ success: true, data: diag });
    } catch (e: any) {
      res.status(500).json({ success: false, error: e.message });
    }
  });

  router.post('/apply-twitch-profile', validate(applyProfileSchema), async (req: Request, res: Response) => {
    const { profileId } = req.body;
    const result = await obsSettingsService.applyTwitchProfile(profileId);

    await auditService.log(
      { userId: req.user!.sub, username: req.user!.username, sourceIp: 'internal' },
      'obs.apply_twitch_profile',
      'obs',
      result.success,
      result.message
    );

    if (result.success) await broadcastDashboard(monitor);
    res.json({ success: result.success, data: result });
  });

  // Apply Profile + Stream neu starten (sehr praktisch nach Encoder-Wechsel)
  router.post('/apply-profile-and-restart', validate(applyProfileSchema), async (req: Request, res: Response) => {
    const { profileId } = req.body;

    const profileResult = await obsSettingsService.applyTwitchProfile(profileId);

    if (!profileResult.success) {
      res.json({ success: false, data: profileResult });
      return;
    }

    // Kurze Pause, damit OBS die neuen Settings übernehmen kann
    await new Promise((r) => setTimeout(r, 800));

    let restartMessage = '';
    try {
      // Stream stoppen + starten (sicherer als reconfigure während live)
      await obsControl.execute('stop-stream', {});
      await new Promise((r) => setTimeout(r, 1200));
      await obsControl.execute('start-stream', {});
      restartMessage = ' + Stream neu gestartet';
    } catch (e) {
      restartMessage = ' (Stream-Neustart fehlgeschlagen – bitte manuell neu starten)';
    }

    const finalMessage = profileResult.message + restartMessage;

    await auditService.log(
      { userId: req.user!.sub, username: req.user!.username, sourceIp: 'internal' },
      'obs.apply_profile_and_restart',
      'obs',
      true,
      finalMessage
    );

    await broadcastDashboard(monitor);
    res.json({ success: true, data: { ...profileResult, message: finalMessage } });
  });

  // Scene Presets (Twitch-spezifisch)
  router.get('/scene-presets', (_req, res) => {
    res.json({ success: true, data: obsSettingsService.getTwitchScenePresets() });
  });

  router.post('/apply-scene-preset', async (req: Request, res: Response) => {
    const { presetName } = req.body;
    if (!presetName) {
      res.status(400).json({ success: false, error: 'presetName erforderlich' });
      return;
    }
    const result = await obsSettingsService.applyScenePreset(presetName);

    await auditService.log(
      { userId: req.user!.sub, username: req.user!.username, sourceIp: 'internal' },
      'obs.apply_scene_preset',
      'obs',
      result.success,
      result.message
    );

    if (result.success) await broadcastDashboard(monitor);
    res.json({ success: result.success, data: result });
  });

  // Token manuell setzen (für erste Einrichtung oder Notfall)
  router.post('/set-credentials', validate(setCredentialsSchema), async (req: Request, res: Response) => {
    const { accessToken, refreshToken, broadcasterUserId } = req.body;

    await twitchService.setAccessToken(accessToken, refreshToken, broadcasterUserId);
    await twitchConfigStore.updateTokens({
      accessToken,
      refreshToken,
      broadcasterUserId,
      clientId: twitchConfigStore.getConfig().clientId,
      clientSecret: twitchConfigStore.getConfig().clientSecret,
    });

    await auditService.log(
      { userId: req.user!.sub, username: req.user!.username, sourceIp: 'internal' },
      'twitch.set_credentials',
      'twitch',
      true,
      'Twitch Credentials manuell aktualisiert'
    );

    res.json({ success: true, message: 'Twitch Credentials gesetzt und persistent gespeichert. EventSub wird neu verbunden.' });
  });

  // ===================== OAUTH FLOW =====================

  // Gibt die Twitch Authorize URL zurück (Frontend öffnet diese in neuem Tab)
  router.get('/auth-url', async (req: Request, res: Response) => {
    const clientId = twitchConfigStore.getConfig().clientId || config.twitch?.clientId; // fallback aus global config
    const redirectUri = req.query.redirect_uri as string || DEFAULT_REDIRECT;

    if (!clientId) {
      res.status(400).json({ success: false, error: 'TWITCH_CLIENT_ID nicht konfiguriert (in .env oder über UI)' });
      return;
    }

    const state = randomUUID();
    oauthStates.set(state, { created: Date.now() });
    // Cleanup alter States nach 10 Min
    setTimeout(() => oauthStates.delete(state), 10 * 60 * 1000);

    const params = new URLSearchParams({
      client_id: clientId,
      redirect_uri: redirectUri,
      response_type: 'code',
      scope: TWITCH_SCOPES,
      state,
    });

    const url = `${TWITCH_AUTH_BASE}?${params.toString()}`;
    res.json({ success: true, data: { url, state, redirectUri } });
  });

  // Callback – Twitch leitet hierher nach erfolgreicher Authorisierung
  router.get('/callback', async (req: Request, res: Response) => {
    const { code, state, error } = req.query as Record<string, string>;

    if (error) {
      logger.error({ error }, 'Twitch OAuth Fehler');
      return res.status(400).send(`<h1>Twitch Login fehlgeschlagen</h1><p>${error}</p><script>window.close()</script>`);
    }

    if (!code || !state || !oauthStates.has(state)) {
      return res.status(400).send('<h1>Invalid OAuth state</h1><script>window.close()</script>');
    }
    oauthStates.delete(state);

    try {
      const stored = twitchConfigStore.getConfig();
      const clientId = stored.clientId || config.twitch.clientId;
      const clientSecret = stored.clientSecret || config.twitch.clientSecret;

      if (!clientId || !clientSecret) {
        throw new Error('Client ID/Secret fehlen für Token-Austausch');
      }

      const redirectUri = DEFAULT_REDIRECT;

      // Code gegen Token tauschen
      const tokenBody = new URLSearchParams({
        client_id: clientId,
        client_secret: clientSecret,
        code,
        grant_type: 'authorization_code',
        redirect_uri: redirectUri,
      });

      const tokenRes = await fetch(TWITCH_TOKEN_URL, {
        method: 'POST',
        headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
        body: tokenBody.toString(),
      });

      if (!tokenRes.ok) {
        const txt = await tokenRes.text();
        throw new Error(`Token exchange failed: ${tokenRes.status} ${txt}`);
      }

      const tokenJson = await tokenRes.json() as {
        access_token: string;
        refresh_token: string;
        scope: string[];
        token_type: string;
      };

      // Broadcaster User ID holen
      const userRes = await fetch('https://api.twitch.tv/helix/users', {
        headers: {
          'Client-ID': clientId,
          'Authorization': `Bearer ${tokenJson.access_token}`,
        },
      });
      const userJson = await userRes.json() as { data: Array<{ id: string; login: string }> };
      const broadcasterUserId = userJson.data?.[0]?.id;

      // Alles persistent speichern
      await twitchConfigStore.setFullConfig({
        clientId,
        clientSecret,
        accessToken: tokenJson.access_token,
        refreshToken: tokenJson.refresh_token,
        broadcasterUserId,
        scopes: tokenJson.scope,
      });

      // Service updaten
      await twitchService.setAccessToken(tokenJson.access_token, tokenJson.refresh_token, broadcasterUserId);

      await auditService.log(
        { userId: req.user?.sub || 'oauth', username: req.user?.username || 'system', sourceIp: req.ip || 'oauth' },
        'twitch.oauth_connected',
        'twitch',
        true,
        `OAuth erfolgreich für Broadcaster ${broadcasterUserId}`
      );

      await broadcastDashboard(monitor);

      // Erfolgsseite für den User
      res.send(`
        <html>
          <head><title>Twitch verbunden</title></head>
          <body style="font-family:sans-serif; background:#111; color:#eee; padding:40px; text-align:center">
            <h1 style="color:#9146FF">✅ Twitch erfolgreich verbunden!</h1>
            <p>Dein Account wurde autorisiert. Du kannst dieses Fenster jetzt schließen.</p>
            <p style="font-size:0.8em; opacity:0.7">EventSub ist jetzt aktiv. Raids und Updates werden automatisch verarbeitet.</p>
            <script>setTimeout(() => window.close(), 2500);</script>
          </body>
        </html>
      `);
    } catch (e: any) {
      logger.error({ err: e }, 'Twitch OAuth Callback Fehler');
      res.status(500).send(`<h1>Fehler beim Verbinden</h1><pre>${e.message}</pre>`);
    }
  });

  // Disconnect / Tokens löschen
  router.post('/disconnect', async (req: Request, res: Response) => {
    await twitchConfigStore.clear();
    // Service neu initialisieren (ohne Token)
    // In Produktion könnte man den Service neu starten oder Tokens entfernen
    res.json({ success: true, message: 'Twitch Verbindung getrennt und Tokens gelöscht.' });
  });

  return router;
}
