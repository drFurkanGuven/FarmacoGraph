"""Unit tests for CompareService multi-dimensional drug comparisons."""

from __future__ import annotations

from typing import Any
from uuid import UUID, uuid4

import pytest

from farmacograph.models.enums import ContentLayer
from farmacograph.services.compare import CompareService

RAMIPRIL_ID = UUID("2c31ee65-5805-5693-bdeb-01bb4829b1b9")
LOSARTAN_ID = UUID("04fe6ccc-c02e-5256-b362-af0fd4adff98")


class MockGraphRepository:
    def __init__(self, profiles: list[dict[str, Any]] | None = None) -> None:
        self.profiles = profiles or []

    async def get_drugs_full_profiles(
        self,
        drug_ids: list[UUID] | None = None,
        *,
        slugs: list[str] | None = None,
        dataset_version: str | None = None,
    ) -> list[dict[str, Any]]:
        if not drug_ids and not slugs:
            return []
        id_strs = {str(d) for d in drug_ids} if drug_ids else set()
        return [p for p in self.profiles if str(p.get("id")) in id_strs]

    async def get_drug_education(self, drug_id: UUID, dataset_version: str | None = None) -> list[dict[str, Any]]:
        if drug_id == RAMIPRIL_ID:
            return [{"education": {"id": "edu-ramipril", "kind": "Flashcard", "title": "ACEi Mechanism"}}]
        return []


@pytest.mark.asyncio
async def test_compare_multi_dimensions_populated() -> None:
    profiles = [
        {
            "id": RAMIPRIL_ID,
            "slug": "ramipril",
            "label": "Ramipril",
            "half_life": "2–4 hours (prodrug); ramiprilat ~11 hours",
            "bioavailability": "~28%",
            "protein_binding": "~73%",
            "onset": "1–2 hours",
            "duration": "24 hours",
            "routes": ["oral"],
            "has_black_box_warning": False,
            "black_box_text": None,
            "is_high_alert": False,
            "classes": [
                {"id": "c1", "slug": "ace-inhibitors", "label": "ACE inhibitors"},
                {"id": "c_antihyp", "slug": "antihypertensives", "label": "Antihypertensives"},
            ],
            "indications": [
                {"id": "i1", "slug": "hypertension", "label": "Hypertension"},
                {"id": "i2", "slug": "heart-failure", "label": "Heart Failure"},
            ],
            "mechanism_roots": [
                {"id": "m1", "slug": "ace-inhibition", "label": "ACE Inhibition"},
            ],
        },
        {
            "id": LOSARTAN_ID,
            "slug": "losartan",
            "label": "Losartan",
            "half_life": "2 hours; active metabolite 6–9 hours",
            "bioavailability": "~33%",
            "protein_binding": "~98.7%",
            "onset": "1 hour",
            "duration": "24 hours",
            "routes": ["oral"],
            "has_black_box_warning": True,
            "black_box_text": "Fetal toxicity during pregnancy.",
            "is_high_alert": False,
            "classes": [
                {"id": "c2", "slug": "arbs", "label": "Angiotensin receptor blockers"},
                {"id": "c_antihyp", "slug": "antihypertensives", "label": "Antihypertensives"},
            ],
            "indications": [
                {"id": "i1", "slug": "hypertension", "label": "Hypertension"},
                {"id": "i3", "slug": "diabetic-nephropathy", "label": "Diabetic Nephropathy"},
            ],
            "mechanism_roots": [
                {"id": "m2", "slug": "at1-blockade", "label": "AT1 Receptor Blockade"},
            ],
        },
    ]

    repo = MockGraphRepository(profiles)
    service = CompareService(repo)  # type: ignore[arg-type]

    dimensions = ["classes", "indications", "pharmacokinetics", "warnings", "mechanisms"]
    data, meta = await service.compare([RAMIPRIL_ID, LOSARTAN_ID], dimensions)

    # Metadata checks
    assert ContentLayer.BIOMEDICAL in meta.content_layers
    assert ContentLayer.EDUCATION not in meta.content_layers

    # Classes comparison
    classes_comp = data["comparison"]["classes"]
    assert classes_comp["status"] == "available"
    assert "Antihypertensives" in classes_comp["shared"]
    assert len(classes_comp["by_drug"][str(RAMIPRIL_ID)]) == 2
    assert len(classes_comp["by_drug"][str(LOSARTAN_ID)]) == 2

    # Indications comparison
    ind_comp = data["comparison"]["indications"]
    assert ind_comp["status"] == "available"
    assert "Hypertension" in ind_comp["shared"]

    # PK comparison
    pk_comp = data["comparison"]["pharmacokinetics"]
    assert pk_comp["status"] == "available"
    assert pk_comp["by_drug"][str(RAMIPRIL_ID)]["half_life"] == "2–4 hours (prodrug); ramiprilat ~11 hours"
    assert pk_comp["by_drug"][str(LOSARTAN_ID)]["protein_binding"] == "~98.7%"

    # Warnings comparison
    warn_comp = data["comparison"]["warnings"]
    assert warn_comp["status"] == "available"
    assert warn_comp["by_drug"][str(RAMIPRIL_ID)]["has_black_box_warning"] is False
    assert warn_comp["by_drug"][str(LOSARTAN_ID)]["has_black_box_warning"] is True
    assert "Fetal toxicity" in warn_comp["by_drug"][str(LOSARTAN_ID)]["black_box_text"]

    # Mechanisms comparison
    mech_comp = data["comparison"]["mechanisms"]
    assert mech_comp["status"] == "available"
    assert len(mech_comp["by_drug"][str(RAMIPRIL_ID)]) == 1

    # Subgraph validation
    subgraph = data["subgraph"]
    node_ids = {n["id"] for n in subgraph["nodes"]}
    assert str(RAMIPRIL_ID) in node_ids
    assert str(LOSARTAN_ID) in node_ids
    assert "c1" in node_ids
    assert "i1" in node_ids

    rel_types = {e["relationship_type"] for e in subgraph["edges"]}
    assert "BELONGS_TO" in rel_types
    assert "TREATS" in rel_types
    assert "HAS_MECHANISM_ROOT" in rel_types


@pytest.mark.asyncio
async def test_compare_handles_empty_profiles_gracefully() -> None:
    repo = MockGraphRepository([])
    service = CompareService(repo)  # type: ignore[arg-type]

    # Unknown IDs match neither the graph nor staging packages: honest no_data.
    unknown_a = uuid4()
    unknown_b = uuid4()
    data, meta = await service.compare([unknown_a, unknown_b], ["classes", "pharmacokinetics"])

    assert data["comparison"]["classes"]["status"] == "no_data"
    assert data["comparison"]["pharmacokinetics"]["status"] == "no_data"
    assert data["subgraph"]["nodes"] == []
    assert data["subgraph"]["edges"] == []
    assert meta.provenance is None


@pytest.mark.asyncio
async def test_compare_includes_education_layer() -> None:
    repo = MockGraphRepository([])
    service = CompareService(repo)  # type: ignore[arg-type]

    data, meta = await service.compare([RAMIPRIL_ID, LOSARTAN_ID], ["mechanism"], include_education=True)

    assert ContentLayer.EDUCATION in meta.content_layers
    assert "education" in data
    assert len(data["education"][str(RAMIPRIL_ID)]) == 1
    assert data["education"][str(LOSARTAN_ID)] == []
