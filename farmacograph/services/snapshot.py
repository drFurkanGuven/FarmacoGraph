"""Snapshot service — knowledge release manifests."""

from __future__ import annotations

import uuid
from datetime import UTC, datetime
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

    async def get_by_version(self, version_tag: str) -> KnowledgeSnapshot | None:
        return await self._snapshots.get_by_version(version_tag)

    async def list_snapshots(
        self,
        *,
        limit: int = 50,
        offset: int = 0,
        module: str | None = None,
    ) -> tuple[list[dict[str, Any]], dict[str, Any]]:
        rows = await self._snapshots.list_all()
        if module:
            rows = [row for row in rows if row.module == module]
        total = len(rows)
        page = rows[offset : offset + limit]
        return [serialize_snapshot(row) for row in page], {
            "api_version": self._api_version,
            "count": len(page),
            "total": total,
            "limit": limit,
            "offset": offset,
        }

    async def get_snapshot_detail(self, version_tag: str) -> dict[str, Any] | None:
        snapshot = await self.get_by_version(version_tag)
        if snapshot is None:
            return None
        return serialize_snapshot(snapshot)

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
            released_at=datetime.now(UTC),
        )
        return await self._snapshots.create(snapshot)


def serialize_snapshot(snapshot: KnowledgeSnapshot) -> dict[str, Any]:
    return {
        "id": str(snapshot.id),
        "version_tag": snapshot.version_tag,
        "module": snapshot.module,
        "status": snapshot.status,
        "ontology_version": snapshot.ontology_version,
        "api_version": snapshot.api_version,
        "entity_count": snapshot.entity_count,
        "relationship_count": snapshot.relationship_count,
        "evidence_count": snapshot.evidence_count,
        "manifest": snapshot.manifest_json or {},
        "released_at": snapshot.released_at.isoformat() if snapshot.released_at else None,
        "released_by": str(snapshot.released_by) if snapshot.released_by else None,
        "created_at": snapshot.created_at.isoformat() if snapshot.created_at else None,
        "updated_at": snapshot.updated_at.isoformat() if snapshot.updated_at else None,
    }
