"""Lightweight Neo4j search — drugs by slug/generic_name (no FTS index)."""

from __future__ import annotations

from typing import Any

from farmacograph.repositories.graph import GraphRepository


class GraphSearchProvider:
    """Minimal search until Meilisearch/FTS plugin (API 5.6)."""

    def __init__(self, graph_repo: GraphRepository) -> None:
        self._graph = graph_repo

    async def search(
        self,
        query: str,
        *,
        limit: int = 20,
        types: list[str] | None = None,
    ) -> list[dict[str, Any]]:
        if not self._graph.is_available:
            return []
        if types is not None and types and "Drug" not in types:
            return []
        return await self._graph.search_drugs(query, limit=limit)

    async def autocomplete(self, query: str, *, limit: int = 10) -> list[dict[str, Any]]:
        return await self.search(query, limit=limit, types=["Drug"])

    async def health_check(self) -> str:
        return "connected" if self._graph.is_available else "disconnected"
