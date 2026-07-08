#!/usr/bin/env bash
# Bootstrap cardiovascular module: structural stub + show curation queue.
set -euo pipefail

ROOT="$(cd "$(dirname "$0")/.." && pwd)"
BASE="${FG_API_URL:-http://127.0.0.1:8001}"
export PYTHONPATH="${ROOT}${PYTHONPATH:+:$PYTHONPATH}"

echo "=== FarmacoGraph CV bootstrap ==="
echo ""

"$ROOT/scripts/publish-stub.sh"

echo ""
echo "=== Curation queue ==="
python3 -c "
from farmacograph.curator.drug_package import curriculum_stats, list_pending_drugs, load_curriculum
stats = curriculum_stats(load_curriculum())
print(f\"Module: {stats['module']}  dataset: {stats['dataset_version']}\")
print(f\"Progress: {stats['by_status'].get('published', 0)}/{stats['total_slugs']} published\")
print()
print('Next pending drugs:')
for row in list_pending_drugs(limit=8):
    pkg = 'ready' if row['package_exists'] else 'no JSON yet'
    print(f\"  - {row['slug']:22} [{row['category']}] ({pkg})\")
"

echo ""
echo "=== Plan ==="
echo "1. Curator fills staging/cardiovascular/drugs/SLUG.json (start: metoprolol)"
echo "2. Validate:  python3 -m farmacograph validate-package -i staging/.../SLUG.json"
echo "3. Publish:   ./scripts/publish-drug.sh staging/.../SLUG.json --mark-curriculum"
echo "4. New entry: python3 -m farmacograph init-drug-entry --slug propranolol"
echo ""
echo "Search: $BASE/search?q=structural (stub) then ?q=metoprolol after first real drug"
