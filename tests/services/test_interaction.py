"""Unit tests for InteractionService - curator-only interaction engine."""

from __future__ import annotations

from typing import Any
from uuid import UUID

import pytest

from farmacograph.api.schemas.responses import InteractionSeverity
from farmacograph.services.interaction import InteractionService

RAMIPRIL_ID = UUID("2c31ee65-5805-5693-bdeb-01bb4829b1b9")
LOSARTAN_ID = UUID("04fe6ccc-c02e-5256-b362-af0fd4adff98")


class MockGraphRepository:
    def __init__(self, profiles: list[dict[str, Any]]) -> None:
        self.profiles = profiles

    async def get_drugs_full_profiles(
        self,
        drug_ids: list[UUID] | None = None,
        *,
        slugs: list[str] | None = None,
        dataset_version: str | None = None,
    ) -> list[dict[str, Any]]:
        id_strs = {str(d) for d in drug_ids} if drug_ids else set()
        slug_set = set(slugs) if slugs else set()
        return [
            p for p in self.profiles
            if (id_strs and str(p.get("id")) in id_strs) or (slug_set and p.get("slug") in slug_set)
        ]


@pytest.fixture
def test_profiles() -> list[dict[str, Any]]:
    return [
        {
            "id": RAMIPRIL_ID,
            "slug": "ramipril",
            "label": "Ramipril",
            "classes": [{"slug": "ace-inhibitors", "label": "ACE inhibitors"}],
        },
        {
            "id": LOSARTAN_ID,
            "slug": "losartan",
            "label": "Losartan",
            "classes": [{"slug": "arbs", "label": "Angiotensin receptor blockers"}],
        },
    ]


class CuratedGraphRepository(MockGraphRepository):
    def __init__(
        self,
        profiles: list[dict[str, Any]],
        curated: list[dict[str, Any]],
    ) -> None:
        super().__init__(profiles)
        self._curated = curated

    async def get_interactions_between(
        self, drug_ids: list[str]
    ) -> list[dict[str, Any]]:
        wanted = {str(did).lower() for did in drug_ids}
        return [
            edge
            for edge in self._curated
            if str(edge.get("source_id", "")).lower() in wanted
            and str(edge.get("target_id", "")).lower() in wanted
        ]


@pytest.mark.asyncio
async def test_curated_interaction_returns_source_curator(
    test_profiles: list[dict[str, Any]],
) -> None:
    curated = [
        {
            "source_id": str(RAMIPRIL_ID),
            "target_id": str(LOSARTAN_ID),
            "properties": {
                "severity": "contraindicated",
                "title": "Curated: avoid dual RAAS blockade in pregnancy",
                "mechanism_explanation": "Curator-verified mechanism.",
                "clinical_action": "Stop one agent.",
                "evidence_ids": ["e1"],
            },
        }
    ]
    repo = CuratedGraphRepository(test_profiles, curated)
    service = InteractionService(repo)  # type: ignore[arg-type]

    response, _ = await service.analyze(drug_ids=[RAMIPRIL_ID, LOSARTAN_ID])

    assert response.interactions, "curated edge must surface"
    first = response.interactions[0]
    assert first.source == "curator"
    assert first.title == "Curated: avoid dual RAAS blockade in pregnancy"
    assert first.evidence_ids == ["e1"]


@pytest.mark.asyncio
async def test_curated_reverse_direction_counts(
    test_profiles: list[dict[str, Any]],
) -> None:
    curated = [
        {
            "source_id": str(LOSARTAN_ID),
            "target_id": str(RAMIPRIL_ID),
            "properties": {"severity": "major"},
        }
    ]
    repo = CuratedGraphRepository(test_profiles, curated)
    service = InteractionService(repo)  # type: ignore[arg-type]

    response, _ = await service.analyze(drug_ids=[RAMIPRIL_ID, LOSARTAN_ID])

    assert response.interactions[0].source == "curator"
    assert response.interactions[0].severity == InteractionSeverity.MAJOR


@pytest.mark.asyncio
async def test_invalid_curated_severity_falls_back_to_moderate(
    test_profiles: list[dict[str, Any]],
) -> None:
    curated = [
        {
            "source_id": str(RAMIPRIL_ID),
            "target_id": str(LOSARTAN_ID),
            "properties": {"severity": "not-a-severity"},
        }
    ]
    repo = CuratedGraphRepository(test_profiles, curated)
    service = InteractionService(repo)  # type: ignore[arg-type]

    response, _ = await service.analyze(drug_ids=[RAMIPRIL_ID, LOSARTAN_ID])

    assert response.interactions[0].source == "curator"
    assert response.interactions[0].severity == InteractionSeverity.MODERATE


@pytest.mark.asyncio
async def test_no_curated_interactions_returns_empty(
    test_profiles: list[dict[str, Any]],
) -> None:
    repo = CuratedGraphRepository(test_profiles, [])
    service = InteractionService(repo)  # type: ignore[arg-type]

    response, _ = await service.analyze(drug_ids=[RAMIPRIL_ID, LOSARTAN_ID])

    assert response.interactions == []
    assert len(response.checked_drugs) == 2


@pytest.mark.asyncio
async def test_interaction_by_slugs(
    test_profiles: list[dict[str, Any]],
) -> None:
    curated = [
        {
            "source_id": str(RAMIPRIL_ID),
            "target_id": str(LOSARTAN_ID),
            "properties": {"severity": "contraindicated"},
        }
    ]
    repo = CuratedGraphRepository(test_profiles, curated)
    service = InteractionService(repo)  # type: ignore[arg-type]

    response, _ = await service.analyze(slugs=["ramipril", "losartan"])

    assert len(response.checked_drugs) == 2
    assert len(response.interactions) == 1
    assert response.interactions[0].source == "curator"
