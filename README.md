# Stream Control Center v2.0

Production-grade Full-Stack-Dashboard zur Überwachung und Steuerung eines Ubuntu-Streaming-Servers mit OBS Studio und NOALBS.

---

# Features

## Security

- JWT Access & Refresh Tokens
- Role Based Access Control (Admin / Operator / Viewer)
- TOTP 2FA
- CSRF Protection
- Helmet Security Headers
- Rate Limiting

## Monitoring

- CPU, RAM und Disk Monitoring
- Netzwerk-Latenz und Verfügbarkeit
- OBS Studio Status
- NOALBS Status
- Docker Health Monitoring

## Alerting

- Discord Webhooks
- E-Mail Benachrichtigungen
- Browser Notifications

## Observability

- Structured Logging (Pino)
- Audit Logging
- Prometheus Metrics
- OpenAPI Dokumentation

---

# Voraussetzungen

## Docker Installation

Installierte Software:

- Docker Desktop 4.x oder neuer
- Docker Compose v2
- Git

Prüfen:

```bash
docker --version
docker compose version

```

---

# Installation mit Docker

## Repository klonen

```bash
git clone https://github.com/USERNAME/stream-control-center.git
cd stream-control-center

```

## Umgebungsvariablen erstellen

```bash
cp .env.example .env

```

Öffne anschließend die `.env` Datei.

Mindestens folgende Werte müssen gesetzt werden:

```env
JWT_SECRET=replace-with-long-random-secret
CSRF_SECRET=replace-with-another-long-random-secret

DEFAULT_ADMIN_PASSWORD=ChangeMe123!

OBS_WEBSOCKET_HOST=host.docker.internal
OBS_WEBSOCKET_PORT=4455
OBS_WEBSOCKET_PASSWORD=

```

Empfohlen werden mindestens 32 zufällige Zeichen für alle Secrets.

---

# Anwendung starten

## Produktion

```bash
docker compose up -d --build

```

Status prüfen:

```bash
docker ps

```

Logs anzeigen:

```bash
docker compose logs -f

```

---

# Zugriff auf das Dashboard

Nach erfolgreichem Start:

Dashboard:

```text
http://localhost:3001

```

API Dokumentation:

```text
http://localhost:3001/api/v1/docs

```

Health Check:

```text
http://localhost:3001/api/health

```

---

# Erstes Login

Benutzername:

```text
admin

```

Passwort:

```text
Wert aus changeme-on-first-login

```

Nach dem ersten Login sollte das Passwort geändert werden.

---

# OBS Studio Integration

## OBS WebSocket aktivieren

In OBS:

Werkzeuge → WebSocket Server-Einstellungen

Aktivieren:

- WebSocket Server aktivieren
- Port 4455 verwenden
- Optional Passwort setzen

Beispiel:

```env
OBS_WEBSOCKET_HOST=host.docker.internal
OBS_WEBSOCKET_PORT=4455
OBS_WEBSOCKET_PASSWORD=MeinPasswort

```

Container neu starten:

```bash
docker compose restart

```

# Twitch Integration (primäre Plattform)

Vollständige Unterstützung für Twitch 2026:

- EventSub WebSocket (Raid, Channel Update, Stream Online/Offline, Hype Train, Predictions, Follow, Sub, Bits etc.)
- Automatisches Szenen-Switching bei Raid (inkl. dynamischem Text in "Raid-Text" Source)
- Titel & Kategorie direkt aus dem Dashboard aktualisieren (Helix)
- **Intel CPU Encoder-Erkennung** + vordefinierte Twitch-optimierte Profile (x264 veryfast/faster + Intel QSV/oneVPL)
- "Apply Twitch Profile" Buttons → setzt automatisch CBR + Keyframe 2s + empfohlene Presets
- Professionelle Scene Presets (Starting Soon, Raid, BRB, Just Chatting, Gameplay, Ending Screen)
- Manuelle Raid-Trigger + Credential-Setup für schnellen Einstieg

## Einrichtung Twitch

1. Gehe zu https://dev.twitch.tv/console/apps → App erstellen (oder bestehende nutzen)
2. OAuth Token mit benötigten Scopes generieren (z.B. über https://twitchapps.com/tmi/ oder eigenen Flow):
   - `channel:manage:broadcast`
   - `channel:read:raids`
   - `channel:read:subscriptions`
   - `moderator:read:followers` (optional)
3. Im Dashboard → Twitch Seite → Token einfügen oder per Env:

```env
TWITCH_CLIENT_ID=deine_client_id
TWITCH_ACCESS_TOKEN=dein_user_access_token
TWITCH_BROADCASTER_USER_ID=deine_user_id
```

4. "Auto-Detect + Bestes Intel-Profil" nutzen oder manuell ein Profil aus der Liste anwenden.

**Wichtig für Intel Quick Sync auf Ubuntu:**
- `intel-media-driver` + `libvpl2` / oneVPL installieren
- OBS mit Hardware-Encoding Support kompilieren oder Flatpak/AppImage mit gutem Support nutzen

# Encoder & Output Einstellungen

Das Tool erkennt automatisch (über OBS) welcher Encoder läuft und bietet **Twitch-2026-Empfehlungen** für Intel CPUs an.

Empfohlen (Stand 2026 für die meisten Twitch-Streamer auf Intel):
- 1080p60 oder 900p60
- CBR
- Bitrate 5500–8000 kbps (je nach Qualität & Partner-Status)
- Keyframe Interval exakt **2 Sekunden**
- x264 "veryfast" oder QSV "quality"

Nutze die Schaltflächen im Twitch-Tab des Dashboards.

---

# Entwicklung

Development Mode starten:

```bash
docker compose --profile development up

```

Frontend:

```text
http://localhost:5173

```

Backend:

```text
http://localhost:3001

```

---

# Troubleshooting

## Container startet nicht

Logs prüfen:

```bash
docker compose logs -f

```

Fehlende Secrets:

```env
JWT_SECRET=
CSRF_SECRET=

```

führen zum sofortigen Abbruch des Backends.

---

## Dashboard nicht erreichbar

Prüfen:

```bash
docker ps

```

Der Container muss den Status

```text
healthy

```

anzeigen.

---

## OBS wird nicht erkannt

Prüfen:

- OBS läuft
- WebSocket aktiviert
- Richtiger Port
- Richtiges Passwort
- OBS_WEBSOCKET_HOST korrekt gesetzt

Bei Docker Desktop wird meistens benötigt:

```env
OBS_WEBSOCKET_HOST=host.docker.internal

```

---

# API

Alle Endpunkte befinden sich unter:

```text
/api/v1

```

Authentifizierung:

```http
Authorization: Bearer <token>

```

Vollständige API Dokumentation:

```text
/api/v1/docs

```

---

# Lizenz

MIT

