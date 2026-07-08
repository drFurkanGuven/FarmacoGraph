#!/usr/bin/env bash
# Create or reset a production curator in PostgreSQL (runs inside the API container).
#
# Usage (on server, from repo root):
#   ./scripts/create-curator.sh
#   ./scripts/create-curator.sh --email you@example.com --password 'StrongPass123!'
#   FG_CURATOR_EMAIL=you@example.com FG_CURATOR_PASSWORD='...' ./scripts/create-curator.sh
#
# Then sign in at https://farmacograph.furkanguven.space/studio/login/
set -euo pipefail
cd "$(dirname "$0")/.."

EMAIL="${FG_CURATOR_EMAIL:-curator@farmacograph.local}"
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
      sed -n '2,10p' "$0" | sed 's/^# \{0,1\}//'
      exit 0
      ;;
    *)
      echo "Unknown option: $1 (try --help)" >&2
      exit 1
      ;;
  esac
  shift
done

if [[ -z "$PASSWORD" ]]; then
  if command -v openssl >/dev/null 2>&1; then
    PASSWORD="$(openssl rand -base64 18 | tr -d '/+=' | head -c 24)"
  else
    PASSWORD="$(python3 -c 'import secrets; print(secrets.token_urlsafe(18))')"
  fi
  GENERATED=true
else
  GENERATED=false
fi

if [[ ${#PASSWORD} -lt 12 ]]; then
  echo "Password must be at least 12 characters" >&2
  exit 1
fi

echo "→ Creating/updating curator ${EMAIL} in farmacograph-api container..."

docker compose exec -T \
  -e FG_BOOTSTRAP_EMAIL="$EMAIL" \
  -e FG_BOOTSTRAP_PASSWORD="$PASSWORD" \
  -e FG_BOOTSTRAP_NAME="$NAME" \
  api python - <<'PY'
import asyncio
import os

from sqlalchemy import select

from farmacograph.auth.models import hash_password
from farmacograph.core.config import get_settings
from farmacograph.db.postgres.models import User, UserRole
from farmacograph.db.postgres.session import create_session_factory, init_db

EMAIL = os.environ["FG_BOOTSTRAP_EMAIL"].strip().lower()
PASSWORD = os.environ["FG_BOOTSTRAP_PASSWORD"]
NAME = os.environ.get("FG_BOOTSTRAP_NAME") or "FarmacoGraph Curator"

SCOPES = [
    "knowledge:read",
    "knowledge:search",
    "knowledge:explain",
    "education:read",
    "curator:write",
    "curator:publish",
]


async def main() -> None:
    settings = get_settings()
    factory, engine = create_session_factory(settings)
    await init_db(engine)
    try:
        async with factory() as session:
            existing = (
                await session.execute(select(User).where(User.email == EMAIL))
            ).scalar_one_or_none()
            if existing is None:
                user = User(
                    email=EMAIL,
                    hashed_password=hash_password(PASSWORD),
                    full_name=NAME,
                    is_active=True,
                )
                session.add(user)
                await session.flush()
                session.add(UserRole(user=user, role="curator", scopes=SCOPES))
                action = "created"
            else:
                existing.hashed_password = hash_password(PASSWORD)
                existing.full_name = NAME
                existing.is_active = True
                roles = (
                    await session.execute(
                        select(UserRole).where(UserRole.user_id == existing.id)
                    )
                ).scalars().all()
                if not roles:
                    session.add(UserRole(user=existing, role="curator", scopes=SCOPES))
                else:
                    for role in roles:
                        role.role = "curator"
                        role.scopes = SCOPES
                action = "updated"
            await session.commit()
        print(f"OK curator {action}: {EMAIL}")
    finally:
        await engine.dispose()


asyncio.run(main())
PY

echo ""
echo "✓ Curator ready"
echo "  Email:    ${EMAIL}"
if [[ "$GENERATED" == true ]]; then
  echo "  Password: ${PASSWORD}"
  echo "  (generated — save it now; it will not be shown again)"
else
  echo "  Password: (as provided)"
fi
echo ""
echo "Sign in: https://farmacograph.furkanguven.space/studio/login/"
echo "If an old session 401s, clear site data for this origin or use a private window."
