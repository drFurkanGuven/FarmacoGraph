#!/usr/bin/env bash
# FarmacoGraph 502 diagnostics — run on server
set -euo pipefail
cd "$(dirname "$0")/.."

echo "=== FarmacoGraph diagnose ==="
echo "Path: $(pwd)"
echo ""

API_PORT=$(grep -E '^FG_HOST_API_PORT=' .env 2>/dev/null | cut -d= -f2 || true)
API_PORT=${API_PORT:-8001}
echo "FG_HOST_API_PORT=${API_PORT}"
echo ""

echo "--- Docker containers ---"
docker compose ps -a 2>/dev/null || docker-compose ps -a
echo ""

echo "--- Port ${API_PORT} on host ---"
if command -v ss >/dev/null 2>&1; then
  ss -tlnp | grep ":${API_PORT}" || echo "(nothing listening on :${API_PORT})"
else
  echo "(install ss to check ports)"
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

echo "--- Nginx upstream ---"
if [[ -f /etc/nginx/conf.d/farmacograph.conf ]]; then
  grep -E "server 127.0.0.1|proxy_pass" /etc/nginx/conf.d/farmacograph.conf
elif [[ -f /etc/nginx/sites-enabled/farmacograph.conf ]]; then
  grep -E "server 127.0.0.1|proxy_pass" /etc/nginx/sites-enabled/farmacograph.conf
else
  echo "farmacograph nginx config not found"
fi
echo ""

echo "--- API container logs (last 40 lines) ---"
docker compose logs api --tail 40 2>/dev/null || docker-compose logs api --tail 40
echo ""

echo "--- Quick fix if API down ---"
echo "  ./scripts/find-ports.sh --up"
echo "  # or: docker compose up -d --build"
