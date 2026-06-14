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

