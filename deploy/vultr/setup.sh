#!/usr/bin/env bash
# Ubuntu 24.04. Run as root after cloning the repository to /opt/lastmile.
set -euo pipefail
if [[ "$(id -u)" -ne 0 ]]; then echo 'Run with sudo'; exit 1; fi
REPO_DIR="${REPO_DIR:-/opt/lastmile}"
API_HOST="${API_HOST:?Set API_HOST to api.example.tech or <IP>.sslip.io}"
ENGINE_USER="${ENGINE_USER:-lastmile}"
apt-get update
apt-get install -y ca-certificates curl gnupg git ufw
if ! command -v node >/dev/null || [[ "$(node --version)" != v22.* ]]; then
  curl -fsSL https://deb.nodesource.com/setup_22.x | bash -
  apt-get install -y nodejs
fi
corepack enable
corepack prepare pnpm@9.15.0 --activate
if ! command -v caddy >/dev/null; then
  apt-get install -y debian-keyring debian-archive-keyring apt-transport-https
  curl -1sLf https://dl.cloudsmith.io/public/caddy/stable/gpg.key | gpg --batch --yes --dearmor -o /usr/share/keyrings/caddy-stable-archive-keyring.gpg
  curl -1sLf https://dl.cloudsmith.io/public/caddy/stable/debian.deb.txt > /etc/apt/sources.list.d/caddy-stable.list
  apt-get update
  apt-get install -y caddy
fi
id -u "$ENGINE_USER" >/dev/null 2>&1 || useradd --system --create-home --shell /usr/sbin/nologin "$ENGINE_USER"
install -d -o "$ENGINE_USER" -g "$ENGINE_USER" "$REPO_DIR"
install -d -o root -g "$ENGINE_USER" -m 0750 /etc/lastmile
cat > /etc/systemd/system/lastmile-engine.service <<UNIT
[Unit]
Description=Last Mile simulation engine
After=network-online.target
Wants=network-online.target

[Service]
Type=simple
User=$ENGINE_USER
Group=$ENGINE_USER
WorkingDirectory=$REPO_DIR
EnvironmentFile=-/etc/lastmile/engine.env
Environment=PORT=8080
ExecStart=/usr/bin/env pnpm --filter @lastmile/engine start
Restart=always
RestartSec=3
NoNewPrivileges=true

[Install]
WantedBy=multi-user.target
UNIT
cat > /etc/caddy/Caddyfile <<CADDY
$API_HOST {
  reverse_proxy 127.0.0.1:8080
}
CADDY
systemctl daemon-reload
systemctl enable lastmile-engine caddy
caddy validate --config /etc/caddy/Caddyfile
systemctl reload caddy || systemctl restart caddy
ufw allow 22/tcp
ufw allow 80/tcp
ufw allow 443/tcp
ufw --force enable
echo "Setup complete. Add /etc/lastmile/engine.env with restricted permissions, then run deploy.sh."
