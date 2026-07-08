"""Service layer — business logic. API controllers depend on services only."""

from __future__ import annotations

from typing import Any

from sqlalchemy import text
from sqlalchemy.ext.asyncio import async_sessionmaker

from farmacograph.core.config import Settings
from farmacograph.core.metrics import NEO4J_HEALTH, POSTGRES_HEALTH
from farmacograph.db.neo4j.driver import Neo4jDriver
from farmacograph.repositories.snapshots import SnapshotRepository


class HealthService:
    def __init__(
        self,
        settings: Settings,
        neo4j: Neo4jDriver,
        session_factory: async_sessionmaker,
        snapshot_repo: SnapshotRepository,
    ) -> None:
        self._settings = settings
        self._neo4j = neo4j
        self._session_factory = session_factory
        self._snapshot_repo = snapshot_repo

    async def check(self) -> dict[str, Any]:
        pg_status = await self._check_postgres()
        neo4j_status = await self._neo4j.health_check()
        snapshot = await self._snapshot_repo.get_latest_published()

        POSTGRES_HEALTH.set(1 if pg_status == "connected" else 0)
        NEO4J_HEALTH.set(1 if neo4j_status == "connected" else 0)

        overall = "ok" if pg_status == "connected" else "degraded"
        return {
            "status": overall,
            "checks": {
                "postgresql": pg_status,
                "neo4j": neo4j_status,
                "latest_snapshot": snapshot.version_tag if snapshot else None,
            },
            "dataset_version": snapshot.version_tag
            if snapshot
            else self._settings.current_dataset_version,
        }

    async def _check_postgres(self) -> str:
        try:
            async with self._session_factory() as session:
                await session.execute(text("SELECT 1"))
            return "connected"
        except Exception:
            return "disconnected"
