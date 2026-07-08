#!/usr/bin/env bash
# FarmacoGraph Studio production smoke checks (HTTP-level).
#
# Usage:
#   ./scripts/smoke-studio.sh
#   ./scripts/smoke-studio.sh https://farmacograph.furkanguven.space
#   FG_PUBLIC_URL=https://example.com ./scripts/smoke-studio.sh
#
# Exit 0 = all checks passed. Exit 1 = one or more failures.
# Does not log in, does not print secrets, does not hit localhost by default.

set -euo pipefail

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

# --- 2. Studio root ---
echo ""
echo "--- /studio/ ---"
STUDIO_HEADERS=$(curl_headers_nofollow "${BASE_URL}/studio/")
STUDIO_META=$(curl_meta "${BASE_URL}/studio/")
STUDIO_CODE="${STUDIO_META%%|*}"
REST="${STUDIO_META#*|}"
STUDIO_REDIRS="${REST%%|*}"
REST="${REST#*|}"
STUDIO_SIZE="${REST%%|*}"
REST="${REST#*|}"
STUDIO_FINAL="${REST%%|*}"
STUDIO_CT="${REST#*|}"
STUDIO_BODY="$(cat /tmp/fg-smoke-body.$$ 2>/dev/null || true)"

if echo "${STUDIO_HEADERS}" | grep -qiE '^HTTP/[^ ]+ 3[0-9]{2}'; then
  LOC=$(echo "${STUDIO_HEADERS}" | grep -i '^location:' | head -1 | tr -d '\r')
  # Single hop to login is OK; loop (returnTo=/login) is not.
  if echo "${LOC}" | grep -qiE 'returnTo=(%2Flogin|/login)'; then
    fail "/studio/ redirect loop signature: ${LOC}"
  elif echo "${LOC}" | grep -qi '/studio/login'; then
    if echo "${LOC}" | grep -qiE 'returnTo=%2F($|&)'; then
      pass "/studio/ redirects to login with returnTo=/ (${LOC})"
    else
      pass "/studio/ redirects toward login (${LOC})"
    fi
  else
    warn "/studio/ redirects (${LOC})"
  fi
fi

if [[ "${STUDIO_REDIRS}" -ge "${MAX_REDIRS}" ]]; then
  fail "/studio/ redirected ${STUDIO_REDIRS} times (possible redirect loop) → ${STUDIO_FINAL}"
elif [[ "${STUDIO_CODE}" != "200" ]]; then
  fail "/studio/ expected HTTP 200 after redirects; got ${STUDIO_CODE} → ${STUDIO_FINAL}"
elif [[ "${STUDIO_SIZE}" -lt 200 ]]; then
  fail "/studio/ returned empty/tiny body (${STUDIO_SIZE} bytes) — white screen likely (HTML never served)"
elif ! echo "${STUDIO_BODY}" | grep -qiE '<html|<!doctype'; then
  fail "/studio/ HTTP ${STUDIO_CODE} but response is not HTML (ct=${STUDIO_CT}, bytes=${STUDIO_SIZE})"
else
  pass "/studio/ HTTP ${STUDIO_CODE}, HTML ${STUDIO_SIZE} bytes, redirects=${STUDIO_REDIRS}"
fi

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
BUILD_META=$(curl_meta "${BASE_URL}/studio/build-id.txt")
BUILD_CODE="${BUILD_META%%|*}"
BUILD_BODY="$(cat /tmp/fg-smoke-body.$$ 2>/dev/null || true)"
if [[ "${BUILD_CODE}" == "200" && -n "${BUILD_BODY}" ]]; then
  pass "build-id.txt present: $(echo "${BUILD_BODY}" | head -c 80 | tr -d '\n')"
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
