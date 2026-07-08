"""Statistics service — platform analytics."""

from __future__ import annotations

from typing import Any

from farmacograph.api.schemas.responses import ResponseMeta
from farmacograph.models.enums import ContentLayer
from farmacograph.repositories.graph import GraphRepository
from farmacograph.repositories.snapshots import SnapshotRepository
from farmacograph.services.modules import MODULE_REGISTRY


class StatisticsService:
    def __init__(self, snapshot_repo: SnapshotRepository, graph_repo: GraphRepository) -> None:
        self._snapshots = snapshot_repo
        self._graph = graph_repo

    async def get_statistics(self) -> tuple[dict[str, Any], ResponseMeta]:
        snapshot = await self._snapshots.get_latest_published()
        counts = await self._graph.count_entities()

        module_stats: dict[str, Any] = {}
        for entry in MODULE_REGISTRY:
            drug_count = await self._graph.count_drugs(module=entry["slug"])
            status = entry["status"]
            if entry["slug"] == "cardiovascular" and drug_count > 0:
                status = "in_progress"
            module_stats[entry["slug"]] = {
                "slug": entry["slug"],
                "name": entry["name"],
                "status": status,
                "drug_count": drug_count,
            }

        data: dict[str, Any] = {
            "entity_count": counts.get("entities", 0),
            "relationship_count": counts.get("relationships", 0),
            "evidence_count": snapshot.evidence_count if snapshot else 0,
            "module_stats": module_stats,
            "latest_snapshot": snapshot.version_tag if snapshot else None,
        }
        meta = ResponseMeta(
            dataset_version=snapshot.version_tag if snapshot else "unpublished",
            ontology_version="1.0.0",
            content_layers=[ContentLayer.BIOMEDICAL],
        )
        return data, meta
