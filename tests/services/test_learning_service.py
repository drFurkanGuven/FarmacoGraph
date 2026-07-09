"""Learning service tests."""

from __future__ import annotations

from uuid import UUID

import pytest

from farmacograph.models.enums import ContentLayer
from farmacograph.services.learning import LearningService

DRUG_ID = UUID("00000000-0000-4000-8000-000000000001")


class FakeGraphRepository:
    async def get_drug_by_id(self, drug_id: UUID):
        if drug_id == DRUG_ID:
            return {
                "id": str(DRUG_ID),
                "slug": "ramipril",
                "label": "Ramipril",
                "dataset_version": "2026.1.0",
            }
        return None

    async def get_drug_by_slug(self, slug: str):
        if slug == "ramipril":
            return {
                "id": str(DRUG_ID),
                "slug": "ramipril",
                "label": "Ramipril",
                "dataset_version": "2026.1.0",
            }
        return None

    async def get_drug_education(self, drug_id: UUID, dataset_version: str | None = None):
        return [
            {
                "education": {
                    "id": "summary-1",
                    "kind": "FiveSecondSummary",
                    "text": "ACE inhibitor recall summary.",
                    "content_layer": "education",
                }
            },
            {
                "education": {
                    "id": "card-1",
                    "kind": "Flashcard",
                    "front": "ACE inhibitor suffix?",
                    "back": "-pril",
                    "content_layer": "education",
                }
            },
        ]

    async def get_prerequisites(self, drug_slug: str):
        return [{"id": "topic-1", "label": "Renin-angiotensin system"}]


@pytest.mark.asyncio
async def test_study_view_combines_drug_education_flashcards_and_prerequisites() -> None:
    service = LearningService(FakeGraphRepository())  # type: ignore[arg-type]

    data, meta = await service.get_study_view("ramipril")

    assert data["drug"]["slug"] == "ramipril"
    assert data["education"][0]["kind"] == "FiveSecondSummary"
    assert data["flashcards"][0]["front"] == "ACE inhibitor suffix?"
    assert data["prerequisites"][0]["label"] == "Renin-angiotensin system"
    assert [step["step"] for step in data["study_plan"]] == [
        "prerequisites",
        "recall",
        "practice",
    ]
    assert meta.content_layers == [
        ContentLayer.BIOMEDICAL,
        ContentLayer.EDUCATION,
        ContentLayer.LEARNING,
    ]
