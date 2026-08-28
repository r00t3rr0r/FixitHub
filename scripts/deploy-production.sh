#!/usr/bin/env bash
set -euo pipefail

usage() {
  cat <<'EOF'
Usage:
  sudo bash scripts/deploy-production.sh

Environment variables:
  APP_PATH           Absolute project path (default: auto-detect from script location)
  FRONTEND_PATH      Absolute frontend path (default: <APP_PATH>/client)
  STATIC_ROOT        Nginx static root (default: /var/www/fixithub)
  SERVICE_NAME       systemd service name (default: fixithub)
  APP_PORT           Backend port (default: 3000)
EOF
}

if [[ ${1:-} == "-h" || ${1:-} == "--help" ]]; then
  usage
  exit 0
fi

if [[ ${EUID} -ne 0 ]]; then
  echo "Please run this script as root: sudo bash scripts/deploy-production.sh" >&2
  exit 1
fi

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
APP_PATH="${APP_PATH:-$(cd "$SCRIPT_DIR/.." && pwd)}"
FRONTEND_PATH="${FRONTEND_PATH:-$APP_PATH/client}"
STATIC_ROOT="${STATIC_ROOT:-/var/www/fixithub}"
SERVICE_NAME="${SERVICE_NAME:-fixithub}"
APP_PORT="${APP_PORT:-3000}"

if [[ ! -d "$APP_PATH" ]]; then
  echo "Project path not found: $APP_PATH" >&2
  exit 1
fi

if [[ ! -d "$FRONTEND_PATH" ]]; then
  echo "Frontend path not found: $FRONTEND_PATH" >&2
  exit 1
fi

echo "==> Pulling latest code"
cd "$APP_PATH"
if command -v git >/dev/null 2>&1; then
  git pull --ff-only || true
fi

echo "==> Installing frontend dependencies"
cd "$FRONTEND_PATH"
npm install

echo "==> Building frontend"
npm run build

echo "==> Syncing static frontend files"
mkdir -p "$STATIC_ROOT"
rm -rf "$STATIC_ROOT"/*
cp -r "$FRONTEND_PATH/dist/"* "$STATIC_ROOT/"

if systemctl is-enabled "$SERVICE_NAME" >/dev/null 2>&1 || systemctl list-unit-files | grep -q "^${SERVICE_NAME}\.service"; then
  echo "==> Restarting backend service"
  systemctl restart "$SERVICE_NAME"
  systemctl status "$SERVICE_NAME" --no-pager | tail -n 20 || true
else
  echo "==> Backend service not found: $SERVICE_NAME"
  echo "Run the production setup first or create the service manually."
fi

echo "==> Reloading nginx"
nginx -t
systemctl reload nginx || systemctl restart nginx

echo
echo "Deployment finished successfully."
echo "Frontend: $STATIC_ROOT"
echo "Backend: http://127.0.0.1:${APP_PORT}"
echo "Nginx: http://your-domain"
