"""Compare service tests."""

from __future__ import annotations

from uuid import UUID

import pytest

from farmacograph.models.enums import ContentLayer
from farmacograph.services.compare import CompareService

DRUG_A = UUID("00000000-0000-4000-8000-000000000001")
DRUG_B = UUID("00000000-0000-4000-8000-000000000002")


class FakeGraphRepository:
    async def get_drug_education(self, drug_id: UUID, dataset_version: str | None = None):
        if drug_id == DRUG_A:
            return [
                {
                    "education": {
                        "id": "edu-1",
                        "kind": "Flashcard",
                        "front": "Which suffix suggests an ACE inhibitor?",
                        "back": "-pril",
                        "content_layer": "education",
                    }
                }
            ]
        return []


@pytest.mark.asyncio
async def test_compare_omits_education_by_default() -> None:
    service = CompareService(FakeGraphRepository())  # type: ignore[arg-type]

    data, meta = await service.compare([DRUG_A, DRUG_B], ["mechanism"])

    assert "education" not in data
    assert meta.content_layers == [ContentLayer.BIOMEDICAL]


@pytest.mark.asyncio
async def test_compare_includes_drug_education_when_requested() -> None:
    service = CompareService(FakeGraphRepository())  # type: ignore[arg-type]

    data, meta = await service.compare([DRUG_A, DRUG_B], ["mechanism"], include_education=True)

    assert meta.content_layers == [ContentLayer.BIOMEDICAL, ContentLayer.EDUCATION]
    assert data["education"][str(DRUG_A)][0]["kind"] == "Flashcard"
    assert data["education"][str(DRUG_B)] == []
