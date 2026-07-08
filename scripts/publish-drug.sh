#!/usr/bin/env bash
# Publish a curator drug package JSON via API workflow.
# Usage: ./scripts/publish-drug.sh staging/cardiovascular/drugs/metoprolol.json [--mark-curriculum]
set -euo pipefail

ROOT="$(cd "$(dirname "$0")/.." && pwd)"
# shellcheck source=scripts/lib/api.sh
source "$ROOT/scripts/lib/api.sh"
export PYTHONPATH="${ROOT}${PYTHONPATH:+:$PYTHONPATH}"

BASE="${FG_API_URL:-http://127.0.0.1:8001}"
MARK_CURRICULUM=0
PACKAGE_FILE=""

for arg in "$@"; do
  case "$arg" in
    --mark-curriculum) MARK_CURRICULUM=1 ;;
    -*) echo "Unknown flag: $arg" >&2; exit 1 ;;
    *) PACKAGE_FILE="$arg" ;;
  esac
done

if [[ -z "$PACKAGE_FILE" ]]; then
  echo "Usage: $0 <package.json> [--mark-curriculum]" >&2
  exit 1
fi
if [[ ! -f "$PACKAGE_FILE" ]]; then
  echo "ERROR: file not found: $PACKAGE_FILE" >&2
  exit 1
fi

echo "→ Validate package locally..."
if ! python3 -c "
from farmacograph.curator.drug_package import validate_package_file
r = validate_package_file('''$PACKAGE_FILE''')
if not r.valid:
    for i in r.errors[:10]:
        print(f'  [{i.constraint_id or i.level}] {i.message}')
    raise SystemExit(1)
print('  valid')
"; then
  REL="${PACKAGE_FILE#$ROOT/}"
  echo "  (retry in api container: /app/$REL)"
  docker compose -f "$ROOT/docker-compose.yml" exec -T api python -c "
from farmacograph.curator.drug_package import validate_package_file
r = validate_package_file('/app/$REL')
if not r.valid:
    for i in r.errors[:10]:
        print(f'  [{i.constraint_id or i.level}] {i.message}')
    raise SystemExit(1)
print('  valid')
" || exit 1
fi

ENTITY_ID=$(python3 -c "import json; print(json.load(open('$PACKAGE_FILE'))['entity_payload']['id'])")
SLUG=$(python3 -c "import json; print(json.load(open('$PACKAGE_FILE'))['entity_payload']['slug'])")
PACKAGE=$(python3 -c "import json; print(json.dumps(json.load(open('$PACKAGE_FILE'))))")

echo "→ API: $BASE"
echo "→ Drug: $SLUG ($ENTITY_ID)"

if ! curl -sf "$BASE/api/v1/health" >/dev/null; then
  echo "ERROR: API not reachable at $BASE" >&2
  exit 1
fi

echo "→ Create workflow..."
WF=$(curl_json POST "$BASE/api/v1/curator/workflows" \
  "{\"entity_id\":\"$ENTITY_ID\",\"entity_type\":\"Drug\",\"notes\":\"publish-drug.sh $SLUG\"}" \
  | python3 -c "import sys,json; print(json.load(sys.stdin)['data']['id'])")
echo "   workflow: $WF"

echo "→ Submit → approve → publish..."
curl_json POST "$BASE/api/v1/curator/workflows/$WF/submit" >/dev/null
curl_json POST "$BASE/api/v1/curator/workflows/$WF/approve" >/dev/null
RESULT=$(curl_json POST "$BASE/api/v1/curator/workflows/$WF/publish" "$PACKAGE")
STATE=$(echo "$RESULT" | python3 -c "import sys,json; print(json.load(sys.stdin)['data']['state'])")
echo "   state: $STATE"

echo "→ Verify search..."
curl_json GET "$BASE/api/v1/search?q=$SLUG" | python3 -m json.tool | head -20

if [[ "$MARK_CURRICULUM" -eq 1 ]]; then
  echo "→ Mark curriculum published: $SLUG"
  python3 -c "
from farmacograph.curator.drug_package import mark_curriculum_published
ok = mark_curriculum_published('$SLUG')
print('  updated' if ok else '  already published or slug missing')
"
fi

echo "✓ Published $SLUG"
