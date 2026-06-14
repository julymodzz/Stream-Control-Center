# Security Report – Stream Control Center v2.0

## Zusammenfassung

Das Projekt wurde von einem offenen Dashboard zu einer authentifizierten, rollenbasierten Produktionsarchitektur refaktoriert.

## Durchgeführte Sicherheitsmaßnahmen

### Container-Härtung

| Maßnahme | v1.0 | v2.0 |
|----------|------|------|
| `privileged: true` | Ja | **Nein** |
| Non-root User | Nein | **Ja (UID 1001)** |
| Read-only FS | Nein | **Ja** |
| Capability Drop | Nein | **ALL dropped, NET_RAW + NET_BIND_SERVICE** |
| `no-new-privileges` | Nein | **Ja** |
| Resource Limits | Nein | **CPU/RAM Limits** |

### Authentifizierung & Autorisierung

- **JWT Access Tokens** (15 Min. Standard)
- **Refresh Tokens** in httpOnly Cookies (7 Tage)
- **Optionale TOTP-2FA** (otplib)
- **RBAC**: Admin, Operator, Viewer
- **Brute-Force-Schutz**: Rate Limiting + Account-Lockout nach 5 Fehlversuchen
- Alle `/api/v1/*` Routen (außer Auth/CSRF/Health) geschützt

### API-Sicherheit

- **Helmet** Security Headers
- **CSRF-Schutz** (double-submit cookie) für state-changing Requests
- **Rate Limiting** (global + Auth-endpoints)
- **Zod-Validierung** aller Eingaben
- **Input-Sanitization** (HTML-Escape, Längenlimits)
- Konsistente Fehlerantworten ohne Stack-Traces

### Command Injection Prevention

- **Keine Shell-Interpretation** (`shell: false`)
- Nur vordefinierte Befehle: `systemctl`, `ping`, `sudo systemctl`, `sudo shutdown`
- **Service-Allowlist** aus Umgebungsvariablen
- Regex-Validierung für Dienstnamen und Ping-Hosts
- **Keine benutzerdefinierten Shell-Befehle**

### Secrets Management

- Secrets nur in Umgebungsvariablen
- `.env` in `.gitignore`
- Produktions-Validierung für `JWT_SECRET` und `CSRF_SECRET`
- Warnung bei Standard-Admin-Passwort

### Audit Logging

Alle administrativen Aktionen werden protokolliert:
- Benutzer, Timestamp, Source-IP
- Aktion, Ressource, Erfolg/Fehler
- Durchsuchbare Audit-Log-Seite im Dashboard

### Observability

- Strukturiertes Logging (Pino)
- Prometheus Metrics unter `/api/v1/metrics`
- Request-ID Header (`X-Request-Id`)

## Verbleibende Risiken & Empfehlungen

1. **Host-Netzwerk-Modus**: Für OBS WebSocket auf localhost weiterhin `network_mode: host` empfohlen. Alternativ: OBS WebSocket über TLS und separaten Netzwerk-Namespace.

2. **systemd-Steuerung**: Erfordert sudoers-Konfiguration auf dem Host. Minimale Rechte nur für erlaubte Dienste vergeben.

3. **JSON-Dateispeicher**: Für Multi-Node-Deployments PostgreSQL/SQLite empfohlen.

4. **TLS-Terminierung**: Reverse Proxy (nginx/Caddy) mit HTTPS vor dem Dashboard einsetzen.

5. **SMTP/Discord**: Webhook-URLs und SMTP-Credentials nur über Umgebungsvariablen, nie im Code.

## Berechtigungsmatrix

| Aktion | Admin | Operator | Viewer |
|--------|-------|----------|--------|
| Dashboard lesen | ✓ | ✓ | ✓ |
| Steuerung ausführen | ✓ | ✓ | ✗ |
| OBS-Steuerung | ✓ | ✓ | ✗ |
| Audit-Logs | ✓ | ✗ | ✗ |
| Backup verwalten | ✓ | ✗ | ✗ |
| Benutzer verwalten | ✓ | ✗ | ✗ |
