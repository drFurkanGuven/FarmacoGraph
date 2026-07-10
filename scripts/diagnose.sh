#!/usr/bin/env bash
# FarmacoGraph 502 diagnostics — run on server
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

echo "=== FarmacoGraph diagnose ==="
echo "Path: $(pwd)"
echo ""

API_PORT="$(get_env_var FG_HOST_API_PORT)"
API_PORT=${API_PORT:-8001}
STUDIO_PORT="$(get_env_var FG_HOST_STUDIO_PORT)"
STUDIO_PORT=${STUDIO_PORT:-3001}
PUBLIC_URL="$(get_env_var FG_STUDIO_API_URL)"
PUBLIC_URL="${PUBLIC_URL%/api/v1}"
PUBLIC_URL="${PUBLIC_URL:-https://farmacograph.furkanguven.space}"

echo "FG_HOST_API_PORT=${API_PORT}"
echo "FG_HOST_STUDIO_PORT=${STUDIO_PORT}"
echo "PUBLIC_URL=${PUBLIC_URL}"
echo ""

echo "--- Docker containers ---"
docker compose ps -a 2>/dev/null || docker-compose ps -a
echo ""

echo "--- Port ${API_PORT} (API) on host ---"
if command -v ss >/dev/null 2>&1; then
  ss -tlnp | grep ":${API_PORT}" || echo "(nothing listening on :${API_PORT})"
else
  echo "(install ss to check ports)"
fi
echo ""

echo "--- Port ${STUDIO_PORT} (Studio) on host ---"
if command -v ss >/dev/null 2>&1; then
  ss -tlnp | grep ":${STUDIO_PORT}" || echo "(nothing listening on :${STUDIO_PORT})"
fi
echo ""

echo "--- curl API (localhost) ---"
if curl -sf --max-time 5 "http://127.0.0.1:${API_PORT}/api/v1/health"; then
  echo ""
  echo "OK: API responds on :${API_PORT}"
else
  echo "FAIL: no response on http://127.0.0.1:${API_PORT}/api/v1/health"
fi
echo ""

echo "--- curl Studio login (localhost, nofollow) ---"
curl -sSI --max-time 5 --max-redirs 0 "http://127.0.0.1:${STUDIO_PORT}/studio/login/" | head -8 || true
echo ""

NGINX_CONF=""
if [[ -f /etc/nginx/conf.d/farmacograph.conf ]]; then
  NGINX_CONF=/etc/nginx/conf.d/farmacograph.conf
elif [[ -f /etc/nginx/sites-enabled/farmacograph.conf ]]; then
  NGINX_CONF=/etc/nginx/sites-enabled/farmacograph.conf
fi

echo "--- Nginx upstream ---"
if [[ -n "$NGINX_CONF" ]]; then
  echo "config: ${NGINX_CONF}"
  grep -E "server 127.0.0.1|proxy_pass" "$NGINX_CONF" || true
  NGINX_API="$(grep -E 'upstream farmacograph_api' -A2 "$NGINX_CONF" | grep -oE '127\.0\.0\.1:[0-9]+' | head -1 || true)"
  NGINX_STUDIO="$(grep -E 'upstream farmacograph_studio' -A2 "$NGINX_CONF" | grep -oE '127\.0\.0\.1:[0-9]+' | head -1 || true)"
  echo ""
  if [[ -n "$NGINX_API" && "$NGINX_API" != "127.0.0.1:${API_PORT}" ]]; then
    echo "MISMATCH: nginx API upstream is ${NGINX_API} but .env FG_HOST_API_PORT=${API_PORT}"
    echo "  → This causes HTTPS login 502. Fix: ./scripts/install-nginx.sh"
  elif [[ -n "$NGINX_API" ]]; then
    echo "OK: nginx API upstream matches .env (${NGINX_API})"
  fi
  if [[ -n "$NGINX_STUDIO" && "$NGINX_STUDIO" != "127.0.0.1:${STUDIO_PORT}" ]]; then
    echo "MISMATCH: nginx Studio upstream is ${NGINX_STUDIO} but .env FG_HOST_STUDIO_PORT=${STUDIO_PORT}"
    echo "  → Fix: ./scripts/install-nginx.sh"
  elif [[ -n "$NGINX_STUDIO" ]]; then
    echo "OK: nginx Studio upstream matches .env (${NGINX_STUDIO})"
  fi
else
  echo "farmacograph nginx config not found"
fi
echo ""

echo "--- Public HTTPS health ---"
PUB_CODE="$(curl -sS -o /dev/null -w '%{http_code}' --max-time 15 "${PUBLIC_URL}/api/v1/health" 2>/dev/null || echo 000)"
echo "GET ${PUBLIC_URL}/api/v1/health → ${PUB_CODE}"
if [[ "$PUB_CODE" == "502" || "$PUB_CODE" == "000" ]]; then
  echo "FAIL: public API unreachable — login will break"
  echo "  1) ./scripts/install-nginx.sh"
  echo "  2) docker compose up -d api studio"
  echo "  3) On Fedora SELinux: sudo setsebool -P httpd_can_network_connect 1"
fi
echo ""

echo "--- API container logs (last 40 lines) ---"
docker compose logs api --tail 40 2>/dev/null || docker-compose logs api --tail 40
echo ""

echo "--- Quick fix ---"
echo "  ./scripts/install-nginx.sh"
echo "  ./scripts/deploy-production.sh --no-pull --fast"
echo "  # or: docker compose up -d --build api studio"
