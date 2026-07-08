#!/usr/bin/env bash
# Publish cardiovascular structural stub via curator API (pipeline test).
set -euo pipefail

ROOT="$(cd "$(dirname "$0")/.." && pwd)"
# shellcheck source=scripts/lib/api.sh
source "$ROOT/scripts/lib/api.sh"

BASE="${FG_API_URL:-http://127.0.0.1:8001}"
ENTITY_ID="00000000-0000-4000-8000-000000000001"

echo "→ API: $BASE"

if ! curl -sf "$BASE/api/v1/health" >/dev/null; then
  echo "ERROR: API not reachable at $BASE" >&2
  echo "  docker compose ps" >&2
  exit 1
fi

INFO=$(curl_json GET "$BASE/api/v1/info")
COUNT=$(echo "$INFO" | python3 -c "import sys,json; d=json.load(sys.stdin)['data']; print(d.get('published_drugs', 'missing'))" 2>/dev/null || echo 0)
if [[ "$COUNT" != "0" && "$COUNT" != "missing" ]]; then
  echo "→ Already $COUNT published drug(s) in graph."
  curl_json GET "$BASE/api/v1/search?q=structural" | python3 -m json.tool
  exit 0
fi

echo "→ No published drugs yet — publishing structural stub..."

echo "→ Fetch stub package..."
STUB=$(curl_json GET "$BASE/api/v1/curator/stubs/cardiovascular")
PACKAGE=$(echo "$STUB" | python3 -c "import sys,json; print(json.dumps(json.load(sys.stdin)['data']))")

echo "→ Create workflow..."
WF=$(curl_json POST "$BASE/api/v1/curator/workflows" \
  "{\"entity_id\":\"$ENTITY_ID\",\"entity_type\":\"Drug\",\"notes\":\"structural stub publish script\"}" \
  | python3 -c "import sys,json; print(json.load(sys.stdin)['data']['id'])")
echo "   workflow: $WF"

echo "→ Submit → approve → publish..."
curl_json POST "$BASE/api/v1/curator/workflows/$WF/submit" >/dev/null
curl_json POST "$BASE/api/v1/curator/workflows/$WF/approve" >/dev/null
RESULT=$(curl_json POST "$BASE/api/v1/curator/workflows/$WF/publish" "$PACKAGE")
STATE=$(echo "$RESULT" | python3 -c "import sys,json; print(json.load(sys.stdin)['data']['state'])")
echo "   state: $STATE"

echo "→ Verify..."
curl_json GET "$BASE/api/v1/drugs?module=cardiovascular" | python3 -m json.tool | head -25
echo ""
curl_json GET "$BASE/api/v1/search?q=structural" | python3 -m json.tool
echo ""
echo "✓ Done. Next: ./scripts/bootstrap-cv.sh or publish real drugs with ./scripts/publish-drug.sh"

