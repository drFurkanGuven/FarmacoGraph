#!/usr/bin/env bash
# FarmacoGraph — host port scanner & auto-assign for Docker Compose
# Usage:
#   ./scripts/find-ports.sh              # scan only
#   ./scripts/find-ports.sh --apply      # write FG_HOST_* to .env
#   ./scripts/find-ports.sh --up           # apply + docker compose up -d --build
set -euo pipefail
cd "$(dirname "$0")/.."

APPLY=false
DOCKER_UP=false
for arg in "$@"; do
  case "$arg" in
    --apply) APPLY=true ;;
    --up) APPLY=true; DOCKER_UP=true ;;
  esac
done

FG_HOST_PG_PORT=""
FG_HOST_NEO4J_HTTP_PORT=""
FG_HOST_NEO4J_BOLT_PORT=""
FG_HOST_API_PORT=""

is_port_in_use() {
  local port="$1"
  if command -v ss >/dev/null 2>&1; then
    ss -tlnH "sport = :${port}" 2>/dev/null | grep -q .
    return
  fi
  if command -v lsof >/dev/null 2>&1; then
    lsof -iTCP:"${port}" -sTCP:LISTEN -t >/dev/null 2>&1
    return
  fi
  (echo >/dev/tcp/127.0.0.1/"${port}") 2>/dev/null
}

port_owner() {
  local port="$1"
  if command -v ss >/dev/null 2>&1; then
    ss -tlnpH "sport = :${port}" 2>/dev/null | head -1
    return
  fi
  if command -v lsof >/dev/null 2>&1; then
    lsof -iTCP:"${port}" -sTCP:LISTEN 2>/dev/null | tail -n +2 | head -1
    return
  fi
  echo "(install ss or lsof to see process)"
}

find_free_port() {
  local start="$1"
  local end="$2"
  local p
  for ((p = start; p <= end; p++)); do
    if ! is_port_in_use "$p"; then
      echo "$p"
      return 0
    fi
  done
  echo "ERROR: no free port in ${start}-${end}" >&2
  return 1
}

pick_port() {
  local label="$1"
  local default="$2"
  local start="$3"
  local end="$4"
  local chosen owner

  if is_port_in_use "$default"; then
    owner=$(port_owner "$default")
    chosen=$(find_free_port "$start" "$end")
    echo "[!] ${label} default :${default} BUSY" >&2
    [[ -n "$owner" ]] && echo "    → ${owner}" >&2
    echo "    → using :${chosen}" >&2
  else
    chosen="$default"
    echo "[✓] ${label} :${default} FREE" >&2
  fi
  echo "$chosen"
}

echo "=== FarmacoGraph port scan ($(hostname 2>/dev/null || echo localhost)) ==="
echo ""

FG_HOST_PG_PORT=$(pick_port "postgres" 5433 5433 5450)
echo ""
FG_HOST_NEO4J_HTTP_PORT=$(pick_port "neo4j-http" 7474 7474 7490)
echo ""
FG_HOST_NEO4J_BOLT_PORT=$(pick_port "neo4j-bolt" 7687 7687 7700)
echo ""
FG_HOST_API_PORT=$(pick_port "api" 8001 8001 8020)
echo ""

echo "=== Recommended .env (host ports) ==="
echo "FG_HOST_PG_PORT=${FG_HOST_PG_PORT}"
echo "FG_HOST_NEO4J_HTTP_PORT=${FG_HOST_NEO4J_HTTP_PORT}"
echo "FG_HOST_NEO4J_BOLT_PORT=${FG_HOST_NEO4J_BOLT_PORT}"
echo "FG_HOST_API_PORT=${FG_HOST_API_PORT}"
echo ""
echo "API:  curl http://localhost:${FG_HOST_API_PORT}/api/v1/health"
echo "Neo4j: http://localhost:${FG_HOST_NEO4J_HTTP_PORT}"
echo ""

set_env_var() {
  local key="$1"
  local val="$2"
  local file=".env"
  touch "$file"
  if grep -q "^${key}=" "$file" 2>/dev/null; then
    if sed --version 2>/dev/null | grep -q GNU; then
      sed -i "s/^${key}=.*/${key}=${val}/" "$file"
    else
      sed -i '' "s/^${key}=.*/${key}=${val}/" "$file"
    fi
  else
    echo "${key}=${val}" >> "$file"
  fi
}

if [[ "$APPLY" == true ]]; then
  set_env_var FG_HOST_PG_PORT "$FG_HOST_PG_PORT"
  set_env_var FG_HOST_NEO4J_HTTP_PORT "$FG_HOST_NEO4J_HTTP_PORT"
  set_env_var FG_HOST_NEO4J_BOLT_PORT "$FG_HOST_NEO4J_BOLT_PORT"
  set_env_var FG_HOST_API_PORT "$FG_HOST_API_PORT"
  echo "✓ Written to .env"
fi

if [[ "$DOCKER_UP" == true ]]; then
  docker compose down 2>/dev/null || true
  docker compose up -d --build
  echo "→ waiting for API on :${FG_HOST_API_PORT}..."
  for _ in $(seq 1 30); do
    if curl -sf "http://127.0.0.1:${FG_HOST_API_PORT}/api/v1/health" >/dev/null 2>&1; then
      curl -s "http://127.0.0.1:${FG_HOST_API_PORT}/api/v1/health"
      echo ""
      echo "✓ FarmacoGraph API ready on port ${FG_HOST_API_PORT}"
      exit 0
    fi
    sleep 2
  done
  echo "✗ API did not respond. Check: docker compose logs api"
  exit 1
fi
