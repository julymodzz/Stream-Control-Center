# Enterprise IAM – Stream Control Center

## Rollen

| Rolle | Slug | Beschreibung |
|-------|------|--------------|
| Super Admin | `super_admin` | Vollzugriff inkl. Audit-Löschung, API-Tokens, Rollen |
| Admin | `admin` | Benutzerverwaltung, Steuerung, Alerts (kein Super-Admin-Management) |
| Operator | `operator` | Monitoring + OBS/NOALBS-Steuerung |
| Viewer | `viewer` | Nur-Lese-Zugriff |

Custom-Rollen können über `/roles` erstellt werden.

## API-Endpunkte

| Endpunkt | Beschreibung |
|----------|--------------|
| `GET /api/v1/users` | Benutzerliste mit Suche/Filter |
| `POST /api/v1/users` | Benutzer erstellen |
| `PATCH /api/v1/users/:id` | Benutzer bearbeiten |
| `GET /api/v1/roles` | Rollen mit Benutzeranzahl |
| `GET /api/v1/profile` | Eigenes Profil |
| `GET /api/v1/security/sessions` | Aktive Sitzungen |
| `POST /api/v1/security/change-password` | Passwort ändern |

## Sicherheitsfeatures

- PBAC mit 30+ granularen Berechtigungen
- TOTP + Backup-Codes
- Passwort-Historie (5 Einträge)
- Session-Tracking mit Gerät/Browser/IP
- API-Token mit SHA-256-Hash
- Refresh-Token-Rotation
- Account-Lockout nach Fehlversuchen
- Optionale Passwort-Ablauf (`PASSWORD_EXPIRES_DAYS`)

## Datenpersistenz

- `data/users.json` – Benutzer
- `data/roles.json` – Rollen
- `data/sessions.json` – Sitzungen
- `data/api-tokens.json` – API-Tokens
