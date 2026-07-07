"""Graph validation worker — post-publish integrity checks."""

from __future__ import annotations

from typing import Any

from farmacograph.repositories.graph import GraphRepository
from farmacograph.workers.base import BaseWorker


class GraphValidationWorker(BaseWorker):
    job_type = "graph_validation"

    def __init__(self, job_repo, graph_repo: GraphRepository) -> None:
        super().__init__(job_repo)
        self._graph = graph_repo

    async def execute(self, payload: dict[str, Any]) -> dict[str, Any] | None:
        entity_id = payload.get("entity_id")
        if not entity_id or not self._graph.is_available:
            return {"skipped": True, "reason": "neo4j_unavailable"}

        stats = await self._graph.get_published_drug_graph_stats(str(entity_id))
        if not stats:
            raise RuntimeError(f"Published drug not found in graph: {entity_id}")

        if stats.get("rel_count", 0) < 1:
            raise RuntimeError(f"Drug has no outgoing relationships: {entity_id}")

        return {"entity_id": entity_id, "slug": stats.get("slug"), "rel_count": stats["rel_count"]}
