"""Module service — curriculum module metadata."""

from __future__ import annotations

from typing import Any

from farmacograph.api.schemas.responses import ResponseMeta
from farmacograph.models.enums import ContentLayer
from farmacograph.repositories.graph import GraphRepository
from farmacograph.repositories.snapshots import SnapshotRepository

MODULE_REGISTRY: list[dict[str, Any]] = [
    {"slug": "cardiovascular", "name": "Cardiovascular", "status": "planned", "drug_count": 0},
    {"slug": "endocrinology", "name": "Endocrinology", "status": "planned", "drug_count": 0},
    {
        "slug": "infectious-diseases",
        "name": "Infectious Diseases",
        "status": "planned",
        "drug_count": 0,
    },
    {"slug": "neurology", "name": "Neurology", "status": "planned", "drug_count": 0},
    {"slug": "psychiatry", "name": "Psychiatry", "status": "planned", "drug_count": 0},
]


def known_module_slugs() -> set[str]:
    return {entry["slug"] for entry in MODULE_REGISTRY}


def validate_module_slug(module: str) -> str:
    slug = (module or "").strip().lower()
    if slug not in known_module_slugs():
        raise ValueError(
            f"Unknown module: {module}. Expected one of: {', '.join(sorted(known_module_slugs()))}."
        )
    return slug


class ModuleService:
    def __init__(
        self,
        graph_repo: GraphRepository,
        snapshot_repo: SnapshotRepository,
    ) -> None:
        self._graph = graph_repo
        self._snapshots = snapshot_repo

    async def list_modules(self) -> tuple[list[dict[str, Any]], ResponseMeta]:
        snapshot = await self._snapshots.get_latest_published()
        dataset_version = snapshot.version_tag if snapshot else "unpublished"

        modules: list[dict[str, Any]] = []
        for entry in MODULE_REGISTRY:
            mod = dict(entry)
            mod["drug_count"] = await self._graph.count_drugs(module=mod["slug"])
            if mod["slug"] == "cardiovascular" and mod["drug_count"] > 0:
                mod["status"] = "in_progress"
            modules.append(mod)

        meta = ResponseMeta(
            dataset_version=dataset_version,
            ontology_version="1.0.0",
            content_layers=[ContentLayer.BIOMEDICAL],
        )
        return modules, meta
