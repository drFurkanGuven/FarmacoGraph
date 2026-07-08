#!/usr/bin/env bash
# Apply pending SQL schema patches that create_all() cannot add to existing DBs.
#
# Usage (on server):
#   ./scripts/migrate-schema.sh
set -euo pipefail
cd "$(dirname "$0")/.."

echo "→ Ensuring curator_workflows.draft_package_json exists..."
docker compose exec -T postgres psql -U farmacograph -d farmacograph -v ON_ERROR_STOP=1 <<'SQL'
ALTER TABLE curator_workflows
  ADD COLUMN IF NOT EXISTS draft_package_json JSONB;
SQL

echo "✓ Schema patch applied"
echo "  Optional: docker compose exec api alembic upgrade head"
