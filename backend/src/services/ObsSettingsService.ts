import { config } from '../config/env';
import { logger } from '../observability/logger';
import { mockStore } from './MockDataService';

export interface EncoderProfile {
  id: string;
  label: string;
  encoder: 'x264' | 'qsv' | 'nvenc' | 'amf';
  preset: string;
  profile: string;
  tune?: string;
  bitrate: number;
  keyint: number; // seconds * fps
  resolution: string;
  fps: number;
  rateControl: 'CBR' | 'VBR' | 'CQP';
  notes: string;
}

export interface CurrentOutputSettings {
  encoder: string | null;
  bitrate: number | null;
  preset: string | null;
  profile: string | null;
  keyintSec: number | null;
  resolution: string | null;
  fps: number | null;
  detectedHardware: string[];
}

export interface ScenePreset {
  name: string;
  sceneName: string;
  description: string;
  sourcesToShow?: string[];
  sourcesToHide?: string[];
  recommendedFor?: string[]; // z.B. ['starting', 'raid', 'brb']
}

/**
 * ObsSettingsService
 * - Erkennt verfügbare Encoder (über OBS WebSocket + Fallback-Liste)
 * - Stellt "Twitch Recommended Profiles" für Intel CPU (x264 + QSV) bereit
 * - Erlaubt Apply von sicheren, 2026 Twitch-optimierten Settings (CBR, 2s Keyframe, etc.)
 * - Scene Presets für professionelle Twitch-Produktion
 */
export class ObsSettingsService {
  private obsWs: any = null; // Wird später per Setter oder Dependency Injection gesetzt
  private mock = config.mockMode ? mockStore : null;

  // Professionelle Twitch 2026 Empfehlungen (Intel CPU Fokus)
  // Quellen: Twitch Inspector, OBS Best Practices 2025/2026, Intel oneVPL + x264
  private readonly TWITCH_PROFILES: EncoderProfile[] = [
    {
      id: 'intel_x264_1080p60',
      label: 'Intel CPU – x264 1080p60 (Twitch Recommended)',
      encoder: 'x264',
      preset: 'veryfast',
      profile: 'high',
      tune: 'zerolatency',
      bitrate: config.encoder.targetBitrateKbps || 6500,
      keyint: 120, // 2 Sekunden @ 60fps
      resolution: '1920x1080',
      fps: 60,
      rateControl: 'CBR',
      notes: 'Beste CPU-Qualität für Intel ohne dedizierte GPU. Sehr stabil.',
    },
    {
      id: 'intel_x264_1080p60_faster',
      label: 'Intel CPU – x264 1080p60 (Faster Preset)',
      encoder: 'x264',
      preset: 'faster',
      profile: 'high',
      tune: 'zerolatency',
      bitrate: 7000,
      keyint: 120,
      resolution: '1920x1080',
      fps: 60,
      rateControl: 'CBR',
      notes: 'Etwas bessere Qualität als veryfast, höhere CPU-Last.',
    },
    {
      id: 'intel_qsv_1080p60',
      label: 'Intel Quick Sync (QSV/oneVPL) 1080p60',
      encoder: 'qsv',
      preset: 'quality', // oder 'high_quality' je nach OBS Version
      profile: 'high',
      bitrate: 6500,
      keyint: 120,
      resolution: '1920x1080',
      fps: 60,
      rateControl: 'CBR',
      notes: 'Nutzt Intel iGPU. Sehr effizient. Auf Ubuntu: intel-media-driver + oneVPL installieren!',
    },
    {
      id: 'intel_qsv_900p60',
      label: 'Intel QSV 900p60 (sehr stabil bei schwacher CPU)',
      encoder: 'qsv',
      preset: 'quality',
      profile: 'main',
      bitrate: 5500,
      keyint: 120,
      resolution: '1600x900',
      fps: 60,
      rateControl: 'CBR',
      notes: 'Gute Kompromiss-Lösung für ältere Intel CPUs oder hohe Systemlast.',
    },
    {
      id: 'generic_x264_720p60',
      label: 'x264 720p60 (sehr leicht)',
      encoder: 'x264',
      preset: 'veryfast',
      profile: 'main',
      bitrate: 4500,
      keyint: 120,
      resolution: '1280x720',
      fps: 60,
      rateControl: 'CBR',
      notes: 'Für schwache Systeme oder hohe Stabilität.',
    },
  ];

  // Klassische professionelle Twitch-Szenen (2026 Standard)
  private readonly TWITCH_SCENE_PRESETS: ScenePreset[] = [
    {
      name: 'Starting Soon',
      sceneName: 'Starting Soon',
      description: 'Begrüßung, Countdown, Socials, Musik',
      sourcesToShow: ['Starting Overlay', 'Chat', 'Music Visualizer'],
      recommendedFor: ['pre-stream'],
    },
    {
      name: 'Raid',
      sceneName: 'Raid',
      description: 'Raid-Screen mit Raider-Name, Viewer-Anzahl, Willkommens-Text',
      sourcesToShow: ['Raid Overlay', 'Raid-Text', 'Alert Box'],
      recommendedFor: ['raid'],
    },
    {
      name: 'BRB',
      sceneName: 'BRB',
      description: 'Be Right Back – Musik + Timer + Webcam klein',
      sourcesToShow: ['BRB Overlay', 'Webcam Small', 'Music'],
      recommendedFor: ['break'],
    },
    {
      name: 'Just Chatting',
      sceneName: 'Just Chatting',
      description: 'Facecam + Chat + Interaktion',
      sourcesToShow: ['Webcam', 'Chat', 'Just Chatting Overlay'],
      recommendedFor: ['talking'],
    },
    {
      name: 'Gameplay',
      sceneName: 'Gameplay',
      description: 'Vollbild Game Capture + kleiner Facecam + Alerts',
      sourcesToShow: ['Game Capture', 'Webcam PIP', 'Alerts'],
      recommendedFor: ['game'],
    },
    {
      name: 'Ending Screen',
      sceneName: 'Ending Screen',
      description: 'Stream beenden, Thanks, nächste Streams, Raid-Option',
      sourcesToShow: ['Ending Overlay', 'Socials', 'VOD Notice'],
      recommendedFor: ['post-stream'],
    },
  ];

  setObsWebSocket(obsWs: any) {
    this.obsWs = obsWs;
  }

  /**
   * Versucht, aktuelle Encoder- und Output-Einstellungen aus OBS zu lesen.
   * Für neueste OBS Versionen (30/31+) mit Advanced Output Mode.
   */
  async getCurrentOutputSettings(): Promise<CurrentOutputSettings> {
    if (this.mock) {
      return {
        encoder: 'x264',
        bitrate: 6500,
        preset: 'veryfast',
        profile: 'high',
        keyintSec: 2,
        resolution: '1920x1080',
        fps: 60,
        detectedHardware: ['Intel CPU', 'x264'],
      };
    }

    if (!this.obsWs) {
      throw new Error('OBS WebSocket nicht verbunden');
    }

    try {
      // In aktuellen OBS Versionen sind erweiterte Einstellungen oft über GetOutputSettings oder GetVideoEncoderSettings erreichbar.
      // Wir versuchen mehrere gängige Wege.
      const [streamStatus, videoSettings] = await Promise.allSettled([
        this.obsWs.call('GetStreamStatus'),
        this.obsWs.call('GetVideoSettings'),
      ]);

      // Erweiterte Output Settings (Advanced Output)
      let advanced: any = {};
      try {
        advanced = await this.obsWs.call('GetOutputSettings', { outputName: 'adv_stream_output' });
      } catch {
        // Manche Setups nutzen 'simple_stream_output' oder andere Namen
      }

      const encoder = advanced?.encoder || advanced?.streamEncoder || 'unknown';
      const bitrate = advanced?.bitrate || advanced?.videoBitrate || null;

      return {
        encoder,
        bitrate: bitrate ? Number(bitrate) : null,
        preset: advanced?.preset || advanced?.x264Preset || null,
        profile: advanced?.profile || null,
        keyintSec: advanced?.keyint_sec || 2,
        resolution: videoSettings.status === 'fulfilled' ? `${(videoSettings.value as any).baseWidth || 1920}x${(videoSettings.value as any).baseHeight || 1080}` : null,
        fps: videoSettings.status === 'fulfilled' ? (videoSettings.value as any).fpsNumerator / (videoSettings.value as any).fpsDenominator : null,
        detectedHardware: this.detectHardwareFromEncoder(encoder),
      };
    } catch (e) {
      logger.warn({ err: e }, 'Konnte Output Settings nicht vollständig lesen – Fallback');
      return {
        encoder: null,
        bitrate: config.encoder.targetBitrateKbps,
        preset: config.encoder.preset || 'veryfast',
        profile: null,
        keyintSec: config.encoder.keyframeIntervalSec,
        resolution: config.encoder.resolution,
        fps: config.encoder.fps,
        detectedHardware: ['Intel CPU (Fallback)'],
      };
    }
  }

  private detectHardwareFromEncoder(encoder: string): string[] {
    const lower = (encoder || '').toLowerCase();
    if (lower.includes('qsv') || lower.includes('quick_sync')) return ['Intel Quick Sync (iGPU)'];
    if (lower.includes('nvenc') || lower.includes('nvidia')) return ['NVIDIA NVENC'];
    if (lower.includes('amf') || lower.includes('amd')) return ['AMD AMF'];
    if (lower.includes('x264')) return ['CPU (x264)'];
    return ['Unbekannt / CPU-basiert'];
  }

  /**
   * Gibt alle vordefinierten Twitch-Empfehlungs-Profile zurück.
   * Der User kann beim Einrichten oder in den Settings eines auswählen.
   */
  getTwitchRecommendedProfiles(): EncoderProfile[] {
    // Bei Bedarf können wir später dynamisch filtern basierend auf detektierter Hardware
    return [...this.TWITCH_PROFILES];
  }

  /**
   * Wendet ein komplettes Twitch-optimiertes Output-Profil an (CBR, Keyframe 2s, etc.).
   * Funktioniert am besten mit "Advanced Output Mode" in OBS.
   */
  async applyTwitchProfile(profileId: string): Promise<{ success: boolean; message: string; applied: Partial<EncoderProfile> }> {
    const profile = this.TWITCH_PROFILES.find((p) => p.id === profileId);
    if (!profile) {
      return { success: false, message: `Profil ${profileId} nicht gefunden`, applied: {} };
    }

    if (this.mock) {
      return {
        success: true,
        message: `[Mock] Twitch Profil "${profile.label}" angewendet`,
        applied: profile,
      };
    }

    if (!this.obsWs) {
      return { success: false, message: 'OBS nicht verbunden', applied: {} };
    }

    try {
      // 1. Video Settings (Base Canvas + Output)
      await this.obsWs.call('SetVideoSettings', {
        baseWidth: parseInt(profile.resolution.split('x')[0]),
        baseHeight: parseInt(profile.resolution.split('x')[1]),
        fpsNumerator: profile.fps,
        fpsDenominator: 1,
      });

      // 2. Advanced Stream Output Settings setzen
      // Hinweis: Die exakten Felder hängen von der OBS Version und dem aktiven Output Mode ab.
      // Dies ist die 2026-erprobte Variante für Advanced Output.
      const outputSettings: Record<string, any> = {
        encoder: profile.encoder,
        rate_control: profile.rateControl,
        bitrate: profile.bitrate,
        keyint_sec: profile.keyint / profile.fps, // Sekunden
        preset: profile.preset,
        profile: profile.profile,
      };

      if (profile.tune) {
        outputSettings.tune = profile.tune;
      }

      // Versuchen, adv_stream_output zu setzen
      try {
        await this.obsWs.call('SetOutputSettings', {
          outputName: 'adv_stream_output',
          outputSettings,
        });
      } catch {
        // Fallback für simple/advanced unterschiedliche Benennung
        await this.obsWs.call('SetStreamServiceSettings', {
          streamServiceType: 'rtmp_custom',
          streamServiceSettings: {
            ...outputSettings,
            server: 'rtmp://live.twitch.tv/app',
          },
        });
      }

      logger.info({ profileId, profile: profile.label }, '[ObsSettings] Twitch-Profil erfolgreich angewendet');

      return {
        success: true,
        message: `Twitch-Profil "${profile.label}" angewendet (CBR, ${profile.keyint / profile.fps}s Keyframe)`,
        applied: profile,
      };
    } catch (error: any) {
      logger.error({ err: error, profileId }, 'Fehler beim Anwenden des Twitch-Profils');
      return {
        success: false,
        message: error.message || 'Unbekannter Fehler beim Setzen der Encoder-Einstellungen',
        applied: profile,
      };
    }
  }

  /**
   * Gibt alle vordefinierten professionellen Twitch-Szenen-Presets zurück.
   */
  getTwitchScenePresets(): ScenePreset[] {
    return [...this.TWITCH_SCENE_PRESETS];
  }

  /**
   * Wendet ein Scene-Preset an (wechselt Szene + blendet definierte Quellen ein/aus).
   * Ideal für "Starting Soon", "Raid", "BRB" etc.
   */
  async applyScenePreset(presetName: string): Promise<{ success: boolean; message: string }> {
    const preset = this.TWITCH_SCENE_PRESETS.find((p) => p.name === presetName || p.sceneName === presetName);
    if (!preset) {
      return { success: false, message: `Scene Preset "${presetName}" nicht gefunden` };
    }

    if (this.mock) {
      return { success: true, message: `[Mock] Scene Preset "${preset.name}" angewendet` };
    }

    if (!this.obsWs) {
      return { success: false, message: 'OBS nicht verbunden' };
    }

    try {
      await this.obsWs.call('SetCurrentProgramScene', { sceneName: preset.sceneName });

      // Quellen ein-/ausblenden
      const currentScene = preset.sceneName;

      for (const src of preset.sourcesToShow || []) {
        try {
          const itemId = await this.resolveSceneItemId(currentScene, src);
          await this.obsWs.call('SetSceneItemEnabled', {
            sceneName: currentScene,
            sceneItemId: itemId,
            sceneItemEnabled: true,
          });
        } catch { /* ignore missing source */ }
      }

      for (const src of preset.sourcesToHide || []) {
        try {
          const itemId = await this.resolveSceneItemId(currentScene, src);
          await this.obsWs.call('SetSceneItemEnabled', {
            sceneName: currentScene,
            sceneItemId: itemId,
            sceneItemEnabled: false,
          });
        } catch { /* ignore */ }
      }

      return { success: true, message: `Scene Preset "${preset.name}" aktiviert` };
    } catch (e: any) {
      return { success: false, message: e.message };
    }
  }

  private async resolveSceneItemId(sceneName: string, sourceName: string): Promise<number> {
    const items = await this.obsWs.call('GetSceneItemList', { sceneName });
    const item = (items.sceneItems || []).find((i: any) => i.sourceName === sourceName || i.inputKind === sourceName);
    if (!item) throw new Error(`Quelle "${sourceName}" in Szene "${sceneName}" nicht gefunden`);
    return item.sceneItemId;
  }

  /**
   * Auto-Erkennung: Versucht die beste Intel-Empfehlung basierend auf aktuellen OBS-Daten zu finden.
   */
  async autoSelectBestProfileForIntel(): Promise<EncoderProfile> {
    try {
      const current = await this.getCurrentOutputSettings();
      const hardware = (current.detectedHardware || []).join(' ').toLowerCase();

      if (hardware.includes('quick sync') || hardware.includes('qsv')) {
        return this.TWITCH_PROFILES.find((p) => p.id === 'intel_qsv_1080p60') || this.TWITCH_PROFILES[0];
      }
      // Standard für reine CPU: x264 veryfast
      return this.TWITCH_PROFILES.find((p) => p.id === 'intel_x264_1080p60') || this.TWITCH_PROFILES[0];
    } catch {
      return this.TWITCH_PROFILES[0];
    }
  }

  /**
   * Gibt Diagnose-Informationen + Warnungen speziell für Intel / QSV zurück.
   * Wird im UI und in Logs genutzt.
   */
  async getIntelDiagnostics(): Promise<{
    detected: string[];
    warnings: string[];
    recommendations: string[];
    currentEncoder: string | null;
  }> {
    const current = await this.getCurrentOutputSettings().catch(() => ({ detectedHardware: [], encoder: null } as any));

    const detected = current.detectedHardware || [];
    const warnings: string[] = [];
    const recommendations: string[] = [];

    const lower = detected.join(' ').toLowerCase();

    if (lower.includes('quick sync') || lower.includes('qsv')) {
      recommendations.push('Intel QSV erkannt – sehr effizient auf modernen Intel CPUs.');
      recommendations.push('Auf Ubuntu: Stelle sicher dass intel-media-driver, libvpl2 und vainfo funktionieren.');
      warnings.push('Falls "No VA display found" oder Encoder nicht verfügbar: iGPU-Passthrough prüfen und /dev/dri render nodes mounten.');
    } else if (lower.includes('x264') || !lower.includes('nvenc')) {
      recommendations.push('Reine x264 CPU-Encoding erkannt. Für 1080p60 sehrfast oder faster Preset empfohlen.');
      recommendations.push('Stelle sicher, dass der Server nicht zu viele andere Last hat (Encoding ist CPU-intensiv).');
    }

    if (!current.encoder || current.encoder === 'unknown') {
      warnings.push('Konnte aktuellen Encoder nicht eindeutig erkennen. OBS Advanced Output Mode empfohlen.');
    }

    return {
      detected,
      warnings,
      recommendations,
      currentEncoder: current.encoder,
    };
  }
}
