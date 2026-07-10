#!/usr/bin/env bash
# Install FarmacoGraph Nginx reverse proxy (Fedora conf.d or Debian sites-available)
#
# Reads FG_HOST_API_PORT and FG_HOST_STUDIO_PORT from .env and rewrites upstreams.
# Safe to re-run after every deploy — keeps HTTPS login from 502'ing when host ports change.
set -euo pipefail
cd "$(dirname "$0")/.."

get_env_var() {
  local key="$1"
  if [[ -f .env ]] && grep -q "^${key}=" .env 2>/dev/null; then
    grep "^${key}=" .env | tail -1 | cut -d= -f2-
    return
  fi
  echo ""
}

API_PORT="$(get_env_var FG_HOST_API_PORT)"
API_PORT=${API_PORT:-8001}
STUDIO_PORT="$(get_env_var FG_HOST_STUDIO_PORT)"
STUDIO_PORT=${STUDIO_PORT:-3001}

echo "API upstream port:    ${API_PORT}"
echo "Studio upstream port: ${STUDIO_PORT}"

if ! curl -sf "http://127.0.0.1:${API_PORT}/api/v1/health" >/dev/null 2>&1; then
  echo "WARNING: API not responding on 127.0.0.1:${API_PORT}"
  echo "         Run: docker compose up -d api"
  echo "         Then re-run this script."
  echo ""
fi

if ! curl -sf -o /dev/null -w '' --max-time 3 "http://127.0.0.1:${STUDIO_PORT}/studio/login/" 2>/dev/null; then
  # login may 307; treat any TCP response as alive — use HEAD/code check
  code="$(curl -sS -o /dev/null -w '%{http_code}' --max-time 3 \
    --max-redirs 0 "http://127.0.0.1:${STUDIO_PORT}/studio/login/" 2>/dev/null || echo 000)"
  if [[ "$code" == "000" ]]; then
    echo "WARNING: Studio not responding on 127.0.0.1:${STUDIO_PORT}"
    echo "         Run: docker compose up -d studio"
    echo ""
  fi
fi

TMP=$(mktemp)
trap 'rm -f "$TMP"' EXIT
sed \
  -e "s/127.0.0.1:8001/127.0.0.1:${API_PORT}/" \
  -e "s/127.0.0.1:3001/127.0.0.1:${STUDIO_PORT}/" \
  deploy/nginx/farmacograph.conf > "$TMP"

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

# SELinux: allow nginx to proxy to non-default Docker host ports (e.g. 8002).
if command -v getenforce >/dev/null 2>&1 && [[ "$(getenforce 2>/dev/null)" == "Enforcing" ]]; then
  if command -v setsebool >/dev/null 2>&1; then
    sudo setsebool -P httpd_can_network_connect 1 2>/dev/null || true
  fi
  if command -v semanage >/dev/null 2>&1; then
    for port in "$API_PORT" "$STUDIO_PORT"; do
      if [[ "$port" != "80" && "$port" != "443" ]]; then
        sudo semanage port -a -t http_port_t -p tcp "$port" 2>/dev/null \
          || sudo semanage port -m -t http_port_t -p tcp "$port" 2>/dev/null \
          || true
      fi
    done
  fi
fi

sudo nginx -t
sudo systemctl reload nginx
echo "✓ Nginx configured → API :${API_PORT}  Studio :${STUDIO_PORT}"
echo "  SSL: sudo certbot --nginx -d farmacograph.furkanguven.space"

# Prove upstreams match what we just wrote
if [[ -f "$DEST" ]]; then
  echo ""
  echo "--- Active upstreams in ${DEST} ---"
  grep -E 'server 127\.0\.0\.1:' "$DEST" || true
fi
