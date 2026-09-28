"""Test Interactions API endpoint."""

from __future__ import annotations

import os
from uuid import UUID

import pytest
from httpx import ASGITransport, AsyncClient

os.environ["FG_ENVIRONMENT"] = "test"
os.environ["FG_DATABASE_URL"] = "sqlite+aiosqlite:///:memory:"
os.environ["FG_NEO4J_ENABLED"] = "false"

from farmacograph.api.deps import get_interaction_service
from farmacograph.api.main import create_app
from farmacograph.api.schemas.responses import (
    DrugInteractionItem,
    EntitySummary,
    InteractionResponse,
    InteractionSeverity,
    ResponseMeta,
)
from farmacograph.models.enums import ContentLayer, EntityType

RAMIPRIL_ID = UUID("2c31ee65-5805-5693-bdeb-01bb4829b1b9")
LOSARTAN_ID = UUID("04fe6ccc-c02e-5256-b362-af0fd4adff98")


class FakeInteractionService:
    async def analyze(
        self,
        drug_ids: list[UUID] | None = None,
        slugs: list[str] | None = None,
    ) -> tuple[InteractionResponse, ResponseMeta]:
        interactions = [
            DrugInteractionItem(
                drug_a_id=RAMIPRIL_ID,
                drug_b_id=LOSARTAN_ID,
                severity=InteractionSeverity.CONTRAINDICATED,
                title="Dual RAAS Blockade: Ramipril + Losartan",
                mechanism_explanation="Dual inhibition of the renin-angiotensin-aldosterone system.",
                clinical_action="Avoid combination; discontinue one agent.",
                pathway_overlap=["RAAS", "AT1 Signaling"],
            )
        ]
        checked_drugs = [
            EntitySummary(
                id=RAMIPRIL_ID,
                type=EntityType.DRUG,
                slug="ramipril",
                label="Ramipril",
                status="published",
            ),
            EntitySummary(
                id=LOSARTAN_ID,
                type=EntityType.DRUG,
                slug="losartan",
                label="Losartan",
                status="published",
            ),
        ]
        meta = ResponseMeta(
            dataset_version="2026.1.0",
            ontology_version="1.0.0",
            content_layers=[ContentLayer.BIOMEDICAL],
        )
        return InteractionResponse(interactions=interactions, checked_drugs=checked_drugs), meta


@pytest.mark.asyncio
async def test_interactions_api_with_slugs() -> None:
    from farmacograph.core.container import get_container
    container = get_container()
    container.interaction_service = FakeInteractionService()  # type: ignore[assignment]
    app = create_app()

    transport = ASGITransport(app=app)
    async with AsyncClient(transport=transport, base_url="http://test") as client:
        payload = {"slugs": ["ramipril", "losartan"]}
        r = await client.post("/api/v1/interactions", json=payload)
        assert r.status_code == 200
        body = r.json()

        assert "data" in body
        assert "meta" in body
        data = body["data"]
        assert len(data["interactions"]) == 1
        assert data["interactions"][0]["severity"] == "contraindicated"
        assert len(data["checked_drugs"]) == 2


@pytest.mark.asyncio
async def test_interactions_api_with_raw_list() -> None:
    from farmacograph.core.container import get_container
    container = get_container()
    container.interaction_service = FakeInteractionService()  # type: ignore[assignment]
    app = create_app()

    transport = ASGITransport(app=app)
    async with AsyncClient(transport=transport, base_url="http://test") as client:
        payload = ["ramipril", "losartan"]
        r = await client.post("/api/v1/interactions", json=payload)
        assert r.status_code == 200
        body = r.json()
        assert len(body["data"]["interactions"]) == 1


@pytest.mark.asyncio
async def test_interactions_api_with_drug_ids() -> None:
    from farmacograph.core.container import get_container
    container = get_container()
    container.interaction_service = FakeInteractionService()  # type: ignore[assignment]
    app = create_app()

    transport = ASGITransport(app=app)
    async with AsyncClient(transport=transport, base_url="http://test") as client:
        payload = {"drug_ids": [str(RAMIPRIL_ID), str(LOSARTAN_ID)]}
        r = await client.post("/api/v1/interactions", json=payload)
        assert r.status_code == 200
        body = r.json()
        assert body["data"]["interactions"][0]["title"] == "Dual RAAS Blockade: Ramipril + Losartan"

