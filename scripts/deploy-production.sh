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
#
# deploy-production.sh now syncs nginx upstreams automatically (API/Studio host ports).
# Re-run ./scripts/install-nginx.sh only if nginx was installed later or certbot rewrote the vhost.
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

is_loopback_studio_api_url() {
  local url="$1"
  local lower host
  lower="$(printf '%s' "$url" | tr '[:upper:]' '[:lower:]')"
  case "$lower" in
    *://127.0.0.1*|*://localhost*|*://0.0.0.0*|*://\[::1\]*|*://host.docker.internal*)
      return 0
      ;;
  esac
  # Strip scheme for host checks when URL is incomplete
  host="${lower#*://}"
  host="${host%%/*}"
  host="${host%%:*}"
  case "$host" in
    127.0.0.1|localhost|0.0.0.0|\[::1\]|host.docker.internal) return 0 ;;
  esac
  return 1
}

validate_production_env() {
  local env_name jwt db neo4j_enabled neo4j_uri neo4j_user neo4j_password
  local studio_api studio_base
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
  studio_api="$(get_env_var FG_STUDIO_API_URL)"
  studio_base="$(get_env_var FG_STUDIO_BASE_PATH)"

  local failed=0

  if [[ "$env_name" != "production" ]]; then
    echo "✗ FG_ENVIRONMENT must be 'production' (got: '${env_name:-empty}')" >&2
    echo "  Tip: deploy-production.sh sets this automatically — check .env was written." >&2
    echo "  Note: API reads FG_ENVIRONMENT only (FG_ENV is a deploy-script alias)." >&2
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

  if [[ -z "$studio_api" ]]; then
    echo "✗ FG_STUDIO_API_URL is missing (baked into Studio client at docker build)" >&2
    failed=1
  elif is_loopback_studio_api_url "$studio_api"; then
    echo "✗ FG_STUDIO_API_URL must not be localhost/127.0.0.1/host.docker.internal (got: ${studio_api})" >&2
    echo "  Baked loopback URLs cause broken Studio API calls from curator browsers." >&2
    failed=1
  elif [[ ! "$studio_api" =~ ^https?:// ]]; then
    echo "✗ FG_STUDIO_API_URL must be an absolute http(s) URL (got: ${studio_api})" >&2
    failed=1
  fi

  if [[ -z "$studio_base" ]]; then
    echo "✗ FG_STUDIO_BASE_PATH is missing (expected /studio for nginx)" >&2
    failed=1
  elif [[ "$studio_base" != "/studio" && "$studio_base" != /* ]]; then
    echo "✗ FG_STUDIO_BASE_PATH should be an absolute path like /studio (got: ${studio_base})" >&2
    failed=1
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
  echo "  FG_STUDIO_API_URL=${studio_api}"
  echo "  FG_STUDIO_BASE_PATH=${studio_base}"
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
# Keep Studio host port stable unless already set (nginx upstream).
if [[ -z "$(get_env_var FG_HOST_STUDIO_PORT)" ]]; then
  set_env_var FG_HOST_STUDIO_PORT 3001
fi
# Keep API host port stable unless already set — find-ports will preserve it once written.
if [[ -z "$(get_env_var FG_HOST_API_PORT)" ]]; then
  set_env_var FG_HOST_API_PORT 8001
fi
set_env_var FG_STUDIO_API_URL "$API_URL"
set_env_var FG_STUDIO_BASE_PATH /studio
set_env_var FG_SEED_DEV_USERS false
# Writable curator catalogs (staging/ is :ro in docker-compose — Add disease/fragment need this)
if [[ -z "$(get_env_var FG_DISEASE_CATALOG_PATH)" ]]; then
  set_env_var FG_DISEASE_CATALOG_PATH /app/data/catalog/diseases.runtime.json
fi
if [[ -z "$(get_env_var FG_MECHANISM_CATALOG_PATH)" ]]; then
  set_env_var FG_MECHANISM_CATALOG_PATH /app/data/catalog/mechanisms.runtime.json
fi

chmod +x scripts/find-ports.sh scripts/migrate-schema.sh scripts/create-curator.sh scripts/install-nginx.sh 2>/dev/null || true
if [[ -x scripts/find-ports.sh ]]; then
  echo "→ Scanning host ports (keeps existing FG_HOST_* from .env — avoids nginx 502)"
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
  STUDIO_BUILD_ID="$(git rev-parse --short HEAD 2>/dev/null || date -u +%Y%m%dT%H%M%SZ)"
  echo "→ docker compose build --no-cache studio (bakes NEXT_PUBLIC_API_URL + NEXT_PUBLIC_BASE_PATH)"
  echo "  Note: plain 'docker compose up -d --build api studio' is NOT enough after URL/basePath"
  echo "  changes — Compose may reuse cached layers that still embed the old public env."
  echo "  Build id: ${STUDIO_BUILD_ID}"
  docker compose build --no-cache --build-arg "FG_STUDIO_BUILD_ID=${STUDIO_BUILD_ID}" studio
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
# Hit the Studio container via host port (bypass nginx). HEAD alone is insufficient:
# Next can return empty GET bodies through a bad nginx Connection: upgrade while
# HEAD / static /_next still looks fine.
STUDIO_HEALTH_URL="http://127.0.0.1:${STUDIO_PORT}${STUDIO_BASE}/"
STUDIO_LOGIN_URL="http://127.0.0.1:${STUDIO_PORT}${STUDIO_BASE}/login/"
STUDIO_TMP="$(mktemp)"
STUDIO_HDR="$(mktemp)"
trap 'rm -f "${STUDIO_TMP}" "${STUDIO_HDR}"' EXIT

echo "→ Waiting for Studio on ${STUDIO_HEALTH_URL} (direct port, bypass nginx)..."
STUDIO_OK=false
STUDIO_DETAIL=""
for _ in $(seq 1 30); do
  # Prefer public login page. Fall back to /studio/ redirect that is not a login loop.
  CODE="$(curl -sS -D "${STUDIO_HDR}" -o "${STUDIO_TMP}" -w '%{http_code}' \
    --max-redirs 0 \
    -H 'Accept: text/html' \
    -H 'Connection: close' \
    "${STUDIO_LOGIN_URL}" 2>/dev/null || echo 000)"
  BYTES="$(wc -c <"${STUDIO_TMP}" | tr -d ' ')"
  if [[ "$CODE" == "200" && "$BYTES" -gt 200 ]] && grep -qiE '<html|<!doctype' "${STUDIO_TMP}"; then
    STUDIO_OK=true
    STUDIO_DETAIL="login 200 HTML (${BYTES} bytes)"
    break
  fi
  # Middleware not-yet-fixed may 307 /login/?returnTo=/login/ — still prove Next is alive
  # via a protected path redirect that does not loop.
  CODE2="$(curl -sS -D "${STUDIO_HDR}" -o "${STUDIO_TMP}" -w '%{http_code}' \
    --max-redirs 0 \
    -H 'Accept: text/html' \
    -H 'Connection: close' \
    "${STUDIO_HEALTH_URL}" 2>/dev/null || echo 000)"
  BYTES2="$(wc -c <"${STUDIO_TMP}" | tr -d ' ')"
  LOC2="$(awk 'tolower($1)=="location:"{print $2}' "${STUDIO_HDR}" 2>/dev/null | tr -d '\r' | tail -1)"
  if [[ "$CODE2" == "200" && "$BYTES2" -gt 200 ]] && grep -qiE '<html|<!doctype' "${STUDIO_TMP}"; then
    STUDIO_OK=true
    STUDIO_DETAIL="/studio/ 200 HTML (${BYTES2} bytes)"
    break
  fi
  if [[ "$CODE2" =~ ^30[78]$ ]] && [[ "$LOC2" == *"/login"* ]] && [[ "$LOC2" != *"returnTo=%2Flogin"* ]] && [[ "$LOC2" != *"returnTo=/login"* ]]; then
    STUDIO_OK=true
    STUDIO_DETAIL="/studio/ ${CODE2} → ${LOC2}"
    break
  fi
  sleep 2
done

if [[ "$STUDIO_OK" == true ]]; then
  echo "✓ Studio container healthy: ${STUDIO_DETAIL}"
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
  echo "✗ Studio container did not serve HTML or a clean auth redirect on :${STUDIO_PORT}" >&2
  echo "  Check: docker compose logs studio --tail 50" >&2
  echo "  If direct :${STUDIO_PORT} is OK but https://${PUBLIC_URL#https://}/studio/ is 200 empty:" >&2
  echo "    → nginx Connection: upgrade bug — run ./scripts/install-nginx.sh" >&2
  echo "  (deploy/nginx/farmacograph.conf uses map \$http_upgrade \$connection_upgrade)" >&2
  docker compose exec -T studio node -e " \
    try { const m=require('./.next/routes-manifest.json'); console.log('routes-manifest basePath:', m.basePath); } catch (e) { console.error(e.message); } \
  " 2>/dev/null || true
  exit 1
fi

sync_nginx_upstreams() {
  if [[ ! -x scripts/install-nginx.sh ]]; then
    echo "(!) scripts/install-nginx.sh missing — skip nginx sync" >&2
    return 0
  fi
  if ! command -v nginx >/dev/null 2>&1; then
    echo "(!) nginx not installed on host — skip upstream sync"
    echo "    After installing nginx: ./scripts/install-nginx.sh"
    return 0
  fi
  echo "→ Syncing nginx upstreams to API :${API_PORT} / Studio :${STUDIO_PORT}"
  if ./scripts/install-nginx.sh; then
    echo "✓ Nginx upstreams synced"
  else
    echo "✗ nginx sync failed — public HTTPS will 502 until fixed" >&2
    echo "  Run as root/sudo: ./scripts/install-nginx.sh" >&2
    return 1
  fi
}

verify_public_api() {
  local health_url code
  health_url="${PUBLIC_URL}/api/v1/health"
  echo "→ Checking public API ${health_url} ..."
  code="$(curl -sS -o /dev/null -w '%{http_code}' --max-time 15 "$health_url" 2>/dev/null || echo 000)"
  if [[ "$code" == "200" ]]; then
    echo "✓ Public API healthy (${code})"
    return 0
  fi
  echo "✗ Public API returned HTTP ${code} (login will fail with 502/network error)" >&2
  echo "  Direct API OK? curl -sf http://127.0.0.1:${API_PORT}/api/v1/health" >&2
  echo "  Nginx upstream? grep 'server 127.0.0.1' /etc/nginx/conf.d/farmacograph.conf" >&2
  echo "  Fix: ./scripts/install-nginx.sh && ./scripts/diagnose.sh" >&2
  return 1
}

sync_nginx_upstreams || true
verify_public_api || {
  echo "" >&2
  echo "Deploy finished containers, but public login path is broken." >&2
  echo "This is almost always nginx upstream ≠ FG_HOST_API_PORT." >&2
  exit 1
}

echo ""
echo "Deploy complete."
echo "  Quick rebuild: docker compose up -d --build api studio"
echo "  After FG_STUDIO_* change: docker compose build --no-cache studio && docker compose up -d studio"
echo "  Studio (direct): http://127.0.0.1:${STUDIO_PORT}${STUDIO_BASE}/"
echo "  Studio (public): ${PUBLIC_URL}/studio/"
echo "  Login:           ${PUBLIC_URL}/studio/login/"
echo "  API:             ${API_URL}/health"
echo "  Host ports:      API=${API_PORT} Studio=${STUDIO_PORT} (pinned in .env; nginx synced)"
echo ""
echo "Next (required once): create a curator — production does not auto-seed users."
echo "  ./scripts/create-curator.sh --email curator@farmacograph.local"
echo ""
echo "Note: A 401 on /api/v1/dashboard without login is expected (auth required)."
echo "      A login failure usually means no curator yet — run create-curator.sh."
echo "      A 502 on login after deploy means nginx missed a port change — re-run install-nginx.sh."
