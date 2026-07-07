"""Snapshot repository — PostgreSQL knowledge release manifests."""

from __future__ import annotations

import uuid

from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession, async_sessionmaker

from farmacograph.db.postgres.models import KnowledgeSnapshot


class SnapshotRepository:
    def __init__(self, session_factory: async_sessionmaker[AsyncSession]) -> None:
        self._session_factory = session_factory

    async def get_latest_published(self) -> KnowledgeSnapshot | None:
        async with self._session_factory() as session:
            result = await session.execute(
                select(KnowledgeSnapshot)
                .where(KnowledgeSnapshot.status == "published")
                .order_by(KnowledgeSnapshot.released_at.desc())
                .limit(1)
            )
            return result.scalar_one_or_none()

    async def get_by_version(self, version_tag: str) -> KnowledgeSnapshot | None:
        async with self._session_factory() as session:
            result = await session.execute(
                select(KnowledgeSnapshot).where(KnowledgeSnapshot.version_tag == version_tag)
            )
            return result.scalar_one_or_none()

    async def create(self, snapshot: KnowledgeSnapshot) -> KnowledgeSnapshot:
        async with self._session_factory() as session:
            session.add(snapshot)
            await session.commit()
            await session.refresh(snapshot)
            return snapshot

    async def list_all(self) -> list[KnowledgeSnapshot]:
        async with self._session_factory() as session:
            result = await session.execute(
                select(KnowledgeSnapshot).order_by(KnowledgeSnapshot.created_at.desc())
            )
            return list(result.scalars().all())
