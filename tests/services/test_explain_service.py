from __future__ import annotations

from uuid import UUID

import pytest

from farmacograph.models.enums import ContentLayer
from farmacograph.services.explain import ExplainService

DRUG_ID = UUID("00000000-0000-4000-8000-000000000101")
ROOT_ID = UUID("00000000-0000-4000-8000-000000000201")


class FakeGraphRepository:
    async def get_drug_by_slug(self, slug: str, dataset_version: str | None = None):
        assert slug == "ramipril"
        return {
            "id": str(DRUG_ID),
            "slug": "ramipril",
            "label": "Ramipril",
            "entity_type": "Drug",
            "status": "published",
        }

    async def get_drug_by_id(self, drug_id: UUID, dataset_version: str | None = None):
        assert drug_id == DRUG_ID
        return {
            "id": str(DRUG_ID),
            "slug": "ramipril",
            "label": "Ramipril",
            "entity_type": "Drug",
            "status": "published",
        }

    async def get_drug_mechanism_dag(self, drug_id: UUID, dataset_version: str | None = None):
        assert drug_id == DRUG_ID
        return {
            "drug_id": str(DRUG_ID),
            "root_fragment_id": str(ROOT_ID),
            "nodes": [
                {
                    "id": str(ROOT_ID),
                    "entity_type": "MechanismFragment",
                    "label": "ACE inhibition",
                    "slug": "ace-inhibition",
                    "properties": {},
                }
            ],
            "edges": [
                {
                    "id": "edge-1",
                    "relationship_type": "HAS_MECHANISM_ROOT",
                    "source_id": str(DRUG_ID),
                    "target_id": str(ROOT_ID),
                    "source_type": "Drug",
                    "target_type": "MechanismFragment",
                    "properties": {
                        "explanation": "Ramipril starts its mechanism by inhibiting ACE.",
                        "confidence_score": 0.82,
                        "evidence_level": "moderate",
                        "evidence_ids": ["ev-ace-1"],
                    },
                }
            ],
            "clinical_outcomes": [],
            "is_acyclic": True,
        }

    async def find_explain_path(self, drug_slug: str, effect_slug: str | None = None):
        return []


@pytest.mark.asyncio
async def test_explain_mechanism_uses_published_mechanism_root() -> None:
    service = ExplainService(FakeGraphRepository())  # type: ignore[arg-type]

    response, meta = await service.explain("ramipril")

    assert response.question == "Explain ramipril mechanism"
    assert response.answer_summary == "Ramipril mechanism starts at ACE inhibition."
    assert response.confidence == 0.82
    assert response.evidence_level == "moderate"
    assert response.content_layers == [ContentLayer.BIOMEDICAL]
    assert meta.content_layers == [ContentLayer.BIOMEDICAL]
    assert len(response.reasoning_chain) == 1
    step = response.reasoning_chain[0]
    assert step.relationship == "HAS_MECHANISM_ROOT"
    assert step.evidence_ids == ["ev-ace-1"]
    assert step.from_entity.slug == "ramipril"
    assert step.to_entity.slug == "ace-inhibition"
