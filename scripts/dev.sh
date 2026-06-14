#!/usr/bin/env bash
# Entwicklungsstart – Backend + Frontend parallel
set -euo pipefail

ROOT="$(cd "$(dirname "$0")/.." && pwd)"

if [[ ! -d "$ROOT/backend/node_modules" ]] || [[ ! -d "$ROOT/frontend/node_modules" ]]; then
  echo "Installiere Abhängigkeiten…"
  npm run install:all --prefix "$ROOT"
fi

if [[ ! -f "$ROOT/.env" ]]; then
  cp "$ROOT/.env.example" "$ROOT/.env"
  echo ".env erstellt – bitte bei Bedarf anpassen."
fi

trap 'kill 0' EXIT

npm run dev:backend --prefix "$ROOT" &
npm run dev:frontend --prefix "$ROOT" &

wait
