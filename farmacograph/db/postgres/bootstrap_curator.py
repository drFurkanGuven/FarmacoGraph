"""Production curator bootstrap helpers — used by scripts/create-curator.sh."""

from __future__ import annotations

from typing import Any

from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession, async_sessionmaker

from farmacograph.auth.models import hash_password
from farmacograph.db.postgres.models import User, UserRole

CURATOR_SCOPES: list[str] = [
    "knowledge:read",
    "knowledge:search",
    "knowledge:explain",
    "education:read",
    "curator:write",
    "curator:publish",
]


async def upsert_curator(
    session_factory: async_sessionmaker[AsyncSession],
    *,
    email: str,
    password: str,
    full_name: str = "FarmacoGraph Curator",
    scopes: list[str] | None = None,
) -> dict[str, Any]:
    """Create or update a curator user. Idempotent.

    Returns ``{"action": "created"|"updated", "email": ...}``.
    Does not log or return the plaintext password.
    """
    normalized = email.strip().lower()
    if not normalized or "@" not in normalized:
        raise ValueError("email must be a non-empty address")
    if len(password) < 12:
        raise ValueError("password must be at least 12 characters")

    role_scopes = list(scopes or CURATOR_SCOPES)

    async with session_factory() as session:
        existing = (
            await session.execute(select(User).where(User.email == normalized))
        ).scalar_one_or_none()

        if existing is None:
            user = User(
                email=normalized,
                hashed_password=hash_password(password),
                full_name=full_name,
                is_active=True,
            )
            session.add(user)
            await session.flush()
            session.add(UserRole(user=user, role="curator", scopes=role_scopes))
            action = "created"
        else:
            existing.hashed_password = hash_password(password)
            existing.full_name = full_name
            existing.is_active = True
            roles = (
                (await session.execute(select(UserRole).where(UserRole.user_id == existing.id)))
                .scalars()
                .all()
            )
            if not roles:
                session.add(UserRole(user=existing, role="curator", scopes=role_scopes))
            else:
                for role in roles:
                    role.role = "curator"
                    role.scopes = role_scopes
            action = "updated"

        await session.commit()

    return {"action": action, "email": normalized, "scopes": role_scopes}
