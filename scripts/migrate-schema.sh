#!/usr/bin/env bash
# Apply idempotent SQL schema patches that create_all() cannot add to existing DBs.
#
# Usage (on server):
#   ./scripts/migrate-schema.sh
#
# Safe to run repeatedly. Never drops tables or wipes data.
set -euo pipefail
cd "$(dirname "$0")/.."

if ! command -v docker >/dev/null 2>&1; then
  echo "✗ docker is required" >&2
  exit 1
fi

if ! docker compose ps --status running --services 2>/dev/null | grep -qx postgres; then
  echo "✗ Container 'postgres' is not running. Start it first:" >&2
  echo "    docker compose up -d postgres" >&2
  echo "    ./scripts/deploy-production.sh" >&2
  exit 1
fi

psql_exec() {
  docker compose exec -T postgres \
    psql -U farmacograph -d farmacograph -v ON_ERROR_STOP=1 "$@"
}

echo "=== FarmacoGraph schema migrate (idempotent) ==="

echo "→ Checking required operational tables..."
REQUIRED_TABLES=(
  users
  user_roles
  demo_access_requests
  api_keys
  audit_logs
  jobs
  outbox_events
  knowledge_snapshots
  curator_workflows
  feature_flags
)

MISSING=0
for table in "${REQUIRED_TABLES[@]}"; do
  exists="$(psql_exec -Atc "SELECT to_regclass('public.${table}') IS NOT NULL;")"
  if [[ "$exists" == "t" ]]; then
    echo "  ✓ table ${table}"
  else
    echo "  ✗ missing table ${table}"
    MISSING=$((MISSING + 1))
  fi
done

if [[ "$MISSING" -gt 0 ]]; then
  echo "→ ${MISSING} table(s) missing — running API init_db (create_all + patches)..."
  if docker compose ps --status running --services 2>/dev/null | grep -qx api; then
    docker compose exec -T api python - <<'PY'
import asyncio
from farmacograph.core.config import get_settings
from farmacograph.db.postgres.session import create_session_factory, init_db

async def main() -> None:
    settings = get_settings()
    _factory, engine = create_session_factory(settings)
    await init_db(engine)
    await engine.dispose()
    print("OK init_db")

asyncio.run(main())
PY
  else
    echo "✗ API container not running; cannot create missing tables via init_db" >&2
    echo "  Run: ./scripts/deploy-production.sh" >&2
    exit 1
  fi
fi

echo "→ Ensuring curator_workflows.draft_package_json (Sprint 4/5 draft persistence)..."
BEFORE="$(psql_exec -Atc "SELECT COUNT(*) FROM information_schema.columns WHERE table_name='curator_workflows' AND column_name='draft_package_json';")"
psql_exec <<'SQL'
ALTER TABLE curator_workflows
  ADD COLUMN IF NOT EXISTS draft_package_json JSONB;
SQL
AFTER="$(psql_exec -Atc "SELECT COUNT(*) FROM information_schema.columns WHERE table_name='curator_workflows' AND column_name='draft_package_json';")"

if [[ "$BEFORE" == "0" && "$AFTER" == "1" ]]; then
  echo "  ✓ added column curator_workflows.draft_package_json"
elif [[ "$AFTER" == "1" ]]; then
  echo "  ✓ column curator_workflows.draft_package_json already present (no-op)"
else
  echo "  ✗ failed to ensure draft_package_json" >&2
  exit 1
fi

echo "→ Ensuring curator_workflows unpublish-request columns..."
psql_exec <<'SQL'
ALTER TABLE curator_workflows
  ADD COLUMN IF NOT EXISTS unpublish_requested_at TIMESTAMPTZ,
  ADD COLUMN IF NOT EXISTS unpublish_requested_by UUID,
  ADD COLUMN IF NOT EXISTS unpublish_request_notes TEXT;
SQL
for col in unpublish_requested_at unpublish_requested_by unpublish_request_notes; do
  present="$(psql_exec -Atc "SELECT COUNT(*) FROM information_schema.columns WHERE table_name='curator_workflows' AND column_name='${col}';")"
  if [[ "$present" == "1" ]]; then
    echo "  ✓ column curator_workflows.${col}"
  else
    echo "  ✗ missing column curator_workflows.${col}" >&2
    exit 1
  fi
done

echo "→ Spot-checking other curator/auth columns..."
psql_exec -Atc "
SELECT column_name
FROM information_schema.columns
WHERE table_name = 'curator_workflows'
ORDER BY ordinal_position;
" | while read -r col; do
  echo "  · curator_workflows.${col}"
done

echo ""
echo "✓ Schema migrate complete (non-destructive)"
echo "  Optional full Alembic: docker compose exec api alembic upgrade head"
echo "  Next: ./scripts/create-curator.sh --email curator@farmacograph.local"
