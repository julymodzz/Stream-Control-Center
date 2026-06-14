# Migrationsleitfaden: v1.0 → v2.0

## Übersicht

Version 2.0 führt eine Security-First-Architektur ein. **Alle API-Endpunkte (außer `/api/health` und Auth) erfordern jetzt JWT-Authentifizierung.**

## Breaking Changes

### API-Pfade

| v1.0 | v2.0 |
|------|------|
| `GET /api/dashboard` | `GET /api/v1/dashboard` |
| `POST /api/control/:action` | `POST /api/v1/control/:action` |
| `GET /api/logs/:source` | `GET /api/v1/logs/:source` |
| `GET /api/notifications` | `GET /api/v1/notifications` |

### WebSocket

- Authentifizierung über `auth: { token: '<JWT>' }` beim Verbindungsaufbau erforderlich
- Ohne gültigen Access-Token wird die Verbindung abgelehnt

### Docker

- `privileged: true` **entfernt**
- Container läuft als User `scc` (UID 1001)
- Read-only Root-Filesystem mit tmpfs
- Capabilities auf `NET_RAW` und `NET_BIND_SERVICE` reduziert

## Migrationsschritte

### 1. Umgebungsvariablen

```bash
cp .env.example .env
```

**Pflicht in Produktion:**
- `JWT_SECRET` (min. 32 Zeichen)
- `CSRF_SECRET` (min. 32 Zeichen)
- `DEFAULT_ADMIN_PASSWORD` ändern

### 2. Abhängigkeiten installieren

```bash
npm run install:all
```

### 3. Build

```bash
npm run build
```

### 4. Erstanmeldung

Standard-Admin (bei Erststart):
- Benutzer: `admin` (konfigurierbar via `DEFAULT_ADMIN_USERNAME`)
- Passwort: Wert aus `DEFAULT_ADMIN_PASSWORD`

**Passwort sofort nach erster Anmeldung ändern!**

### 5. systemd / sudoers

Für Dienststeuerung ohne privileged Container:

```bash
sudo cp deploy/sudoers.stream-control.example /etc/sudoers.d/stream-control
sudo visudo -c
```

Der Container-Benutzer benötigt eingeschränkte `systemctl`-Rechte für OBS und NOALBS.

### 6. Docker (Produktion)

```bash
docker compose --profile production build
docker compose --profile production up -d
```

### 7. Docker (Entwicklung)

```bash
docker compose --profile development up
```

## Datenmigration

Benutzer- und Audit-Daten werden automatisch in `./data/` (bzw. `/app/data` im Container) angelegt. Keine manuelle Migration von v1 erforderlich.

## Rollback

Bei Problemen auf v1.0 zurück:

```bash
git checkout v1.0.0
npm run build
```

Beachten: v1-API-Endpunkte sind in v2 nicht mehr verfügbar.
