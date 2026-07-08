"""Auth persistence — users and API keys in PostgreSQL."""

from __future__ import annotations

import uuid
from datetime import datetime

try:
    from datetime import UTC
except ImportError:  # Python < 3.11
    from datetime import timezone

    UTC = timezone.utc  # noqa: UP017

from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession, async_sessionmaker
from sqlalchemy.orm import selectinload

from farmacograph.db.postgres.models import ApiKey, User, UserRole


class AuthRepository:
    def __init__(self, session_factory: async_sessionmaker[AsyncSession]) -> None:
        self._session_factory = session_factory

    async def get_user_by_email(self, email: str) -> User | None:
        async with self._session_factory() as session:
            stmt = select(User).where(User.email == email, User.is_active.is_(True))
            result = await session.execute(stmt)
            return result.scalar_one_or_none()

    async def get_user_by_id(self, user_id: uuid.UUID) -> User | None:
        async with self._session_factory() as session:
            stmt = select(User).where(User.id == user_id, User.is_active.is_(True))
            result = await session.execute(stmt)
            return result.scalar_one_or_none()

    async def get_user_scopes(self, user_id: uuid.UUID) -> list[str]:
        async with self._session_factory() as session:
            stmt = select(UserRole).where(UserRole.user_id == user_id)
            result = await session.execute(stmt)
            roles = result.scalars().all()
        scopes: set[str] = set()
        for role in roles:
            scopes.update(role.scopes or [])
        return sorted(scopes)

    async def get_api_key_by_prefix(self, prefix: str) -> ApiKey | None:
        async with self._session_factory() as session:
            stmt = (
                select(ApiKey)
                .options(selectinload(ApiKey.user))
                .where(ApiKey.key_prefix == prefix, ApiKey.is_active.is_(True))
            )
            result = await session.execute(stmt)
            return result.scalar_one_or_none()

    async def touch_api_key_last_used(self, api_key_id: uuid.UUID) -> None:
        async with self._session_factory() as session:
            stmt = select(ApiKey).where(ApiKey.id == api_key_id)
            result = await session.execute(stmt)
            record = result.scalar_one_or_none()
            if record is None:
                return
            record.last_used_at = datetime.now(UTC)
            await session.commit()
