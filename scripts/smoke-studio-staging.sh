#!/usr/bin/env bash
# Staging-only authenticated Studio smoke (read-only curator flows).
#
# Usage:
#   FG_SMOKE_EMAIL=curator@example.com FG_SMOKE_PASSWORD='...' \
#     ./scripts/smoke-studio-staging.sh https://staging.example.com
#
# Never run against production unless you explicitly intend to.
set -euo pipefail

BASE_URL="${1:-${FG_PUBLIC_URL:-}}"
EMAIL="${FG_SMOKE_EMAIL:-}"
PASSWORD="${FG_SMOKE_PASSWORD:-}"
TIMEOUT="${SMOKE_TIMEOUT:-20}"

if [[ -z "${BASE_URL}" ]]; then
  echo "✗ Missing base URL (arg or FG_PUBLIC_URL)" >&2
  exit 1
fi
if [[ -z "${EMAIL}" || -z "${PASSWORD}" ]]; then
  echo "✗ Set FG_SMOKE_EMAIL and FG_SMOKE_PASSWORD" >&2
  exit 1
fi

BASE_URL="${BASE_URL%/}"
TOKEN_JSON=$(curl -sS --max-time "${TIMEOUT}" -X POST "${BASE_URL}/api/v1/auth/token" \
  -H "Content-Type: application/json" \
  -d "{\"email\":\"${EMAIL}\",\"password\":\"${FG_SMOKE_PASSWORD}\"}" \
  2>/dev/null || true)
unset FG_SMOKE_PASSWORD

ACCESS_TOKEN=$(python3 -c 'import json,sys; print(json.load(sys.stdin).get("data",{}).get("access_token",""))' <<<"${TOKEN_JSON}" 2>/dev/null || true)
if [[ -z "${ACCESS_TOKEN}" ]]; then
  echo "FAIL  auth/token did not return access_token" >&2
  exit 1
fi
echo "PASS  auth/token"

DASH_CODE=$(curl -sS -o /dev/null -w '%{http_code}' --max-time "${TIMEOUT}" \
  -H "Authorization: Bearer ${ACCESS_TOKEN}" \
  "${BASE_URL}/api/v1/dashboard?module=cardiovascular")
if [[ "${DASH_CODE}" == "200" ]]; then
  echo "PASS  dashboard 200"
else
  echo "FAIL  dashboard HTTP ${DASH_CODE}" >&2
  exit 1
fi

DISEASE_CODE=$(curl -sS -o /dev/null -w '%{http_code}' --max-time "${TIMEOUT}" \
  -H "Authorization: Bearer ${ACCESS_TOKEN}" \
  "${BASE_URL}/api/v1/curator/diseases?limit=5")
if [[ "${DISEASE_CODE}" == "200" ]]; then
  echo "PASS  curator/diseases 200"
else
  echo "FAIL  curator/diseases HTTP ${DISEASE_CODE}" >&2
  exit 1
fi

echo "=== Staging smoke passed ==="
