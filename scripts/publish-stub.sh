#!/usr/bin/env bash
# Publish cardiovascular structural stub via curator API (pipeline test).
set -euo pipefail

BASE="${FG_API_URL:-http://127.0.0.1:8001}"
ENTITY_ID="00000000-0000-4000-8000-000000000001"

echo "→ API: $BASE"

if ! curl -sf "$BASE/api/v1/health" >/dev/null; then
  echo "ERROR: API not reachable at $BASE" >&2
  exit 1
fi

echo "→ Fetch stub package..."
PACKAGE=$(curl -sf "$BASE/api/v1/curator/stubs/cardiovascular" | python3 -c "import sys,json; print(json.dumps(json.load(sys.stdin)['data']))")

echo "→ Create workflow..."
WF=$(curl -sf -X POST "$BASE/api/v1/curator/workflows" \
  -H "Content-Type: application/json" \
  -d "{\"entity_id\":\"$ENTITY_ID\",\"entity_type\":\"Drug\",\"notes\":\"structural stub publish script\"}" \
  | python3 -c "import sys,json; print(json.load(sys.stdin)['data']['id'])")
echo "   workflow: $WF"

echo "→ Submit → approve → publish..."
curl -sf -X POST "$BASE/api/v1/curator/workflows/$WF/submit" >/dev/null
curl -sf -X POST "$BASE/api/v1/curator/workflows/$WF/approve" >/dev/null
RESULT=$(curl -sf -X POST "$BASE/api/v1/curator/workflows/$WF/publish" \
  -H "Content-Type: application/json" \
  -d "$PACKAGE")
STATE=$(echo "$RESULT" | python3 -c "import sys,json; print(json.load(sys.stdin)['data']['state'])")
echo "   state: $STATE"

echo "→ Verify..."
curl -sf "$BASE/api/v1/drugs?module=cardiovascular" | python3 -m json.tool | head -20
echo ""
curl -sf "$BASE/api/v1/search?q=structural" | python3 -m json.tool
echo ""
echo "✓ Done. Try: $BASE/search?q=structural (or public URL /search)"
