#!/usr/bin/env bash
# Promote an existing Studio user to administrator (admin:org).
#
# Usage (on server, from repo root):
#   ./scripts/promote-admin.sh --email curator@farmacograph.local
#   ./scripts/promote-admin.sh --email you@example.com --password 'OptionalNewPass12'
#
# After promote: sign out / private window and sign in again so the JWT picks up admin:org.
# Administrators can unpublish (edit) and deprecate (soft-delete) published workflows.
set -euo pipefail
cd "$(dirname "$0")/.."

EMAIL="${FG_ADMIN_EMAIL:-}"
PASSWORD="${FG_ADMIN_PASSWORD:-}"
NAME="${FG_ADMIN_NAME:-}"

while [[ $# -gt 0 ]]; do
  case "$1" in
    --email=*) EMAIL="${1#*=}" ;;
    --email) shift; EMAIL="${1:?--email requires a value}" ;;
    --password=*) PASSWORD="${1#*=}" ;;
    --password) shift; PASSWORD="${1:?--password requires a value}" ;;
    --name=*) NAME="${1#*=}" ;;
    --name) shift; NAME="${1:?--name requires a value}" ;;
    -h|--help)
      sed -n '2,12p' "$0" | sed 's/^# \{0,1\}//'
      exit 0
      ;;
    *)
      echo "Unknown option: $1 (try --help)" >&2
      exit 1
      ;;
  esac
  shift
done

if [[ -z "$EMAIL" || "$EMAIL" != *"@"* ]]; then
  echo "✗ Missing/invalid --email" >&2
  exit 1
fi

if [[ -n "$PASSWORD" && ${#PASSWORD} -lt 12 ]]; then
  echo "✗ Password must be at least 12 characters" >&2
  exit 1
fi

if ! command -v docker >/dev/null 2>&1; then
  echo "✗ docker is required" >&2
  exit 1
fi

if ! docker compose ps --status running --services 2>/dev/null | grep -qx api; then
  echo "✗ Container 'api' is not running." >&2
  exit 1
fi

echo "→ Promoting ${EMAIL} to administrator..."

set +e
RESULT="$(
  docker compose exec -T \
    -e FG_BOOTSTRAP_EMAIL="$EMAIL" \
    -e FG_BOOTSTRAP_PASSWORD="${PASSWORD:-}" \
    -e FG_BOOTSTRAP_NAME="${NAME:-}" \
    api python - <<'PY' 2>&1
import asyncio
import os
import sys

from farmacograph.core.config import get_settings
from farmacograph.db.postgres.bootstrap_curator import promote_to_administrator
from farmacograph.db.postgres.session import create_session_factory, init_db

EMAIL = os.environ["FG_BOOTSTRAP_EMAIL"]
PASSWORD = os.environ.get("FG_BOOTSTRAP_PASSWORD") or None
NAME = os.environ.get("FG_BOOTSTRAP_NAME") or None


async def main() -> None:
    settings = get_settings()
    factory, engine = create_session_factory(settings)
    await init_db(engine)
    try:
        result = await promote_to_administrator(
            factory,
            email=EMAIL,
            password=PASSWORD,
            full_name=NAME,
        )
        print(f"OK admin {result['action']}: {result['email']}")
        print(f"role={result['role']}")
        print("scopes=" + ",".join(result["scopes"]))
    finally:
        await engine.dispose()


try:
    asyncio.run(main())
except Exception as exc:  # noqa: BLE001
    print(f"ERROR: {exc}", file=sys.stderr)
    raise SystemExit(1) from exc
PY
)"
RC=$?
set -e

SAFE_RESULT="$(printf '%s\n' "$RESULT" | grep -E '^(OK admin|role=|scopes=|ERROR:)' || true)"

if [[ "$RC" -ne 0 ]]; then
  echo "✗ Admin promote failed" >&2
  printf '%s\n' "$SAFE_RESULT" >&2
  exit 1
fi

echo ""
echo "✓ Administrator ready"
printf '%s\n' "$SAFE_RESULT" | sed 's/^/  /'
echo ""
echo "Sign out of Studio (or use a private window), then sign in again."
echo "Published records: Unpublish to edit · Deprecate to soft-delete."
