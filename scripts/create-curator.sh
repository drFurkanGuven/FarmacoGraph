#!/usr/bin/env bash
# Create or reset a production curator in PostgreSQL (runs inside the API container).
#
# Usage (on server, from repo root):
#   ./scripts/create-curator.sh --email curator@farmacograph.local
#   ./scripts/create-curator.sh --email curator@farmacograph.local --password 'StrongPass123!'
#   ./scripts/create-curator.sh --email curator@farmacograph.local --name 'FarmacoGraph Curator'
#
# If --password is omitted, the script prompts securely (input is not echoed).
# The password is never printed.
#
# Then sign in at https://farmacograph.furkanguven.space/studio/login/
set -euo pipefail
cd "$(dirname "$0")/.."

EMAIL="${FG_CURATOR_EMAIL:-}"
PASSWORD="${FG_CURATOR_PASSWORD:-}"
NAME="${FG_CURATOR_NAME:-FarmacoGraph Curator}"

while [[ $# -gt 0 ]]; do
  case "$1" in
    --email=*) EMAIL="${1#*=}" ;;
    --email) shift; EMAIL="${1:?--email requires a value}" ;;
    --password=*) PASSWORD="${1#*=}" ;;
    --password) shift; PASSWORD="${1:?--password requires a value}" ;;
    --name=*) NAME="${1#*=}" ;;
    --name) shift; NAME="${1:?--name requires a value}" ;;
    -h|--help)
      sed -n '2,14p' "$0" | sed 's/^# \{0,1\}//'
      exit 0
      ;;
    *)
      echo "Unknown option: $1 (try --help)" >&2
      exit 1
      ;;
  esac
  shift
done

if [[ -z "$EMAIL" ]]; then
  echo "✗ Missing --email (example: --email curator@farmacograph.local)" >&2
  exit 1
fi

if [[ "$EMAIL" != *"@"* ]]; then
  echo "✗ Invalid email: ${EMAIL}" >&2
  exit 1
fi

if [[ -z "$PASSWORD" ]]; then
  if [[ ! -t 0 ]]; then
    echo "✗ Password required: pass --password or run interactively to be prompted" >&2
    exit 1
  fi
  read -r -s -p "Curator password (min 12 chars): " PASSWORD
  echo ""
  read -r -s -p "Confirm password: " PASSWORD_CONFIRM
  echo ""
  if [[ "$PASSWORD" != "$PASSWORD_CONFIRM" ]]; then
    echo "✗ Passwords do not match" >&2
    exit 1
  fi
fi

if [[ ${#PASSWORD} -lt 12 ]]; then
  echo "✗ Password must be at least 12 characters" >&2
  exit 1
fi

if ! command -v docker >/dev/null 2>&1; then
  echo "✗ docker is required" >&2
  exit 1
fi

if ! docker compose ps --status running --services 2>/dev/null | grep -qx api; then
  echo "✗ Container 'api' is not running. Start the stack first:" >&2
  echo "    ./scripts/deploy-production.sh" >&2
  exit 1
fi

if ! docker compose ps --status running --services 2>/dev/null | grep -qx postgres; then
  echo "✗ Container 'postgres' is not running." >&2
  exit 1
fi

echo "→ Creating/updating curator ${EMAIL} via farmacograph-api..."

set +e
RESULT="$(
  docker compose exec -T \
    -e FG_BOOTSTRAP_EMAIL="$EMAIL" \
    -e FG_BOOTSTRAP_PASSWORD="$PASSWORD" \
    -e FG_BOOTSTRAP_NAME="$NAME" \
    api python - <<'PY' 2>&1
import asyncio
import os
import sys

from farmacograph.core.config import get_settings
from farmacograph.db.postgres.bootstrap_curator import upsert_curator
from farmacograph.db.postgres.session import create_session_factory, init_db

EMAIL = os.environ["FG_BOOTSTRAP_EMAIL"]
PASSWORD = os.environ["FG_BOOTSTRAP_PASSWORD"]
NAME = os.environ.get("FG_BOOTSTRAP_NAME") or "FarmacoGraph Curator"


async def main() -> None:
    settings = get_settings()
    factory, engine = create_session_factory(settings)
    await init_db(engine)
    try:
        result = await upsert_curator(
            factory,
            email=EMAIL,
            password=PASSWORD,
            full_name=NAME,
        )
        # Never print the password.
        print(f"OK curator {result['action']}: {result['email']}")
        print("scopes=" + ",".join(result["scopes"]))
    finally:
        await engine.dispose()


try:
    asyncio.run(main())
except Exception as exc:  # noqa: BLE001 — surface to shell
    print(f"ERROR: {exc}", file=sys.stderr)
    raise SystemExit(1) from exc
PY
)"
RC=$?
set -e

# Never echo raw RESULT if it could contain secrets from unrelated tooling noise.
SAFE_RESULT="$(printf '%s\n' "$RESULT" | grep -E '^(OK curator|scopes=|ERROR:)' || true)"

if [[ "$RC" -ne 0 ]]; then
  echo "✗ Curator bootstrap failed" >&2
  printf '%s\n' "$SAFE_RESULT" >&2
  exit 1
fi

echo ""
echo "✓ Curator ready"
printf '%s\n' "$SAFE_RESULT" | sed 's/^/  /'
echo "  Name:  ${NAME}"
echo ""
echo "Sign in: https://farmacograph.furkanguven.space/studio/login/"
echo "Password was not printed. Use the password you entered (or --password)."
echo "If an old JWT still 401s after FG_JWT_SECRET_KEY rotation, use a private window."
