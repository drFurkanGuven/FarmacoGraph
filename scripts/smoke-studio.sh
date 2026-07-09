#!/usr/bin/env bash
# FarmacoGraph Studio production smoke checks (HTTP-level).
#
# Usage:
#   ./scripts/smoke-studio.sh
#   ./scripts/smoke-studio.sh https://farmacograph.furkanguven.space
#   ./scripts/smoke-studio.sh --wait https://farmacograph.furkanguven.space
#   FG_PUBLIC_URL=https://example.com ./scripts/smoke-studio.sh --wait
#
# --wait polls /studio/login/ for up to SMOKE_WAIT_SECS (default 120) after deploy.
#
# Exit 0 = all checks passed. Exit 1 = one or more failures.
# Does not log in, does not print secrets, does not hit localhost by default.

set -euo pipefail

WAIT_STUDIO=false
SMOKE_WAIT_SECS="${SMOKE_WAIT_SECS:-120}"
SMOKE_WAIT_INTERVAL="${SMOKE_WAIT_INTERVAL:-10}"

while [[ $# -gt 0 ]]; do
  case "$1" in
    --wait)
      WAIT_STUDIO=true
      shift
      ;;
    -h|--help)
      sed -n '2,12p' "$0" | sed 's/^# \{0,1\}//'
      exit 0
      ;;
    -*)
      echo "Unknown option: $1 (try --wait)" >&2
      exit 1
      ;;
    *)
      break
      ;;
  esac
done

BASE_URL="${1:-${FG_PUBLIC_URL:-https://farmacograph.furkanguven.space}}"
BASE_URL="${BASE_URL%/}"
MAX_REDIRS="${SMOKE_MAX_REDIRS:-5}"
CURL_TIMEOUT="${SMOKE_TIMEOUT:-15}"

PASS=0
FAIL=0
WARN=0

red() { printf '\033[31m%s\033[0m\n' "$*"; }
green() { printf '\033[32m%s\033[0m\n' "$*"; }
yellow() { printf '\033[33m%s\033[0m\n' "$*"; }

pass() { green "PASS  $*"; PASS=$((PASS + 1)); }
fail() { red "FAIL  $*"; FAIL=$((FAIL + 1)); }
warn() { yellow "WARN  $*"; WARN=$((WARN + 1)); }

curl_meta() {
  # Args: url [extra curl args...]
  # Prints: http_code|num_redirects|size_download|url_effective|content_type
  local url="$1"
  shift
  curl -sS -L --max-redirs "${MAX_REDIRS}" --max-time "${CURL_TIMEOUT}" \
    -o /tmp/fg-smoke-body.$$ \
    -w '%{http_code}|%{num_redirects}|%{size_download}|%{url_effective}|%{content_type}' \
    "$@" "$url" || true
}

curl_headers_nofollow() {
  local url="$1"
  curl -sS -I --max-redirs 0 --max-time "${CURL_TIMEOUT}" "$url" 2>/dev/null || true
}

echo "=== FarmacoGraph Studio smoke ==="
echo "Base: ${BASE_URL}"
echo ""

if [[ "${WAIT_STUDIO}" == "true" ]]; then
  echo "--- waiting for Studio (up to ${SMOKE_WAIT_SECS}s) ---"
  waited=0
  while [[ "${waited}" -lt "${SMOKE_WAIT_SECS}" ]]; do
    probe=$(curl_headers_nofollow "${BASE_URL}/studio/login/")
    probe_code=$(echo "${probe}" | awk 'toupper($0) ~ /^HTTP\// {print $2; exit}')
    if [[ "${probe_code}" == "200" ]]; then
      green "Studio login ready after ${waited}s"
      echo ""
      break
    fi
    if [[ "${probe_code}" == "502" || "${probe_code}" == "503" || "${probe_code}" == "000" ]]; then
      yellow "Studio not ready yet (HTTP ${probe_code}); sleeping ${SMOKE_WAIT_INTERVAL}s..."
      sleep "${SMOKE_WAIT_INTERVAL}"
      waited=$((waited + SMOKE_WAIT_INTERVAL))
      continue
    fi
    yellow "Studio returned HTTP ${probe_code}; continuing smoke..."
    break
  done
  if [[ "${waited}" -ge "${SMOKE_WAIT_SECS}" ]]; then
    red "Timed out waiting for Studio after ${SMOKE_WAIT_SECS}s"
    echo "  docker compose ps studio && docker compose logs studio --tail 80"
    exit 1
  fi
fi

# --- 1. API health ---
echo "--- /api/v1/health ---"
HEALTH_META=$(curl_meta "${BASE_URL}/api/v1/health")
HEALTH_CODE="${HEALTH_META%%|*}"
REST="${HEALTH_META#*|}"
HEALTH_REDIRS="${REST%%|*}"
REST="${REST#*|}"
HEALTH_SIZE="${REST%%|*}"
BODY="$(cat /tmp/fg-smoke-body.$$ 2>/dev/null || true)"

if [[ "${HEALTH_CODE}" == "200" ]] && echo "${BODY}" | grep -q '"status"[[:space:]]*:[[:space:]]*"ok"'; then
  pass "API health 200 + status=ok (bytes=${HEALTH_SIZE}, redirects=${HEALTH_REDIRS})"
else
  fail "API health expected 200 + status=ok; got HTTP ${HEALTH_CODE}, body=$(echo "${BODY}" | head -c 200)"
fi

# --- 2. Studio root (unauthenticated → single 307 to login, not empty 200) ---
echo ""
echo "--- /studio/ ---"
STUDIO_HEADERS=$(curl_headers_nofollow "${BASE_URL}/studio/")
STUDIO_NOFOLLOW_CODE=$(echo "${STUDIO_HEADERS}" | awk 'toupper($0) ~ /^HTTP\// {print $2; exit}')
STUDIO_LOC=$(echo "${STUDIO_HEADERS}" | grep -i '^location:' | head -1 | tr -d '\r' || true)

if echo "${STUDIO_LOC}" | grep -qiE 'returnTo=(%2Flogin|/login)'; then
  fail "/studio/ redirect loop signature: ${STUDIO_LOC}"
elif [[ "${STUDIO_NOFOLLOW_CODE}" =~ ^30[78]$ ]]; then
  if echo "${STUDIO_LOC}" | grep -qi '/studio/login'; then
    pass "/studio/ → ${STUDIO_NOFOLLOW_CODE} login redirect (${STUDIO_LOC})"
  else
    fail "/studio/ expected redirect to /studio/login/; got ${STUDIO_NOFOLLOW_CODE} ${STUDIO_LOC}"
  fi
elif [[ "${STUDIO_NOFOLLOW_CODE}" == "200" ]]; then
  # Empty 200 on /studio/ usually means nginx Connection: upgrade bug or stale Studio.
  STUDIO_SIZE=$(curl -sS --max-redirs 0 --max-time "${CURL_TIMEOUT}" -o /tmp/fg-smoke-body.$$ -w '%{size_download}' "${BASE_URL}/studio/" || echo 0)
  STUDIO_BODY="$(cat /tmp/fg-smoke-body.$$ 2>/dev/null || true)"
  if [[ "${STUDIO_SIZE}" -lt 200 ]]; then
    fail "/studio/ returned empty/tiny body (${STUDIO_SIZE} bytes) — reload nginx + rebuild Studio"
  elif ! echo "${STUDIO_BODY}" | grep -qiE '<html|<!doctype'; then
    fail "/studio/ HTTP 200 but not HTML (${STUDIO_SIZE} bytes)"
  else
    pass "/studio/ HTTP 200, HTML ${STUDIO_SIZE} bytes"
  fi
else
  if [[ "${STUDIO_NOFOLLOW_CODE}" == "502" || "${STUDIO_NOFOLLOW_CODE}" == "503" ]]; then
    fail "/studio/ HTTP ${STUDIO_NOFOLLOW_CODE} — Studio still starting or down (retry: ./scripts/smoke-studio.sh --wait)"
  else
    fail "/studio/ unexpected HTTP ${STUDIO_NOFOLLOW_CODE}"
  fi
fi
STUDIO_BODY=""

# --- 3. Studio login ---
echo ""
echo "--- /studio/login/ ---"
LOGIN_HEADERS=$(curl_headers_nofollow "${BASE_URL}/studio/login/")
LOGIN_LOC=$(echo "${LOGIN_HEADERS}" | grep -i '^location:' | head -1 | tr -d '\r' || true)
LOGIN_NOFOLLOW_CODE=$(echo "${LOGIN_HEADERS}" | awk 'toupper($0) ~ /^HTTP\// {print $2; exit}')

# Redirect loop signature seen in the wild: 307 → /studio/login/?returnTo=%2Flogin%2F forever
LOGIN_LOOP=0
if echo "${LOGIN_LOC}" | grep -qiE 'returnTo=(%2Flogin|/login)'; then
  fail "/studio/login/ redirect loop signature: ${LOGIN_LOC}"
  LOGIN_LOOP=1
fi
if [[ "${LOGIN_NOFOLLOW_CODE}" =~ ^30[78]$ ]]; then
  fail "/studio/login/ must be HTTP 200 (public); got ${LOGIN_NOFOLLOW_CODE} ${LOGIN_LOC}"
  LOGIN_LOOP=1
fi

LOGIN_BODY=""
if [[ "${LOGIN_LOOP}" -eq 0 ]]; then
  LOGIN_META=$(
    curl -sS -L --max-redirs "${MAX_REDIRS}" --max-time "${CURL_TIMEOUT}" \
      -o /tmp/fg-smoke-body.$$ \
      -w '%{http_code}|%{num_redirects}|%{size_download}|%{url_effective}|%{content_type}' \
      "${BASE_URL}/studio/login/" 2>/tmp/fg-smoke-err.$$ || true
  )
  LOGIN_CURL_ERR="$(cat /tmp/fg-smoke-err.$$ 2>/dev/null || true)"
  LOGIN_CODE="${LOGIN_META%%|*}"
  REST="${LOGIN_META#*|}"
  LOGIN_REDIRS="${REST%%|*}"
  REST="${REST#*|}"
  LOGIN_SIZE="${REST%%|*}"
  REST="${REST#*|}"
  LOGIN_FINAL="${REST%%|*}"
  LOGIN_BODY="$(cat /tmp/fg-smoke-body.$$ 2>/dev/null || true)"

  if echo "${LOGIN_CURL_ERR}" | grep -qi 'Maximum.*redirects'; then
    fail "/studio/login/ redirect loop (curl max-redirs=${MAX_REDIRS})"
  elif [[ "${LOGIN_REDIRS}" -ge "${MAX_REDIRS}" ]]; then
    fail "/studio/login/ redirected ${LOGIN_REDIRS} times → ${LOGIN_FINAL}"
  elif [[ "${LOGIN_CODE}" != "200" ]]; then
    fail "/studio/login/ expected HTTP 200; got ${LOGIN_CODE} (nofollow=${LOGIN_NOFOLLOW_CODE}) → ${LOGIN_FINAL}"
  elif [[ "${LOGIN_SIZE}" -lt 200 ]]; then
    fail "/studio/login/ empty/tiny body (${LOGIN_SIZE} bytes)"
  elif ! echo "${LOGIN_BODY}" | grep -qiE '<html|<!doctype'; then
    fail "/studio/login/ not HTML (bytes=${LOGIN_SIZE})"
  else
    pass "/studio/login/ HTTP ${LOGIN_CODE}, HTML ${LOGIN_SIZE} bytes, redirects=${LOGIN_REDIRS}"
  fi
fi

# --- 4. Static assets (from HTML if present) ---
echo ""
echo "--- static assets ---"
ASSET_SRC=""
for candidate in "${STUDIO_BODY}" "${LOGIN_BODY}"; do
  if [[ -z "${ASSET_SRC}" ]]; then
    ASSET_SRC="$(printf '%s' "${candidate}" | grep -oE '/studio/_next/static/[^"'\'' >]+' | head -1 || true)"
  fi
done

if [[ -z "${ASSET_SRC}" ]]; then
  # Fallback probe — common Next build id path may 404; treat missing HTML refs as the real signal
  warn "No /studio/_next/static/... references in HTML (cannot verify chunks; empty HTML also causes this)"
else
  ASSET_URL="${BASE_URL}${ASSET_SRC}"
  ASSET_META=$(curl_meta "${ASSET_URL}")
  ASSET_CODE="${ASSET_META%%|*}"
  REST="${ASSET_META#*|}"
  ASSET_REDIRS="${REST%%|*}"
  REST="${REST#*|}"
  ASSET_SIZE="${REST%%|*}"
  if [[ "${ASSET_CODE}" == "200" && "${ASSET_SIZE}" -gt 0 ]]; then
    pass "Static asset ${ASSET_SRC} → HTTP ${ASSET_CODE} (${ASSET_SIZE} bytes)"
  else
    fail "Static asset ${ASSET_SRC} → HTTP ${ASSET_CODE} size=${ASSET_SIZE} (ChunkLoadError risk)"
  fi
fi

# --- 5. Same-origin sanity (no localhost baked into HTML) ---
echo ""
echo "--- same-origin sanity ---"
COMBINED="${STUDIO_BODY}${LOGIN_BODY}"
if echo "${COMBINED}" | grep -qiE 'https?://(127\.0\.0\.1|localhost|host\.docker\.internal)'; then
  fail "HTML references loopback/localhost API — browsers on curator PCs cannot reach it"
else
  pass "No localhost/loopback API URLs spotted in Studio HTML"
fi

# --- 6. Build fingerprint (proves new image was deployed) ---
echo ""
echo "--- build fingerprint ---"
BUILD_HEADERS=$(curl_headers_nofollow "${BASE_URL}/studio/build-id.txt")
BUILD_CODE=$(echo "${BUILD_HEADERS}" | awk 'toupper($0) ~ /^HTTP\// {print $2; exit}')
BUILD_LOC=$(echo "${BUILD_HEADERS}" | grep -i '^location:' | head -1 | tr -d '\r' || true)
if [[ "${BUILD_CODE}" =~ ^30[0-9]$ ]]; then
  fail "build-id.txt redirected (${BUILD_CODE}) ${BUILD_LOC} — middleware/nginx stale; rebuild Studio + reload nginx"
elif [[ "${BUILD_CODE}" == "200" ]]; then
  BUILD_BODY=$(curl -sS --max-redirs 0 --max-time "${CURL_TIMEOUT}" "${BASE_URL}/studio/build-id.txt" 2>/dev/null || true)
  if [[ -n "${BUILD_BODY}" ]]; then
    pass "build-id.txt present: $(echo "${BUILD_BODY}" | head -c 80 | tr -d '\n')"
  else
    fail "build-id.txt HTTP 200 but empty — rebuild Studio with --no-cache"
  fi
else
  fail "build-id.txt missing (HTTP ${BUILD_CODE}) — Studio image is stale; rebuild with --no-cache"
fi

rm -f /tmp/fg-smoke-body.$$ /tmp/fg-smoke-err.$$

echo ""
echo "=== Summary: ${PASS} passed, ${FAIL} failed, ${WARN} warnings ==="
if [[ "${FAIL}" -gt 0 ]]; then
  echo "See docs/deploy-studio.md (Browser smoke test + Automated smoke)."
  exit 1
fi
exit 0
