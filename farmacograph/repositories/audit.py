"""Audit log repository."""

from __future__ import annotations

import uuid

from sqlalchemy import asc, desc, select
from sqlalchemy.ext.asyncio import AsyncSession, async_sessionmaker

from farmacograph.db.postgres.models import AuditLog


class AuditRepository:
    def __init__(self, session_factory: async_sessionmaker[AsyncSession]) -> None:
        self._session_factory = session_factory

    async def log(
        self,
        action: str,
        resource_type: str,
        *,
        resource_id: str | None = None,
        actor_id: uuid.UUID | None = None,
        organization_id: uuid.UUID | None = None,
        workspace_id: uuid.UUID | None = None,
        diff: dict | None = None,
        correlation_id: str | None = None,
        ip_address: str | None = None,
    ) -> AuditLog:
        entry = AuditLog(
            action=action,
            resource_type=resource_type,
            resource_id=resource_id,
            actor_id=actor_id,
            organization_id=organization_id,
            workspace_id=workspace_id,
            diff_json=diff,
            correlation_id=correlation_id,
            ip_address=ip_address,
        )
        async with self._session_factory() as session:
            session.add(entry)
            await session.commit()
            await session.refresh(entry)
            return entry

    async def list_recent(
        self,
        *,
        limit: int = 20,
        offset: int = 0,
        resource_type: str | None = None,
        action: str | None = None,
    ) -> list[AuditLog]:
        async with self._session_factory() as session:
            stmt = select(AuditLog).order_by(desc(AuditLog.timestamp))
            if resource_type:
                stmt = stmt.where(AuditLog.resource_type == resource_type)
            if action:
                stmt = stmt.where(AuditLog.action == action)
            stmt = stmt.offset(offset).limit(limit)
            result = await session.execute(stmt)
            return list(result.scalars().all())

    async def list_for_resource(
        self,
        resource_type: str,
        resource_id: str,
        *,
        limit: int = 50,
        offset: int = 0,
        ascending: bool = True,
    ) -> list[AuditLog]:
        async with self._session_factory() as session:
            order = asc(AuditLog.timestamp) if ascending else desc(AuditLog.timestamp)
            stmt = (
                select(AuditLog)
                .where(
                    AuditLog.resource_type == resource_type,
                    AuditLog.resource_id == resource_id,
                )
                .order_by(order)
                .offset(offset)
                .limit(limit)
            )
            result = await session.execute(stmt)
            return list(result.scalars().all())
