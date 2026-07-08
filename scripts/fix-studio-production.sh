#!/usr/bin/env bash
# One-shot production repair for Studio white screen + login redirect loop.
#
# Run on the Fedora host as root (or with sudo for nginx):
#   cd /opt/FarmacoGraph && ./scripts/fix-studio-production.sh
#
# What it does:
#   1. Reset repo to origin/main (discards local Dockerfile hotfixes)
#   2. Install nginx config (no WebSocket Upgrade on /studio)
#   3. Migrate Postgres schema if needed
#   4. Rebuild Studio image --no-cache with current git SHA
#   5. Recreate studio container
#   6. Print direct :3001 checks + smoke script

set -euo pipefail

ROOT="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
cd "${ROOT}"

STUDIO_PORT="${FG_STUDIO_PORT:-3001}"
COMPOSE="${COMPOSE_CMD:-docker compose}"

red() { printf '\033[31m%s\033[0m\n' "$*"; }
green() { printf '\033[32m%s\033[0m\n' "$*"; }
step() { printf '\n\033[1m==> %s\033[0m\n' "$*"; }

step "Sync repo to origin/main"
git fetch origin
git reset --hard origin/main
HEAD_SHA="$(git rev-parse --short HEAD)"
green "HEAD=${HEAD_SHA}"

step "Install nginx (Connection header fix for /studio)"
if [[ -x "${ROOT}/scripts/install-nginx.sh" ]]; then
  "${ROOT}/scripts/install-nginx.sh"
fi
if command -v nginx >/dev/null 2>&1; then
  nginx -t
  systemctl reload nginx 2>/dev/null || service nginx reload 2>/dev/null || true
fi

step "Postgres schema patches"
if [[ -x "${ROOT}/scripts/migrate-schema.sh" ]]; then
  "${ROOT}/scripts/migrate-schema.sh"
fi

step "Remove old Studio image (force clean rebuild)"
${COMPOSE} stop studio 2>/dev/null || true
${COMPOSE} rm -f studio 2>/dev/null || true
docker image rm -f "$(docker images -q '*studio*' 2>/dev/null | head -1)" 2>/dev/null || true

step "Build Studio --no-cache (build-id=${HEAD_SHA})"
export FG_STUDIO_BUILD_ID="${HEAD_SHA}"
${COMPOSE} build --no-cache --pull \
  --build-arg "FG_STUDIO_BUILD_ID=${HEAD_SHA}" \
  studio

step "Start Studio"
${COMPOSE} up -d --force-recreate --no-deps studio

sleep 3

step "Direct container checks (bypass nginx)"
echo -n "build-id.txt: "
curl -sS --max-redirs 0 "http://127.0.0.1:${STUDIO_PORT}/studio/build-id.txt" || red "FAIL"
echo ""
echo "--- login (nofollow) ---"
curl -sSI --max-redirs 0 "http://127.0.0.1:${STUDIO_PORT}/studio/login/" | head -8
echo "--- root (nofollow) ---"
curl -sSI --max-redirs 0 "http://127.0.0.1:${STUDIO_PORT}/studio/" | head -8

step "Public smoke"
if [[ -x "${ROOT}/scripts/smoke-studio.sh" ]]; then
  "${ROOT}/scripts/smoke-studio.sh" || {
    red "Smoke failed — paste output above when asking for help."
    exit 1
  }
fi

green "Done. Sign in: ${FG_PUBLIC_URL:-https://farmacograph.furkanguven.space}/studio/login/"
green "Create curator if needed: ./scripts/create-curator.sh --email curator@farmacograph.local"
