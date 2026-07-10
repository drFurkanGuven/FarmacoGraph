"""Production curator / administrator bootstrap helpers."""

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

ADMIN_SCOPES: list[str] = [
    *CURATOR_SCOPES,
    "graph:query",
    "admin:org",
    "admin:api_keys",
]


async def upsert_curator(
    session_factory: async_sessionmaker[AsyncSession],
    *,
    email: str,
    password: str,
    full_name: str = "FarmacoGraph Curator",
    scopes: list[str] | None = None,
    role: str = "curator",
) -> dict[str, Any]:
    """Create or update a curator/admin user. Idempotent.

    Returns ``{"action": "created"|"updated", "email": ..., "role": ..., "scopes": ...}``.
    Does not log or return the plaintext password.
    """
    normalized = email.strip().lower()
    if not normalized or "@" not in normalized:
        raise ValueError("email must be a non-empty address")
    if len(password) < 12:
        raise ValueError("password must be at least 12 characters")

    role_name = role.strip() or "curator"
    role_scopes = list(scopes or (ADMIN_SCOPES if role_name == "administrator" else CURATOR_SCOPES))

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
                is_superuser=role_name == "administrator",
            )
            session.add(user)
            await session.flush()
            session.add(UserRole(user=user, role=role_name, scopes=role_scopes))
            action = "created"
        else:
            existing.hashed_password = hash_password(password)
            existing.full_name = full_name
            existing.is_active = True
            existing.is_superuser = role_name == "administrator"
            roles = (
                (await session.execute(select(UserRole).where(UserRole.user_id == existing.id)))
                .scalars()
                .all()
            )
            if not roles:
                session.add(UserRole(user=existing, role=role_name, scopes=role_scopes))
            else:
                for user_role in roles:
                    user_role.role = role_name
                    user_role.scopes = role_scopes
            action = "updated"

        await session.commit()

    return {
        "action": action,
        "email": normalized,
        "role": role_name,
        "scopes": role_scopes,
    }


async def promote_to_administrator(
    session_factory: async_sessionmaker[AsyncSession],
    *,
    email: str,
    password: str | None = None,
    full_name: str | None = None,
) -> dict[str, Any]:
    """Promote an existing user to administrator (admin:org). Optionally reset password."""
    normalized = email.strip().lower()
    if not normalized or "@" not in normalized:
        raise ValueError("email must be a non-empty address")
    if password is not None and len(password) < 12:
        raise ValueError("password must be at least 12 characters")

    async with session_factory() as session:
        existing = (
            await session.execute(select(User).where(User.email == normalized))
        ).scalar_one_or_none()

        if existing is None:
            if password is None:
                raise ValueError(
                    f"User not found: {normalized}. Pass --password to create an administrator."
                )
            user = User(
                email=normalized,
                hashed_password=hash_password(password),
                full_name=full_name or "FarmacoGraph Administrator",
                is_active=True,
                is_superuser=True,
            )
            session.add(user)
            await session.flush()
            session.add(UserRole(user=user, role="administrator", scopes=list(ADMIN_SCOPES)))
            await session.commit()
            return {
                "action": "created",
                "email": normalized,
                "role": "administrator",
                "scopes": list(ADMIN_SCOPES),
            }

        if password is not None:
            existing.hashed_password = hash_password(password)
        if full_name:
            existing.full_name = full_name
        existing.is_active = True
        existing.is_superuser = True
        roles = (
            (await session.execute(select(UserRole).where(UserRole.user_id == existing.id)))
            .scalars()
            .all()
        )
        if not roles:
            session.add(UserRole(user=existing, role="administrator", scopes=list(ADMIN_SCOPES)))
        else:
            for user_role in roles:
                user_role.role = "administrator"
                user_role.scopes = list(ADMIN_SCOPES)
        await session.commit()

    return {
        "action": "promoted",
        "email": normalized,
        "role": "administrator",
        "scopes": list(ADMIN_SCOPES),
    }
