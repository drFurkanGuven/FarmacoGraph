"""Job repository — background job queue in PostgreSQL."""

from __future__ import annotations

import uuid
from datetime import datetime, timezone

from sqlalchemy import select, update
from sqlalchemy.ext.asyncio import AsyncSession, async_sessionmaker

from farmacograph.db.postgres.models import Job


class JobRepository:
    def __init__(self, session_factory: async_sessionmaker[AsyncSession]) -> None:
        self._session_factory = session_factory

    async def enqueue(
        self,
        job_type: str,
        payload: dict,
        *,
        priority: int = 0,
        correlation_id: str | None = None,
        created_by: uuid.UUID | None = None,
    ) -> Job:
        job = Job(
            job_type=job_type,
            payload_json=payload,
            priority=priority,
            correlation_id=correlation_id,
            created_by=created_by,
        )
        async with self._session_factory() as session:
            session.add(job)
            await session.commit()
            await session.refresh(job)
            return job

    async def fetch_pending(self, limit: int = 10) -> list[Job]:
        async with self._session_factory() as session:
            result = await session.execute(
                select(Job)
                .where(Job.status == "pending")
                .order_by(Job.priority.desc(), Job.created_at)
                .limit(limit)
            )
            return list(result.scalars().all())

    async def mark_running(self, job_id: uuid.UUID) -> None:
        async with self._session_factory() as session:
            await session.execute(
                update(Job)
                .where(Job.id == job_id)
                .values(status="running", started_at=datetime.now(timezone.utc), attempts=Job.attempts + 1)
            )
            await session.commit()

    async def mark_completed(self, job_id: uuid.UUID, result: dict | None = None) -> None:
        async with self._session_factory() as session:
            await session.execute(
                update(Job)
                .where(Job.id == job_id)
                .values(
                    status="completed",
                    completed_at=datetime.now(timezone.utc),
                    result_json=result,
                )
            )
            await session.commit()

    async def mark_failed(self, job_id: uuid.UUID, error: str) -> None:
        async with self._session_factory() as session:
            await session.execute(
                update(Job)
                .where(Job.id == job_id)
                .values(status="failed", completed_at=datetime.now(timezone.utc), error_message=error)
            )
            await session.commit()
