#!/usr/bin/env bash
# FarmacoGraph production deploy — configure .env and start Docker stack.
#
# Usage (on server, e.g. /opt/FarmacoGraph):
#   ./scripts/deploy-production.sh              # write .env + git pull + docker up
#   ./scripts/deploy-production.sh --env-only   # only create/update .env
#   ./scripts/deploy-production.sh --no-pull    # skip git pull
#   ./scripts/deploy-production.sh --public-url https://example.com
#   ./scripts/deploy-production.sh --fast       # skip studio --no-cache rebuild
#
# Recommended bootstrap order after git pull:
#   ./scripts/migrate-schema.sh
#   ./scripts/deploy-production.sh
#   ./scripts/create-curator.sh --email curator@farmacograph.local
#   ./scripts/install-nginx.sh
#
# Requires: docker, docker compose, git (for pull), openssl or python3
set -euo pipefail
cd "$(dirname "$0")/.."

ENV_ONLY=false
NO_PULL=false
FAST=false
PUBLIC_URL="${FG_PUBLIC_URL:-https://farmacograph.furkanguven.space}"
SERVICES="postgres neo4j api studio"
REQUIRED_COMPOSE_SERVICES=(postgres neo4j api studio)

while [[ $# -gt 0 ]]; do
  case "$1" in
    --env-only) ENV_ONLY=true ;;
    --no-pull) NO_PULL=true ;;
    --fast) FAST=true ;;
    --public-url=*) PUBLIC_URL="${1#*=}" ;;
    --public-url)
      shift
      PUBLIC_URL="${1:?--public-url requires a value}"
      ;;
    -h|--help)
      sed -n '2,18p' "$0" | sed 's/^# \{0,1\}//'
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
  local lower
  lower="$(printf '%s' "$value" | tr '[:upper:]' '[:lower:]')"
  case "$lower" in
    ""|change-me-in-production*|dev-only-jwt-secret*|dev-secret-change-in-production*|test-secret*|changeme*)
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

require_docker() {
  if ! command -v docker >/dev/null 2>&1; then
    echo "✗ docker is required" >&2
    exit 1
  fi
  if ! docker compose version >/dev/null 2>&1; then
    echo "✗ docker compose is required" >&2
    exit 1
  fi
  if [[ ! -f docker-compose.yml ]]; then
    echo "✗ docker-compose.yml not found in $(pwd)" >&2
    exit 1
  fi
  local missing=0
  for svc in "${REQUIRED_COMPOSE_SERVICES[@]}"; do
    if ! grep -Eq "^[[:space:]]*${svc}:" docker-compose.yml; then
      echo "✗ docker-compose.yml missing service: ${svc}" >&2
      missing=1
    fi
  done
  if [[ "$missing" -ne 0 ]]; then
    exit 1
  fi
}

validate_production_env() {
  local env_name jwt db neo4j_enabled neo4j_uri neo4j_user neo4j_password
  env_name="$(get_env_var FG_ENVIRONMENT)"
  # Accept FG_ENV as an alias some operators set; prefer FG_ENVIRONMENT
  if [[ -z "$env_name" ]]; then
    env_name="$(get_env_var FG_ENV)"
  fi
  jwt="$(get_env_var FG_JWT_SECRET_KEY)"
  db="$(get_env_var FG_DATABASE_URL)"
  neo4j_enabled="$(get_env_var FG_NEO4J_ENABLED)"
  neo4j_uri="$(get_env_var FG_NEO4J_URI)"
  neo4j_user="$(get_env_var FG_NEO4J_USER)"
  neo4j_password="$(get_env_var FG_NEO4J_PASSWORD)"

  local failed=0

  if [[ "$env_name" != "production" ]]; then
    echo "✗ FG_ENVIRONMENT must be 'production' (got: '${env_name:-empty}')" >&2
    echo "  Tip: deploy-production.sh sets this automatically — check .env was written." >&2
    failed=1
  fi

  if is_insecure_jwt "$jwt"; then
    echo "✗ FG_JWT_SECRET_KEY is missing, too short (<32), or a known insecure default." >&2
    echo "  Set a long random secret or delete it from .env and re-run so it can be generated." >&2
    failed=1
  fi

  if [[ -z "$db" ]]; then
    echo "✗ FG_DATABASE_URL is missing" >&2
    failed=1
  elif [[ "$db" == sqlite* ]]; then
    echo "✗ FG_DATABASE_URL must not be sqlite in production (got: ${db})" >&2
    failed=1
  fi

  neo4j_enabled_lc="$(printf '%s' "$neo4j_enabled" | tr '[:upper:]' '[:lower:]')"
  if [[ "$neo4j_enabled_lc" == "true" || "$neo4j_enabled" == "1" ]]; then
    if [[ -z "$neo4j_uri" || -z "$neo4j_user" || -z "$neo4j_password" ]]; then
      echo "✗ FG_NEO4J_ENABLED=true but Neo4j URI/user/password is incomplete" >&2
      failed=1
    fi
  else
    echo "(!) FG_NEO4J_ENABLED is not true — evidence attach and graph publish will fail" >&2
  fi

  if [[ "$failed" -ne 0 ]]; then
    echo "" >&2
    echo "Refusing to deploy with unsafe/incomplete production configuration." >&2
    exit 1
  fi

  echo "✓ Production env validation passed"
  echo "  FG_ENVIRONMENT=production"
  echo "  FG_JWT_SECRET_KEY=(set, ${#jwt} chars)"
  echo "  FG_DATABASE_URL=(set)"
  echo "  FG_NEO4J_ENABLED=${neo4j_enabled}"
}

echo "=== FarmacoGraph production setup ==="
echo "Public URL: ${PUBLIC_URL}"
echo ""

require_docker

if [[ ! -f .env ]]; then
  echo "→ Creating .env from .env.example"
  cp .env.example .env
fi

EXISTING_JWT="$(get_env_var FG_JWT_SECRET_KEY)"
if is_insecure_jwt "$EXISTING_JWT"; then
  NEW_JWT="$(generate_jwt_secret)"
  echo "→ Generating FG_JWT_SECRET_KEY (${#NEW_JWT} chars)"
  set_env_var FG_JWT_SECRET_KEY "$NEW_JWT"
else
  echo "→ Keeping existing FG_JWT_SECRET_KEY"
fi

set_env_var FG_ENVIRONMENT production
set_env_var FG_ENV production
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
set_env_var FG_SEED_DEV_USERS false

chmod +x scripts/find-ports.sh scripts/migrate-schema.sh scripts/create-curator.sh 2>/dev/null || true
if [[ -x scripts/find-ports.sh ]]; then
  echo "→ Scanning host ports"
  ./scripts/find-ports.sh --apply
fi

echo ""
echo "✓ .env configured for production (evidence + publish require Neo4j)"
echo "  FG_ENVIRONMENT=production"
echo "  FG_NEO4J_ENABLED=true"
echo "  FG_STUDIO_API_URL=${API_URL}"
echo "  FG_STUDIO_BASE_PATH=/studio"
echo ""

validate_production_env

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

if [[ "$FAST" != true ]]; then
  echo "→ docker compose build --no-cache studio (bakes NEXT_PUBLIC_BASE_PATH into the image)"
  docker compose build --no-cache studio
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

if [[ -x scripts/migrate-schema.sh ]]; then
  echo "→ Applying schema patches"
  ./scripts/migrate-schema.sh || {
    echo "✗ Schema migrate failed — dashboard/curator will 500 until fixed" >&2
    exit 1
  }
fi

STUDIO_BASE="$(get_env_var FG_STUDIO_BASE_PATH)"
STUDIO_BASE=${STUDIO_BASE:-/studio}
STUDIO_HEALTH_URL="http://127.0.0.1:${STUDIO_PORT}${STUDIO_BASE}/"

echo "→ Waiting for Studio on ${STUDIO_HEALTH_URL}..."
STUDIO_OK=false
for _ in $(seq 1 30); do
  if curl -sfI "${STUDIO_HEALTH_URL}" >/dev/null 2>&1; then
    STUDIO_OK=true
    break
  fi
  sleep 2
done

if [[ "$STUDIO_OK" == true ]]; then
  echo "✓ Studio responding on ${STUDIO_HEALTH_URL}"
  if docker compose exec -T studio node -e " \
    const m = require('./.next/routes-manifest.json'); \
    const expected = '${STUDIO_BASE}'; \
    if ((m.basePath || '') !== expected) { \
      console.error('container basePath mismatch:', m.basePath, 'expected', expected); \
      process.exit(1); \
    } \
    console.log('container basePath:', m.basePath); \
  " 2>/dev/null; then
    echo "✓ Studio image has correct basePath (${STUDIO_BASE})"
  else
    echo "✗ Studio container basePath check failed — rebuild with: docker compose build --no-cache studio" >&2
    exit 1
  fi
else
  echo "✗ Studio did not respond on ${STUDIO_HEALTH_URL}" >&2
  echo "  Check: docker compose logs studio --tail 50" >&2
  docker compose exec -T studio node -e " \
    try { const m=require('./.next/routes-manifest.json'); console.log('routes-manifest basePath:', m.basePath); } catch (e) { console.error(e.message); } \
  " 2>/dev/null || true
  exit 1
fi

echo ""
echo "Deploy complete."
echo "  Studio: ${PUBLIC_URL}/studio/"
echo "  Login:  ${PUBLIC_URL}/studio/login/"
echo "  API:    ${API_URL}/health"
echo ""
echo "Next (required once): create a curator — production does not auto-seed users."
echo "  ./scripts/create-curator.sh --email curator@farmacograph.local"
echo "  ./scripts/install-nginx.sh"
echo ""
echo "Note: A 401 on /api/v1/dashboard without login is expected (auth required)."
echo "      A login failure usually means no curator yet — run create-curator.sh."
