#!/usr/bin/env bash
set -euo pipefail

# Stream Control Center – Installationsskript für Ubuntu 24.04
# Ausführen als normaler User mit sudo-Rechten:
#   chmod +x scripts/install-ubuntu.sh
#   ./scripts/install-ubuntu.sh

INSTALL_DIR="/opt/stream-control-center"
SERVICE_USER="${SCC_USER:-stream}"
NODE_MIN_VERSION=20

echo "=== Stream Control Center Installer ==="

if [[ "$(id -u)" -eq 0 ]]; then
  echo "Bitte nicht als root ausführen. Das Skript verwendet sudo bei Bedarf."
  exit 1
fi

if ! grep -q "Ubuntu 24.04" /etc/os-release 2>/dev/null; then
  echo "Warnung: Dieses Skript ist für Ubuntu 24.04 optimiert."
fi

echo "[1/8] Systempakete installieren…"
sudo apt-get update
sudo apt-get install -y curl ca-certificates gnupg iputils-ping

if ! command -v node &>/dev/null || [[ "$(node -v | cut -d. -f1 | tr -d v)" -lt "$NODE_MIN_VERSION" ]]; then
  echo "[2/8] Node.js 22 installieren…"
  curl -fsSL https://deb.nodesource.com/setup_22.x | sudo -E bash -
  sudo apt-get install -y nodejs
else
  echo "[2/8] Node.js bereits installiert: $(node -v)"
fi

echo "[3/8] Service-User erstellen…"
if ! id "$SERVICE_USER" &>/dev/null; then
  sudo useradd -m -s /bin/bash "$SERVICE_USER"
  echo "User '$SERVICE_USER' erstellt."
fi

echo "[4/8] Anwendung nach $INSTALL_DIR kopieren…"
sudo mkdir -p "$INSTALL_DIR"
sudo rsync -a --exclude node_modules --exclude dist --exclude .git ./ "$INSTALL_DIR/"
sudo chown -R "$SERVICE_USER:$SERVICE_USER" "$INSTALL_DIR"

echo "[5/8] Abhängigkeiten installieren und bauen…"
cd "$INSTALL_DIR"
sudo -u "$SERVICE_USER" npm run install:all
sudo -u "$SERVICE_USER" npm run build

if [[ ! -f "$INSTALL_DIR/.env" ]]; then
  echo "[6/8] .env aus Vorlage erstellen…"
  sudo -u "$SERVICE_USER" cp "$INSTALL_DIR/.env.example" "$INSTALL_DIR/.env"
  echo "Bitte $INSTALL_DIR/.env anpassen!"
else
  echo "[6/8] .env existiert bereits."
fi

echo "[7/8] Log-Verzeichnisse erstellen…"
sudo mkdir -p /var/log/obs /var/log/noalbs
sudo chown "$SERVICE_USER:$SERVICE_USER" /var/log/obs /var/log/noalbs

echo "[8/8] systemd-Dienst einrichten…"
sudo cp "$INSTALL_DIR/deploy/stream-control-center.service" /etc/systemd/system/
sudo sed -i "s/User=stream/User=$SERVICE_USER/g" /etc/systemd/system/stream-control-center.service
sudo sed -i "s/Group=stream/Group=$SERVICE_USER/g" /etc/systemd/system/stream-control-center.service
sudo systemctl daemon-reload
sudo systemctl enable stream-control-center

echo ""
echo "=== Installation abgeschlossen ==="
echo ""
echo "Nächste Schritte:"
echo "  1. $INSTALL_DIR/.env konfigurieren"
echo "  2. sudo cp deploy/sudoers.stream-control.example /etc/sudoers.d/stream-control-center"
echo "  3. sudo visudo -c -f /etc/sudoers.d/stream-control-center"
echo "  4. OBS/NOALBS systemd-Units einrichten (deploy/*.example)"
echo "  5. sudo systemctl start stream-control-center"
echo ""
echo "Dashboard: http://$(hostname -I | awk '{print $1}'):3001"
