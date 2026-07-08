"""Seed development curator accounts — skipped when users already exist."""

from __future__ import annotations

from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession, async_sessionmaker

from farmacograph.auth.models import hash_password
from farmacograph.core.config import Settings
from farmacograph.db.postgres.models import User, UserRole

CURATOR_SCOPES = [
    "knowledge:read",
    "knowledge:search",
    "knowledge:explain",
    "education:read",
    "curator:write",
    "curator:publish",
]


async def seed_dev_users(
    session_factory: async_sessionmaker[AsyncSession], settings: Settings
) -> None:
    if not settings.seed_dev_users or settings.environment not in ("development", "test"):
        return

    async with session_factory() as session:
        existing = await session.execute(select(User).limit(1))
        if existing.scalar_one_or_none() is not None:
            return

        user = User(
            email=settings.seed_curator_email.lower(),
            hashed_password=hash_password(settings.seed_curator_password),
            full_name="FarmacoGraph Curator",
            is_active=True,
        )
        role = UserRole(user=user, role="curator", scopes=CURATOR_SCOPES)
        session.add(user)
        session.add(role)
        await session.commit()
