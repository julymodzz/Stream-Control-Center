import { useEffect, useState } from 'react';
import { Twitch } from 'lucide-react';
import {
  fetchTwitchStatus,
  updateTwitchStreamInfo,
  triggerManualRaid,
  fetchEncoderProfiles,
  fetchCurrentOutputSettings,
  fetchIntelDiagnostics,
  applyTwitchEncoderProfile,
  applyProfileAndRestartStream,
  fetchTwitchScenePresets,
  applyTwitchScenePreset,
  setTwitchCredentials,
  getTwitchAuthUrl,
  twitchDisconnect,
  fetchTwitchMappings,
  saveTwitchMappings,
  triggerGoLive,
} from '../api/client';
import { useAuthStore } from '../store/useAuthStore';
import { Button } from '../components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '../components/ui/card';
import { Input } from '../components/ui/input';
import { Badge } from '../components/ui/badge';
import { EncoderProfile, ScenePreset, TwitchStatus } from '../types';

export function TwitchPage() {
  const canControl = useAuthStore((s) => s.hasPermission('obs.control'));
  const [twitchStatus, setTwitchStatus] = useState<TwitchStatus | null>(null);
  const [encoderProfiles, setEncoderProfiles] = useState<EncoderProfile[]>([]);
  const [currentOutput, setCurrentOutput] = useState<any>(null);
  const [intelDiag, setIntelDiag] = useState<any>(null);
  const [scenePresets, setScenePresets] = useState<ScenePreset[]>([]);
  const [message, setMessage] = useState('');
  const [mappings, setMappings] = useState<{ sourceMappings: any; sceneNameOverrides: any } | null>(null);

  // Form States
  const [newTitle, setNewTitle] = useState('');
  const [newCategory, setNewCategory] = useState('');
  const [raiderName, setRaiderName] = useState('');
  const [accessTokenInput, setAccessTokenInput] = useState('');
  const [connecting, setConnecting] = useState(false);

  const loadAll = async () => {
    try {
      const [status, profiles, output, presets, diag, maps] = await Promise.all([
        fetchTwitchStatus(),
        fetchEncoderProfiles(),
        fetchCurrentOutputSettings(),
        fetchTwitchScenePresets(),
        fetchIntelDiagnostics().catch(() => null),
        fetchTwitchMappings().catch(() => null),
      ]);
      setTwitchStatus(status);
      setEncoderProfiles(profiles);
      setCurrentOutput(output);
      setScenePresets(presets);
      if (diag) setIntelDiag(diag);
      if (maps) setMappings(maps);
    } catch (e) {
      setMessage('Fehler beim Laden der Twitch-Daten');
    }
  };

  useEffect(() => {
    loadAll();
    const interval = setInterval(loadAll, 15000);
    return () => clearInterval(interval);
  }, []);

  const handleUpdateStream = async () => {
    if (!newTitle && !newCategory) return;
    const res = await updateTwitchStreamInfo({ title: newTitle || undefined, categoryIdOrName: newCategory || undefined });
    setMessage(res.message || 'Stream-Info aktualisiert');
    setNewTitle('');
    setNewCategory('');
    await loadAll();
  };

  const handleRaid = async () => {
    if (!raiderName) return;
    await triggerManualRaid(raiderName, 75);
    setMessage(`Raid von ${raiderName} simuliert / getriggert`);
    setRaiderName('');
    await loadAll();
  };

  const handleApplyProfile = async (profileId: string) => {
    const res = await applyTwitchEncoderProfile(profileId);
    setMessage(res.message || 'Encoder-Profil angewendet');
    await loadAll();
  };

  const handleApplyScenePreset = async (presetName: string) => {
    const res = await applyTwitchScenePreset(presetName);
    setMessage(res.message || 'Scene Preset aktiviert');
    await loadAll();
  };

  const handleSetCredentials = async () => {
    if (!accessTokenInput) return;
    await setTwitchCredentials({ accessToken: accessTokenInput.trim() });
    setMessage('Twitch Credentials gespeichert – EventSub wird verbunden');
    setAccessTokenInput('');
    await loadAll();
  };

  const autoSelectBest = async () => {
    // Der Service hat eine autoSelectBestProfileForIntel – hier rufen wir die Profile und wählen das erste Intel-spezifische
    const intel = encoderProfiles.find((p) => p.label.toLowerCase().includes('intel') || p.encoder === 'qsv' || p.encoder === 'x264');
    if (intel) {
      await handleApplyProfile(intel.id);
    } else if (encoderProfiles[0]) {
      await handleApplyProfile(encoderProfiles[0].id);
    }
  };

  const handleConnectTwitch = async () => {
    setConnecting(true);
    setMessage('');
    try {
      const { url } = await getTwitchAuthUrl();
      // Öffne Twitch OAuth in neuem Fenster
      const popup = window.open(url, 'twitch_oauth', 'width=600,height=700');

      // Poll bis das Fenster geschlossen wird oder Status sich ändert
      const checkInterval = setInterval(async () => {
        if (popup?.closed) {
          clearInterval(checkInterval);
          setConnecting(false);
          await loadAll();
          setMessage('Twitch Verbindung abgeschlossen – Status aktualisiert.');
        }
      }, 800);
    } catch (e: any) {
      setMessage('Fehler beim Starten des Twitch Logins: ' + (e.message || e));
      setConnecting(false);
    }
  };

  const handleDisconnect = async () => {
    if (!confirm('Twitch Verbindung wirklich trennen? Tokens werden gelöscht.')) return;
    await twitchDisconnect();
    setMessage('Twitch getrennt.');
    await loadAll();
  };

  const handleApplyAndRestart = async (profileId: string) => {
    if (!confirm('Encoder-Profil anwenden UND Stream neu starten? Der Stream wird kurz unterbrochen.')) {
      return;
    }
    const res = await applyProfileAndRestartStream(profileId);
    setMessage(res.message || res.data?.message || 'Profil angewendet + Stream neu gestartet');
    await loadAll();
  };

  // Functional mappings editor (streamer can define their own OBS source/scene names - major ease + USP feature)
  const [editingMappings, setEditingMappings] = useState('');
  const handleSaveMappings = async () => {
    try {
      const parsed = JSON.parse(editingMappings || '{}');
      await saveTwitchMappings(parsed);
      setMessage('Mappings gespeichert. Alle Automatisierungen (Raid, Prediction etc.) nutzen jetzt deine Namen.');
      await loadAll();
    } catch (e) {
      setMessage('Ungültiges JSON für Mappings. Beispiel: {"sourceMappings":{"raidOverlay":"MeinRaidOverlay"}}');
    }
  };

  const handleGoLive = async () => {
    if (!confirm('Go Live ausführen? Encoder (optional), Twitch-Info, Starting Scene + Stream Start.')) return;
    const res = await triggerGoLive({
      title: newTitle || undefined,
      categoryIdOrName: newCategory || undefined,
    });
    setMessage('Go Live: ' + (res.data?.results?.join(' → ') || res.message || 'Erledigt'));
    await loadAll();
  };

  // Load current mappings into editor when available
  useEffect(() => {
    if (mappings && !editingMappings) {
      setEditingMappings(JSON.stringify(mappings, null, 2));
    }
  }, [mappings]);

  return (
    <div className="space-y-6 p-4 md:p-6">
      <h1 className="flex items-center gap-3 text-3xl font-bold">
        <Twitch className="h-8 w-8 text-[#9146FF]" />
        Twitch Integration
        <Badge variant="outline" className="ml-2">Primärplattform</Badge>
      </h1>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        {/* Live Status */}
        <Card>
          <CardHeader><CardTitle>Twitch Live Status</CardTitle></CardHeader>
          <CardContent className="space-y-3">
            {twitchStatus ? (
              <>
                <div className="flex items-center gap-2">
                  <Badge variant={twitchStatus.isLive ? 'success' : 'destructive'}>
                    {twitchStatus.isLive ? 'LIVE' : 'OFFLINE'}
                  </Badge>
                  <span className="text-sm text-gray-400">Viewer: {twitchStatus.viewerCount ?? '–'}</span>
                </div>
                <div>
                  <span className="text-xs text-gray-500">Titel</span>
                  <p className="font-medium">{twitchStatus.title || '–'}</p>
                </div>
                <div>
                  <span className="text-xs text-gray-500">Kategorie</span>
                  <p>{twitchStatus.categoryName || '–'}</p>
                </div>
              </>
            ) : (
              <p className="text-gray-500">Lade Twitch Status...</p>
            )}
            <Button onClick={loadAll} size="sm" variant="outline">Aktualisieren</Button>
          </CardContent>
        </Card>

        {/* Stream Info Update */}
        {canControl && (
          <Card>
            <CardHeader><CardTitle>Stream Titel &amp; Kategorie ändern</CardTitle></CardHeader>
            <CardContent className="space-y-4">
              <div>
                <label className="text-xs text-gray-400">Neuer Titel</label>
                <Input value={newTitle} onChange={(e) => setNewTitle(e.target.value)} placeholder="Neuer Stream-Titel..." />
              </div>
              <div>
                <label className="text-xs text-gray-400">Kategorie (Name oder ID)</label>
                <Input value={newCategory} onChange={(e) => setNewCategory(e.target.value)} placeholder="Just Chatting oder 509658" />
              </div>
              <Button onClick={handleUpdateStream} disabled={!newTitle && !newCategory}>
                Auf Twitch übernehmen
              </Button>
              <Button onClick={handleGoLive} variant="success" className="ml-2">
                GO LIVE (orchestriert)
              </Button>
            </CardContent>
          </Card>
        )}

        {/* Raid Tools */}
        {canControl && (
          <Card>
            <CardHeader><CardTitle>Raid Tools (Automatisierung)</CardTitle></CardHeader>
            <CardContent className="space-y-4">
              <div className="flex gap-2">
                <Input
                  value={raiderName}
                  onChange={(e) => setRaiderName(e.target.value)}
                  placeholder="Raider Name (z.B. streamerXY)"
                  className="flex-1"
                />
                <Button onClick={handleRaid} variant="destructive">Raid-Szene triggern</Button>
              </div>
              <p className="text-xs text-gray-500">
                Wechselt automatisch zur "Raid"-Szene + aktualisiert Text-Quelle (wenn vorhanden). Funktioniert auch über echte EventSub bei Raid.
              </p>
            </CardContent>
          </Card>
        )}

        {/* Encoder & Output Settings (Intel CPU) */}
        <Card className="lg:col-span-2">
          <CardHeader>
            <CardTitle className="flex justify-between items-center">
              Encoder &amp; Output – Twitch Recommended (Intel CPU)
              <Button size="sm" variant="outline" onClick={autoSelectBest}>Auto-Detect + Bestes Intel-Profil</Button>
            </CardTitle>
          </CardHeader>
          <CardContent>
            {currentOutput && (
              <div className="mb-4 text-sm bg-surface-lighter p-3 rounded">
                <strong>Aktuell erkannt:</strong> {currentOutput.encoder || 'unbekannt'} • {currentOutput.bitrate || '?'} kbps • Preset: {currentOutput.preset || '–'} • Keyframe: {currentOutput.keyintSec ?? '2'}s
              </div>
            )}

            <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-3">
              {encoderProfiles.map((profile) => (
                <div key={profile.id} className="border border-gray-700 rounded p-3 text-sm hover:border-accent-blue transition">
                  <div className="font-semibold mb-1">{profile.label}</div>
                  <div className="text-xs text-gray-400 mb-2">{profile.notes}</div>
                  <div className="text-xs mb-3">
                    {profile.encoder} • {profile.bitrate} kbps • {profile.resolution}@{profile.fps} • {profile.preset}
                  </div>
                  {canControl && (
                    <>
                      <Button size="sm" onClick={() => handleApplyProfile(profile.id)} className="mr-2">
                        Profil anwenden
                      </Button>
                      <Button size="sm" variant="warning" onClick={() => handleApplyAndRestart(profile.id)}>
                        + Stream neu starten
                      </Button>
                    </>
                  )}
                </div>
              ))}
            </div>
            <p className="text-xs text-gray-500 mt-3">
              Empfehlung für Intel CPU (2026): x264 "veryfast" oder Intel QSV "quality". Immer CBR + Keyframe-Intervall 2 Sekunden für Twitch.
            </p>
          </CardContent>
        </Card>

        {/* Scene Presets */}
        <Card className="lg:col-span-2">
          <CardHeader><CardTitle>Twitch Scene Presets (professionell)</CardTitle></CardHeader>
          <CardContent>
            <div className="flex flex-wrap gap-2">
              {scenePresets.map((preset) => (
                <Button
                  key={preset.name}
                  variant="outline"
                  size="sm"
                  onClick={() => handleApplyScenePreset(preset.name)}
                  disabled={!canControl}
                >
                  {preset.name}
                </Button>
              ))}
            </div>
            <p className="text-xs text-gray-500 mt-2">
              Wechselt die Szene und blendet passende Quellen ein/aus (Raid Overlay, BRB Musik, etc.). Perfekt für konsistente Produktion.
            </p>
          </CardContent>
        </Card>

        {/* OAuth + Connection Management (empfohlen) */}
        {canControl && (
          <Card>
            <CardHeader><CardTitle>Twitch Verbindung (empfohlener Weg)</CardTitle></CardHeader>
            <CardContent className="space-y-4">
              <div className="flex flex-wrap gap-3">
                <Button
                  onClick={handleConnectTwitch}
                  disabled={connecting}
                  className="bg-[#9146FF] hover:bg-[#772ce8] text-white"
                >
                  {connecting ? 'Warte auf Twitch...' : 'Mit Twitch verbinden (OAuth)'}
                </Button>

                <Button onClick={handleDisconnect} variant="destructive" size="sm">
                  Verbindung trennen
                </Button>
              </div>

              <div className="text-xs text-gray-400">
                Öffnet das offizielle Twitch-Login. Nach erfolgreicher Authorisierung wird das Popup geschlossen und der Status aktualisiert.
                <br />Benötigte Scopes werden automatisch angefordert.
              </div>

              {/* Manueller Fallback */}
              <details className="text-sm">
                <summary className="cursor-pointer text-gray-400">Manuellen Token einfügen (Fallback)</summary>
                <div className="mt-2 space-y-2">
                  <Input
                    type="password"
                    value={accessTokenInput}
                    onChange={(e) => setAccessTokenInput(e.target.value)}
                    placeholder="Access Token (mit refresh möglich)"
                  />
                  <Button size="sm" onClick={handleSetCredentials}>Token manuell speichern</Button>
                </div>
              </details>
            </CardContent>
          </Card>
        )}

        {/* Configurable Mappings Editor - Functional: Streamer controls exact OBS names used by all automations */}
        {canControl && mappings && (
          <Card className="lg:col-span-2">
            <CardHeader><CardTitle>OBS Source &amp; Scene Mappings (konfigurierbar)</CardTitle></CardHeader>
            <CardContent className="space-y-3">
              <p className="text-xs text-gray-400">Passe die Namen an deine OBS-Szenen und Quellen an. Raid, Prediction etc. werden dann automatisch die richtigen verwenden.</p>
              <textarea
                className="w-full h-40 font-mono text-xs bg-surface-lighter p-2 rounded border border-gray-700"
                value={editingMappings}
                onChange={(e) => setEditingMappings(e.target.value)}
              />
              <Button onClick={handleSaveMappings}>Mappings speichern</Button>
              <p className="text-xs">Beispiel: {'{"sourceMappings":{"raidOverlay":"DeinRaidOverlayName","raidText":"DeinRaidTextQuelle"}}'}</p>
            </CardContent>
          </Card>
        )}

        {/* Intel / QSV Diagnostics */}
        <Card>
          <CardHeader><CardTitle>Intel CPU &amp; Encoder Diagnostics</CardTitle></CardHeader>
          <CardContent className="space-y-2 text-sm">
            {intelDiag || currentOutput ? (
              <>
                <div><strong>Erkannter Encoder:</strong> {intelDiag?.currentEncoder || currentOutput?.encoder || 'unbekannt'}</div>
                <div><strong>Hardware:</strong> {(intelDiag?.detected || currentOutput?.detectedHardware || []).join(', ')}</div>

                {intelDiag?.warnings?.length > 0 && (
                  <div className="text-amber-400 text-xs">
                    Warnungen: {intelDiag.warnings.join(' | ')}
                  </div>
                )}
                {intelDiag?.recommendations?.length > 0 && (
                  <ul className="text-xs text-gray-300 list-disc pl-4">
                    {intelDiag.recommendations.map((r: string, i: number) => <li key={i}>{r}</li>)}
                  </ul>
                )}
              </>
            ) : (
              <p className="text-gray-500">Lade Diagnostics...</p>
            )}
            <div className="text-[10px] text-gray-500 mt-1">
              Ubuntu-Tipp: <code>sudo apt install intel-media-driver vainfo</code> + oneVPL. iGPU im Docker/VM durchreichen.
            </div>
          </CardContent>
        </Card>
      </div>

      {message && <div className="text-sm p-3 bg-accent-blue/10 rounded border border-accent-blue/30">{message}</div>}
    </div>
  );
}
