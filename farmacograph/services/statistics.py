"""Statistics service — platform analytics."""

from __future__ import annotations

from typing import Any

from farmacograph.api.schemas.responses import ResponseMeta
from farmacograph.models.enums import ContentLayer
from farmacograph.repositories.graph import GraphRepository
from farmacograph.repositories.snapshots import SnapshotRepository


class StatisticsService:
    def __init__(self, snapshot_repo: SnapshotRepository, graph_repo: GraphRepository) -> None:
        self._snapshots = snapshot_repo
        self._graph = graph_repo

    async def get_statistics(self) -> tuple[dict[str, Any], ResponseMeta]:
        snapshot = await self._snapshots.get_latest_published()
        counts = await self._graph.count_entities()

        data: dict[str, Any] = {
            "entity_count": counts.get("entities", 0),
            "relationship_count": counts.get("relationships", 0),
            "evidence_count": snapshot.evidence_count if snapshot else 0,
            "module_stats": {m["slug"]: m for m in [
                {"slug": "cardiovascular", "status": "planned", "drug_count": 0}
            ]},
            "latest_snapshot": snapshot.version_tag if snapshot else None,
        }
        meta = ResponseMeta(
            dataset_version=snapshot.version_tag if snapshot else "unpublished",
            ontology_version="1.0.0",
            content_layers=[ContentLayer.BIOMEDICAL],
        )
        return data, meta
