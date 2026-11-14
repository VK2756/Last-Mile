#!/usr/bin/env bash
set -euo pipefail
REPO_DIR="${REPO_DIR:-/opt/lastmile}"
API_HOST="${API_HOST:?Set API_HOST to the configured Caddy hostname}"
cd "$REPO_DIR"
git checkout main
git pull --ff-only origin main
pnpm install --frozen-lockfile
pnpm verify
sudo systemctl restart lastmile-engine
for attempt in {1..15}; do
  if curl --fail --silent --show-error http://127.0.0.1:8080/health; then break; fi
  sleep 2
done
curl --fail --silent --show-error "https://$API_HOST/health"
echo
echo 'Engine deployment healthy.'
