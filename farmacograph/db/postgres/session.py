"""Async SQLAlchemy session management."""

from __future__ import annotations

from collections.abc import AsyncGenerator
from typing import Any

from sqlalchemy.ext.asyncio import AsyncSession, async_sessionmaker, create_async_engine

from farmacograph.core.config import Settings, get_settings
from farmacograph.db.postgres.base import Base


def create_engine(settings: Settings | None = None):
    settings = settings or get_settings()
    return create_async_engine(
        settings.database_url,
        echo=settings.debug,
        future=True,
    )


def create_session_factory(
    settings: Settings | None = None,
) -> tuple[async_sessionmaker[AsyncSession], Any]:
    engine = create_engine(settings)
    factory = async_sessionmaker(engine, class_=AsyncSession, expire_on_commit=False)
    return factory, engine


async def init_db(engine: Any) -> None:
    """Create all operational tables. Use Alembic in production."""
    async with engine.begin() as conn:
        await conn.run_sync(Base.metadata.create_all)


async def get_session(
    session_factory: async_sessionmaker[AsyncSession],
) -> AsyncGenerator[AsyncSession, None]:
    async with session_factory() as session:
        try:
            yield session
            await session.commit()
        except Exception:
            await session.rollback()
            raise
