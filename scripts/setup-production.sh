#!/usr/bin/env bash
set -euo pipefail

usage() {
  cat <<'EOF'
Usage:
  sudo bash scripts/setup-production.sh <domain>

Examples:
  sudo bash scripts/setup-production.sh example.com
  sudo DOMAIN=example.com APP_PORT=3000 bash scripts/setup-production.sh example.com

Environment variables:
  DOMAIN             Domain used for frontend and API
  APP_NAME           Display name for the systemd service (default: fixithub)
  APP_PORT           Backend port (default: 3000)
  APP_PATH           Absolute path to the project root (default: auto-detect)
  FRONTEND_PATH      Absolute path to the frontend folder (default: <APP_PATH>/client)
  STATIC_ROOT        Folder used by nginx to serve the frontend (default: /var/www/fixithub)
  SERVICE_NAME       systemd service name (default: fixithub)
  SKIP_SSL           Set to 1 to skip Let's Encrypt setup
  SKIP_NGINX        Set to 1 to skip nginx config creation
  SKIP_NODE_INSTALL  Set to 1 to skip npm install/build step
EOF
}

if [[ ${1:-} == "-h" || ${1:-} == "--help" ]]; then
  usage
  exit 0
fi

if [[ ${EUID} -ne 0 ]]; then
  echo "Please run this script as root: sudo bash scripts/setup-production.sh <domain>" >&2
  exit 1
fi

if [[ $# -lt 1 ]]; then
  usage >&2
  exit 1
fi

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
REPO_ROOT="$(cd "$SCRIPT_DIR/.." && pwd)"

DOMAIN="${DOMAIN:-${1}}"
APP_NAME="${APP_NAME:-fixithub}"
APP_PORT="${APP_PORT:-3000}"
APP_PATH="${APP_PATH:-$REPO_ROOT}"
FRONTEND_PATH="${FRONTEND_PATH:-$APP_PATH/client}"
STATIC_ROOT="${STATIC_ROOT:-/var/www/fixithub}"
SERVICE_NAME="${SERVICE_NAME:-fixithub}"
SKIP_SSL="${SKIP_SSL:-0}"
SKIP_NGINX="${SKIP_NGINX:-0}"
SKIP_NODE_INSTALL="${SKIP_NODE_INSTALL:-0}"

if [[ -z "$DOMAIN" ]]; then
  echo "Domain is required." >&2
  usage >&2
  exit 1
fi

if [[ ! -d "$APP_PATH/server" ]]; then
  echo "The backend directory was not found at $APP_PATH/server" >&2
  exit 1
fi

if [[ ! -d "$FRONTEND_PATH" ]]; then
  echo "The frontend directory was not found at $FRONTEND_PATH" >&2
  exit 1
fi

if command -v apt-get >/dev/null 2>&1; then
  echo "==> Installing base packages"
  apt-get update
  DEBIAN_FRONTEND=noninteractive apt-get install -y nginx certbot python3-certbot-nginx ca-certificates curl >/dev/null
fi

mkdir -p "$STATIC_ROOT"

if [[ "$SKIP_NODE_INSTALL" != "1" ]]; then
  echo "==> Installing frontend dependencies"
  cd "$FRONTEND_PATH"
  npm install

  echo "==> Building frontend"
  npm run build

  echo "==> Copying frontend build to static root"
  rm -rf "$STATIC_ROOT"/*
  cp -r "$FRONTEND_PATH/dist/"* "$STATIC_ROOT/"
fi

if [[ ! -f "$APP_PATH/.env" ]]; then
  echo "==> Creating .env file from production template"
  cat > "$APP_PATH/.env" <<EOF
PORT=$APP_PORT
NODE_ENV=production
DATABASE_URL=mongodb://127.0.0.1:27017/fixithub
JWT_SECRET=$(openssl rand -hex 32)
REFRESH_TOKEN_SECRET=$(openssl rand -hex 32)
SESSION_SECRET=$(openssl rand -hex 32)
CLIENT_URL=https://$DOMAIN
SERVER_URL=https://$DOMAIN
PUBLIC_SITE_URL=https://$DOMAIN
EOF
else
  echo "==> Existing .env found, leaving it unchanged"
fi

cat > "/etc/systemd/system/${SERVICE_NAME}.service" <<EOF
[Unit]
Description=${APP_NAME} Backend
After=network.target

[Service]
Type=simple
User=root
WorkingDirectory=${APP_PATH}
ExecStart=/usr/bin/npm --prefix ${APP_PATH}/server run start
Restart=always
RestartSec=5
Environment=NODE_ENV=production
Environment=PORT=${APP_PORT}

[Install]
WantedBy=multi-user.target
EOF

systemctl daemon-reload
systemctl enable "$SERVICE_NAME" >/dev/null 2>&1 || true
systemctl restart "$SERVICE_NAME"

if [[ "$SKIP_NGINX" != "1" ]]; then
  echo "==> Configuring nginx"
  cat > "/etc/nginx/sites-available/${SERVICE_NAME}" <<EOF
server {
    listen 80;
    server_name ${DOMAIN} www.${DOMAIN};

    client_max_body_size 50M;

    root ${STATIC_ROOT};
    index index.html;

    location / {
        try_files \$uri /index.html;
    }

    location /api/ {
        proxy_pass http://127.0.0.1:${APP_PORT};
        proxy_http_version 1.1;
        proxy_set_header Upgrade \$http_upgrade;
        proxy_set_header Connection "upgrade";
        proxy_set_header Host \$host;
        proxy_set_header X-Real-IP \$remote_addr;
        proxy_set_header X-Forwarded-For \$proxy_add_x_forwarded_for;
        proxy_set_header X-Forwarded-Proto \$scheme;
    }

    location /uploads/ {
        proxy_pass http://127.0.0.1:${APP_PORT};
        proxy_set_header Host \$host;
        proxy_set_header X-Real-IP \$remote_addr;
        proxy_set_header X-Forwarded-For \$proxy_add_x_forwarded_for;
        proxy_set_header X-Forwarded-Proto \$scheme;
    }

    location /assets/ {
        proxy_pass http://127.0.0.1:${APP_PORT};
        proxy_set_header Host \$host;
        proxy_set_header X-Real-IP \$remote_addr;
        proxy_set_header X-Forwarded-For \$proxy_add_x_forwarded_for;
        proxy_set_header X-Forwarded-Proto \$scheme;
    }

    location = /robots.txt {
        proxy_pass http://127.0.0.1:${APP_PORT};
    }

    location = /sitemap.xml {
        proxy_pass http://127.0.0.1:${APP_PORT};
    }

    location ~* \.(js|css|png|jpg|jpeg|gif|svg|ico|webp|woff2?|ttf|map)$ {
        expires 1y;
        access_log off;
        add_header Cache-Control "public, max-age=31536000, immutable";
    }
}
EOF

  rm -f "/etc/nginx/sites-enabled/default"
  ln -sf "/etc/nginx/sites-available/${SERVICE_NAME}" "/etc/nginx/sites-enabled/${SERVICE_NAME}"
  nginx -t
  systemctl reload nginx
fi

if [[ "$SKIP_SSL" != "1" ]]; then
  echo "==> Requesting SSL certificate via Let's Encrypt"
  certbot --nginx --non-interactive --agree-tos --email "admin@${DOMAIN}" -d "$DOMAIN" -d "www.${DOMAIN}" || true
fi

echo
echo "Production setup completed."
echo "Frontend served from: $STATIC_ROOT"
echo "Backend service: $SERVICE_NAME"
echo "Domain: https://$DOMAIN"
echo "Check the backend with: systemctl status $SERVICE_NAME"
echo "Check nginx with: systemctl status nginx"
