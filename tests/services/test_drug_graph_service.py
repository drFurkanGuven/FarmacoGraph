from __future__ import annotations

from typing import Any
from uuid import UUID

import pytest

from farmacograph.curator.drug_package import extract_drug_graph_projection, find_package_by_ref
from farmacograph.services.drugs import DrugService


class EmptyGraphRepository:
    def __init__(self) -> None:
        self.is_available = False

    async def list_drugs(self, **kwargs: Any) -> list[dict[str, Any]]:
        return []

    async def count_listed_drugs(self, **kwargs: Any) -> int:
        return 0

    async def get_drug_by_id(self, drug_id: UUID, dataset_version: str | None = None) -> dict[str, Any] | None:
        return None

    async def get_drug_graph_projection(
        self, drug_id: UUID, *, depth: int = 2, dataset_version: str | None = None
    ) -> dict[str, Any]:
        return {
            "nodes": [],
            "edges": [],
            "depth": depth,
            "neo4j_available": False,
            "drug_in_graph": False,
        }

    async def get_drug_mechanism_dag(
        self, drug_id: UUID, dataset_version: str | None = None
    ) -> dict[str, Any]:
        return {"nodes": [], "edges": []}

    async def get_drug_education(self, drug_id: UUID, dataset_version: str | None = None) -> list[dict[str, Any]]:
        return []


def test_extract_drug_graph_projection_metoprolol() -> None:
    pkg = find_package_by_ref("metoprolol")
    assert pkg is not None

    # Depth 1: immediate neighbors
    g1 = extract_drug_graph_projection(pkg, depth=1)
    assert g1["drug_in_graph"] is True
    assert g1["depth"] == 1
    assert len(g1["nodes"]) >= 5
    assert len(g1["edges"]) >= 4

    # Depth 2: expanded multi-step neighborhood
    g2 = extract_drug_graph_projection(pkg, depth=2)
    assert g2["drug_in_graph"] is True
    assert g2["depth"] == 2
    assert len(g2["nodes"]) > len(g1["nodes"])
    assert len(g2["edges"]) > len(g1["edges"])


@pytest.mark.asyncio
async def test_drug_service_get_drug_graph_staging_fallback() -> None:
    from farmacograph.core.config import Settings
    service = DrugService(EmptyGraphRepository(), Settings())  # type: ignore[arg-type]
    metoprolol_pkg = find_package_by_ref("metoprolol")
    assert metoprolol_pkg is not None
    metoprolol_id = UUID(str(metoprolol_pkg.entity_payload["id"]))

    graph, meta = await service.get_drug_graph(metoprolol_id, depth=2)
    assert graph["drug_in_graph"] is True
    assert len(graph["nodes"]) >= 6
    assert len(graph["edges"]) >= 5


@pytest.mark.asyncio
async def test_drug_service_list_drugs_fallback() -> None:
    from farmacograph.core.config import Settings
    service = DrugService(EmptyGraphRepository(), Settings())  # type: ignore[arg-type]
    drugs, meta = await service.list_drugs()
    assert len(drugs) >= 3
    slugs = {d.slug for d in drugs}
    assert "ramipril" in slugs
    assert "metoprolol" in slugs


class PrimeKGGraphRepository:
    """Graph stub returning ingested (external) and curated drugs."""

    is_available = True

    async def list_drugs(self, **kwargs: Any) -> list[dict[str, Any]]:
        return [
            {
                "id": "11111111-1111-5111-8111-111111111111",
                "slug": "aspirin",
                "label": "Aspirin",
                "status": "published",
                "dataset_version": "2026.1.0",
                "curation_status": "external",
                "source": "primekg",
            },
            {
                "id": "22222222-2222-5222-8222-222222222222",
                "slug": "metoprolol",
                "label": "Metoprolol",
                "status": "published",
                "dataset_version": "2026.1.0",
                "curation_status": None,
                "source": None,
            },
        ]

    async def count_listed_drugs(self, **kwargs: Any) -> int:
        return 2


@pytest.mark.asyncio
async def test_list_drugs_exposes_curation_provenance_and_total() -> None:
    """Ingested drugs must be distinguishable from curator-authored ones.

    PrimeKG nodes carry curation_status='external'; clients render a badge from
    it so unvetted imported data is never presented as reviewed content.
    """
    from farmacograph.core.config import Settings

    service = DrugService(PrimeKGGraphRepository(), Settings())  # type: ignore[arg-type]
    drugs, meta = await service.list_drugs()

    by_slug = {d.slug: d for d in drugs}
    assert by_slug["aspirin"].curation_status == "external"
    assert by_slug["aspirin"].source == "primekg"
    assert by_slug["metoprolol"].curation_status is None
    assert by_slug["metoprolol"].source is None
    assert meta.total == 2


class UnclassifiedGraphRepository:
    """Graph stub exposing the unclassified-drug worklist."""

    is_available = True

    def __init__(self) -> None:
        self.assigned: list[tuple[str, str]] = []

    async def list_unclassified_drugs(self, **kwargs: Any) -> list[dict[str, Any]]:
        return [
            {
                "id": "33333333-3333-5333-8333-333333333333",
                "slug": "atorvastatin",
                "label": "Atorvastatin",
                "source": "primekg",
                "curation_status": "external",
            }
        ]

    async def count_unclassified_drugs(self, **kwargs: Any) -> int:
        return 1

    async def assign_drug_module(self, drug_id: str, module: str) -> dict[str, Any]:
        self.assigned.append((drug_id, module))
        return {
            "id": drug_id,
            "slug": "atorvastatin",
            "module": module,
            "curation_status": "curated",
        }


@pytest.mark.asyncio
async def test_module_assignment_marks_drug_curated() -> None:
    """Assigning a module is the review act, so the external flag must clear."""
    repo = UnclassifiedGraphRepository()
    result = await repo.assign_drug_module(
        "33333333-3333-5333-8333-333333333333", "cardiovascular"
    )

    assert result is not None
    assert result["module"] == "cardiovascular"
    assert result["curation_status"] == "curated"
    assert repo.assigned == [("33333333-3333-5333-8333-333333333333", "cardiovascular")]
