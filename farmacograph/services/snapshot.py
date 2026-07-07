"""Snapshot service — knowledge release manifests."""

from __future__ import annotations

import uuid
from datetime import datetime, timezone
from typing import Any

from farmacograph.db.postgres.models import KnowledgeSnapshot
from farmacograph.repositories.graph import GraphRepository
from farmacograph.repositories.snapshots import SnapshotRepository


class SnapshotService:
    def __init__(
        self,
        snapshot_repo: SnapshotRepository,
        graph_repo: GraphRepository,
        *,
        ontology_version: str = "1.0.0",
        api_version: str = "v1",
    ) -> None:
        self._snapshots = snapshot_repo
        self._graph = graph_repo
        self._ontology_version = ontology_version
        self._api_version = api_version

    async def create_module_snapshot(
        self,
        module: str,
        version_tag: str,
        *,
        actor_id: uuid.UUID | None = None,
        structural_stub: bool = False,
    ) -> KnowledgeSnapshot:
        existing = await self._snapshots.get_by_version(version_tag)
        if existing is not None:
            return existing

        counts = await self._graph.count_entities()
        drug_count = await self._graph.count_drugs(module=module)
        manifest: dict[str, Any] = {
            "module": module,
            "structural_stub": structural_stub,
            "drug_count": drug_count,
        }

        snapshot = KnowledgeSnapshot(
            version_tag=version_tag,
            module=module,
            ontology_version=self._ontology_version,
            api_version=self._api_version,
            status="published",
            entity_count=counts.get("entities", 0),
            relationship_count=counts.get("relationships", 0),
            evidence_count=0,
            manifest_json=manifest,
            released_by=actor_id,
            released_at=datetime.now(timezone.utc),
        )
        return await self._snapshots.create(snapshot)
