"""Neo4j driver wrapper — knowledge graph access for repository layer only."""

from __future__ import annotations

from typing import Any

from farmacograph.core.config import Settings
from farmacograph.core.exceptions import ServiceUnavailableError
from farmacograph.core.logging import get_logger

logger = get_logger(__name__)


class Neo4jDriver:
    """Thin async wrapper around neo4j driver. Not exposed to API controllers."""

    def __init__(self, settings: Settings) -> None:
        self._settings = settings
        self._driver: Any = None

    async def connect(self) -> None:
        if not self._settings.neo4j_enabled:
            logger.info("neo4j_disabled")
            return
        try:
            from neo4j import AsyncGraphDatabase

            self._driver = AsyncGraphDatabase.driver(
                self._settings.neo4j_uri,
                auth=(self._settings.neo4j_user, self._settings.neo4j_password),
            )
            await self._driver.verify_connectivity()
            logger.info("neo4j_connected", uri=self._settings.neo4j_uri)
        except Exception as exc:
            logger.error("neo4j_connection_failed", error=str(exc))
            raise ServiceUnavailableError(f"Neo4j unavailable: {exc}") from exc

    async def close(self) -> None:
        if self._driver is not None:
            await self._driver.close()
            self._driver = None

    @property
    def is_connected(self) -> bool:
        return self._driver is not None

    async def health_check(self) -> str:
        if not self._settings.neo4j_enabled:
            return "disabled"
        if self._driver is None:
            return "disconnected"
        try:
            await self._driver.verify_connectivity()
            return "connected"
        except Exception:
            return "disconnected"

    async def run_query(
        self,
        query: str,
        parameters: dict[str, Any] | None = None,
    ) -> list[dict[str, Any]]:
        if self._driver is None:
            raise ServiceUnavailableError("Neo4j not connected")
        parameters = parameters or {}
        async with self._driver.session(database=self._settings.neo4j_database) as session:
            result = await session.run(query, parameters)
            records = await result.data()
            return records

    async def init_schema(self) -> None:
        """Apply constraints and indexes from init.cypher."""
        if self._driver is None:
            return
        from pathlib import Path

        cypher_path = Path(__file__).parent / "init.cypher"
        statements = [
            s.strip()
            for s in cypher_path.read_text(encoding="utf-8").split(";")
            if s.strip() and not s.strip().startswith("//")
        ]
        async with self._driver.session(database=self._settings.neo4j_database) as session:
            for statement in statements:
                await session.run(statement)
