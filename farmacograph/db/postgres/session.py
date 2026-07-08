"""Async SQLAlchemy session management."""

from __future__ import annotations

from collections.abc import AsyncGenerator
from typing import Any

from sqlalchemy import inspect as sa_inspect
from sqlalchemy import text
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


def _ensure_schema_patches(sync_conn: Any) -> None:
    """Patch columns create_all cannot add to existing tables."""
    inspector = sa_inspect(sync_conn)
    if "curator_workflows" not in inspector.get_table_names():
        return

    columns = {col["name"] for col in inspector.get_columns("curator_workflows")}
    if "draft_package_json" in columns:
        return

    dialect = sync_conn.dialect.name
    col_type = "JSONB" if dialect == "postgresql" else "JSON"
    sync_conn.execute(
        text(f"ALTER TABLE curator_workflows ADD COLUMN draft_package_json {col_type}")
    )


async def init_db(engine: Any) -> None:
    """Create tables, then ensure columns added after initial create_all().

    create_all() never ALTERs existing tables, so production Postgres volumes
    created before a column was added (e.g. draft_package_json) stay stale and
    break CuratorWorkflow SELECTs with UndefinedColumn → HTTP 500.
    """
    async with engine.begin() as conn:
        await conn.run_sync(Base.metadata.create_all)
        await conn.run_sync(_ensure_schema_patches)


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
