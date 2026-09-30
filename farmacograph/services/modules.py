"""Module service — curriculum module metadata."""

from __future__ import annotations

from typing import Any

from farmacograph.api.schemas.responses import ResponseMeta
from farmacograph.models.enums import ContentLayer
from farmacograph.repositories.graph import UNCLASSIFIED_MODULE, GraphRepository
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


# Slugs accepted as filters. 'all' means no module filter; 'unclassified' is
# the explicit bucket for published drugs with no module (see UNCLASSIFIED_MODULE
# in repositories/graph.py).
FILTERABLE_MODULE_SLUGS: set[str] = {entry["slug"] for entry in MODULE_REGISTRY} | {
    "all",
    UNCLASSIFIED_MODULE,
}


def known_module_slugs() -> set[str]:
    return {entry["slug"] for entry in MODULE_REGISTRY}


def validate_module_slug(module: str) -> str:
    """Normalise and check a module filter.

    Accepts 'all' and the 'unclassified' bucket alongside curriculum modules:
    the module explorer offers both, and /modules reports 'unclassified' as a
    real row, so rejecting them here made the explorer return 500 on the exact
    values it advertises.

    'unclassified' is a reporting bucket, not a curriculum module. It is never a
    valid value for assigning a module, which validate_assignment_slug enforces.
    """
    slug = (module or "").strip().lower()
    if slug in FILTERABLE_MODULE_SLUGS:
        return slug
    raise ValueError(
        f"Unknown module: {module}. Expected one of: {', '.join(sorted(FILTERABLE_MODULE_SLUGS))}."
    )


def validate_assignment_slug(module: str) -> str:
    """Check a module a curator is assigning to a drug.

    Only real curriculum modules qualify; 'unclassified' and 'all' are filters,
    not assignment targets.
    """
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

        # Published drugs with no curriculum module (PrimeKG). Reported as an
        # explicit bucket so the explorer does not show 0 for every module
        # while thousands of discoverable drugs sit outside the registry.
        unclassified = await self._graph.count_drugs(module=UNCLASSIFIED_MODULE)
        if unclassified > 0:
            modules.append(
                {
                    "slug": UNCLASSIFIED_MODULE,
                    "name": "Unclassified (PrimeKG)",
                    "status": "external",
                    "drug_count": unclassified,
                    "is_bucket": True,
                    "curation_note": (
                        "External PrimeKG drugs. Not curator-reviewed and not "
                        "assigned to a curriculum module; discoverable via search "
                        "and the global catalog."
                    ),
                }
            )

        meta = ResponseMeta(
            dataset_version=dataset_version,
            ontology_version="1.0.0",
            content_layers=[ContentLayer.BIOMEDICAL],
        )
        return modules, meta
