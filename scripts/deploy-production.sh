#!/usr/bin/env bash
# FarmacoGraph production deploy — configure .env and start Docker stack.
#
# Usage (on server, e.g. /opt/FarmacoGraph):
#   ./scripts/deploy-production.sh              # write .env + git pull + docker up
#   ./scripts/deploy-production.sh --env-only   # only create/update .env
#   ./scripts/deploy-production.sh --no-pull    # skip git pull
#   ./scripts/deploy-production.sh --public-url https://example.com
#
# Requires: docker, docker compose, git (for pull), openssl or python3
set -euo pipefail
cd "$(dirname "$0")/.."

ENV_ONLY=false
NO_PULL=false
PUBLIC_URL="${FG_PUBLIC_URL:-https://farmacograph.furkanguven.space}"
SERVICES="postgres neo4j api studio"

while [[ $# -gt 0 ]]; do
  case "$1" in
    --env-only) ENV_ONLY=true ;;
    --no-pull) NO_PULL=true ;;
    --public-url=*) PUBLIC_URL="${1#*=}" ;;
    --public-url)
      shift
      PUBLIC_URL="${1:?--public-url requires a value}"
      ;;
    -h|--help)
      sed -n '2,12p' "$0" | sed 's/^# \{0,1\}//'
      exit 0
      ;;
    *)
      echo "Unknown option: $1 (try --help)" >&2
      exit 1
      ;;
  esac
  shift
done

PUBLIC_URL="${PUBLIC_URL%/}"
API_URL="${PUBLIC_URL}/api/v1"

is_insecure_jwt() {
  local value="$1"
  case "$value" in
    ""|change-me-in-production-use-long-random-string|dev-only-jwt-secret-change-in-production|dev-secret-change-in-production-32chars)
      return 0
      ;;
  esac
  [[ ${#value} -lt 32 ]]
}

generate_jwt_secret() {
  if command -v openssl >/dev/null 2>&1; then
    openssl rand -hex 32
    return
  fi
  python3 -c "import secrets; print(secrets.token_hex(32))"
}

set_env_var() {
  local key="$1"
  local val="$2"
  local file=".env"
  touch "$file"
  if grep -q "^${key}=" "$file" 2>/dev/null; then
    if sed --version 2>/dev/null | grep -q GNU; then
      sed -i "s|^${key}=.*|${key}=${val}|" "$file"
    else
      sed -i '' "s|^${key}=.*|${key}=${val}|" "$file"
    fi
  else
    echo "${key}=${val}" >>"$file"
  fi
}

get_env_var() {
  local key="$1"
  if [[ -f .env ]] && grep -q "^${key}=" .env 2>/dev/null; then
    grep "^${key}=" .env | tail -1 | cut -d= -f2-
    return
  fi
  echo ""
}

echo "=== FarmacoGraph production setup ==="
echo "Public URL: ${PUBLIC_URL}"
echo ""

if [[ ! -f .env ]]; then
  echo "→ Creating .env from .env.example"
  cp .env.example .env
fi

EXISTING_JWT="$(get_env_var FG_JWT_SECRET_KEY)"
if is_insecure_jwt "$EXISTING_JWT"; then
  NEW_JWT="$(generate_jwt_secret)"
  echo "→ Generating FG_JWT_SECRET_KEY"
  set_env_var FG_JWT_SECRET_KEY "$NEW_JWT"
else
  echo "→ Keeping existing FG_JWT_SECRET_KEY"
fi

set_env_var FG_ENVIRONMENT production
set_env_var FG_DEBUG false
set_env_var FG_DATABASE_URL "postgresql+asyncpg://farmacograph:farmacograph@postgres:5432/farmacograph"
set_env_var FG_NEO4J_ENABLED true
set_env_var FG_NEO4J_URI "bolt://neo4j:7687"
set_env_var FG_NEO4J_USER neo4j
set_env_var FG_NEO4J_PASSWORD farmacograph
set_env_var FG_LOG_JSON true
set_env_var FG_LOG_LEVEL INFO
set_env_var FG_METRICS_ENABLED true
set_env_var FG_HOST_STUDIO_PORT 3001
set_env_var FG_STUDIO_API_URL "$API_URL"
set_env_var FG_STUDIO_BASE_PATH /studio

chmod +x scripts/find-ports.sh 2>/dev/null || true
if [[ -x scripts/find-ports.sh ]]; then
  echo "→ Scanning host ports"
  ./scripts/find-ports.sh --apply
fi

echo ""
echo "✓ .env configured for production (evidence + publish require Neo4j)"
echo "  FG_ENVIRONMENT=production"
echo "  FG_NEO4J_ENABLED=true"
echo "  FG_STUDIO_API_URL=${API_URL}"
echo ""

if [[ "$ENV_ONLY" == true ]]; then
  echo "Done (--env-only). Run: docker compose up -d --build ${SERVICES}"
  exit 0
fi

if [[ "$NO_PULL" != true ]]; then
  if git rev-parse --is-inside-work-tree >/dev/null 2>&1; then
    echo "→ git pull"
    git pull --ff-only
  else
    echo "(!) Not a git repo — skipping pull"
  fi
fi

echo "→ docker compose up -d --build ${SERVICES}"
docker compose up -d --build ${SERVICES}

API_PORT="$(get_env_var FG_HOST_API_PORT)"
API_PORT=${API_PORT:-8001}
STUDIO_PORT="$(get_env_var FG_HOST_STUDIO_PORT)"
STUDIO_PORT=${STUDIO_PORT:-3001}

echo "→ Waiting for API on :${API_PORT}..."
for _ in $(seq 1 45); do
  if curl -sf "http://127.0.0.1:${API_PORT}/api/v1/health" >/dev/null 2>&1; then
    echo "✓ API healthy"
    break
  fi
  sleep 2
done

if curl -sf "http://127.0.0.1:${API_PORT}/api/v1/health" >/dev/null 2>&1; then
  curl -s "http://127.0.0.1:${API_PORT}/api/v1/health" | head -c 200 || true
  echo ""
else
  echo "✗ API did not respond. Check: docker compose logs api --tail 50" >&2
  exit 1
fi

if curl -sfI "http://127.0.0.1:${STUDIO_PORT}/studio/" >/dev/null 2>&1; then
  echo "✓ Studio responding on :${STUDIO_PORT}/studio/"
else
  echo "(!) Studio not ready yet — check: docker compose logs studio --tail 30"
fi

echo ""
echo "Deploy complete."
echo "  Studio: ${PUBLIC_URL}/studio/"
echo "  API:    ${API_URL}/health"
