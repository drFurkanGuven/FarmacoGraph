"""Curator workflow repository."""

from __future__ import annotations

import uuid

from sqlalchemy import select, update
from sqlalchemy.ext.asyncio import AsyncSession, async_sessionmaker

from farmacograph.curator.workflow import validate_transition
from farmacograph.db.postgres.models import CuratorWorkflow


class CuratorRepository:
    def __init__(self, session_factory: async_sessionmaker[AsyncSession]) -> None:
        self._session_factory = session_factory

    async def create(
        self,
        entity_id: str,
        entity_type: str,
        *,
        workspace_id: uuid.UUID | None = None,
        assigned_to: uuid.UUID | None = None,
        notes: str | None = None,
    ) -> CuratorWorkflow:
        workflow = CuratorWorkflow(
            entity_id=entity_id,
            entity_type=entity_type,
            workspace_id=workspace_id,
            assigned_to=assigned_to,
            state="draft",
            notes=notes,
        )
        async with self._session_factory() as session:
            session.add(workflow)
            await session.commit()
            await session.refresh(workflow)
            return workflow

    async def get(self, workflow_id: uuid.UUID) -> CuratorWorkflow | None:
        async with self._session_factory() as session:
            result = await session.execute(
                select(CuratorWorkflow).where(CuratorWorkflow.id == workflow_id)
            )
            return result.scalar_one_or_none()

    async def get_by_entity(self, entity_id: str) -> CuratorWorkflow | None:
        async with self._session_factory() as session:
            result = await session.execute(
                select(CuratorWorkflow)
                .where(CuratorWorkflow.entity_id == entity_id)
                .order_by(CuratorWorkflow.created_at.desc())
                .limit(1)
            )
            return result.scalar_one_or_none()

    async def list_by_state(self, state: str, limit: int = 50) -> list[CuratorWorkflow]:
        async with self._session_factory() as session:
            result = await session.execute(
                select(CuratorWorkflow)
                .where(CuratorWorkflow.state == state)
                .order_by(CuratorWorkflow.updated_at.desc())
                .limit(limit)
            )
            return list(result.scalars().all())

    async def transition(
        self,
        workflow_id: uuid.UUID,
        to_state: str,
        *,
        notes: str | None = None,
    ) -> CuratorWorkflow:
        workflow = await self.get(workflow_id)
        if workflow is None:
            raise ValueError(f"Workflow not found: {workflow_id}")
        validate_transition(workflow.state, to_state)
        async with self._session_factory() as session:
            values: dict = {"state": to_state}
            if notes is not None:
                values["notes"] = notes
            await session.execute(
                update(CuratorWorkflow).where(CuratorWorkflow.id == workflow_id).values(**values)
            )
            await session.commit()
        updated = await self.get(workflow_id)
        assert updated is not None
        return updated
