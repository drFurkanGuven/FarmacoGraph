#!/usr/bin/env bash
# Install FarmacoGraph Nginx reverse proxy (Fedora conf.d or Debian sites-available)
set -euo pipefail
cd "$(dirname "$0")/.."

API_PORT=$(grep -E '^FG_HOST_API_PORT=' .env 2>/dev/null | cut -d= -f2 || true)
API_PORT=${API_PORT:-8001}

echo "API upstream port: ${API_PORT}"

if ! curl -sf "http://127.0.0.1:${API_PORT}/api/v1/health" >/dev/null 2>&1; then
  echo "WARNING: API not responding on 127.0.0.1:${API_PORT}"
  echo "         Run: ./scripts/find-ports.sh --up"
  echo ""
fi

TMP=$(mktemp)
trap 'rm -f "$TMP"' EXIT
sed "s/127.0.0.1:8001/127.0.0.1:${API_PORT}/" deploy/nginx/farmacograph.conf > "$TMP"

if [[ -d /etc/nginx/conf.d ]]; then
  DEST="/etc/nginx/conf.d/farmacograph.conf"
  echo "→ Fedora/RHEL layout: ${DEST}"
  sudo cp "$TMP" "$DEST"
elif [[ -d /etc/nginx/sites-available ]]; then
  DEST="/etc/nginx/sites-available/farmacograph.conf"
  echo "→ Debian/Ubuntu layout: ${DEST}"
  sudo cp "$TMP" "$DEST"
  sudo mkdir -p /etc/nginx/sites-enabled
  sudo ln -sf "$DEST" /etc/nginx/sites-enabled/farmacograph.conf
else
  echo "ERROR: nginx config directory not found. Install nginx first." >&2
  exit 1
fi

sudo nginx -t
sudo systemctl reload nginx
echo "✓ Nginx configured → http://farmacograph.furkanguven.space"
echo "  SSL: sudo certbot --nginx -d farmacograph.furkanguven.space"
