"""Transactional outbox repository."""

from __future__ import annotations

import uuid
from datetime import UTC, datetime

from sqlalchemy import select, update
from sqlalchemy.ext.asyncio import AsyncSession, async_sessionmaker

from farmacograph.db.postgres.models import OutboxEvent


class OutboxRepository:
    def __init__(self, session_factory: async_sessionmaker[AsyncSession]) -> None:
        self._session_factory = session_factory

    async def append(
        self,
        event_type: str,
        aggregate_type: str,
        aggregate_id: str,
        payload: dict,
        *,
        correlation_id: str | None = None,
        actor_id: uuid.UUID | None = None,
        workspace_id: uuid.UUID | None = None,
    ) -> OutboxEvent:
        event = OutboxEvent(
            event_type=event_type,
            aggregate_type=aggregate_type,
            aggregate_id=aggregate_id,
            payload_json=payload,
            correlation_id=correlation_id,
            actor_id=actor_id,
            workspace_id=workspace_id,
        )
        async with self._session_factory() as session:
            session.add(event)
            await session.commit()
            await session.refresh(event)
            return event

    async def fetch_pending(self, limit: int = 50) -> list[OutboxEvent]:
        async with self._session_factory() as session:
            result = await session.execute(
                select(OutboxEvent)
                .where(OutboxEvent.status == "pending")
                .order_by(OutboxEvent.occurred_at)
                .limit(limit)
            )
            return list(result.scalars().all())

    async def mark_published(self, event_id: uuid.UUID) -> None:
        async with self._session_factory() as session:
            await session.execute(
                update(OutboxEvent)
                .where(OutboxEvent.id == event_id)
                .values(status="published", published_at=datetime.now(UTC))
            )
            await session.commit()
