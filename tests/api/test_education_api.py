"""Education API route tests."""

from __future__ import annotations

import os

import pytest
import pytest_asyncio
from httpx import ASGITransport, AsyncClient

os.environ.setdefault("FG_ENVIRONMENT", "test")
os.environ.setdefault("FG_DATABASE_URL", "sqlite+aiosqlite:///:memory:")
os.environ.setdefault("FG_NEO4J_ENABLED", "false")
os.environ.setdefault("FG_LOG_JSON", "false")

from farmacograph.core.container import reset_container
from farmacograph.curator.drug_package import drug_entity_id
from tests.auth.helpers import bearer_headers, curator_token, seed_curator_user

RAMIPRIL_ID = drug_entity_id("ramipril")


@pytest.fixture(autouse=True)
def _reset():
    reset_container()
    yield
    reset_container()


@pytest_asyncio.fixture
async def api_client() -> AsyncClient:
    from farmacograph.api.main import create_app
    from farmacograph.core.container import get_container

    app = create_app()
    container = get_container()
    await container.startup()
    transport = ASGITransport(app=app)
    async with AsyncClient(transport=transport, base_url="http://test") as client:
        yield client
    await container.shutdown()


@pytest_asyncio.fixture
async def curator_client() -> AsyncClient:
    from farmacograph.api.main import create_app
    from farmacograph.core.config import get_settings
    from farmacograph.core.container import get_container

    app = create_app()
    container = get_container()
    await container.startup()
    user, _ = await seed_curator_user(container.session_factory)
    settings = get_settings()
    auth = bearer_headers(curator_token(settings, user.id))
    transport = ASGITransport(app=app)
    async with AsyncClient(transport=transport, base_url="http://test", headers=auth) as client:
        yield client
    await container.shutdown()


@pytest.mark.asyncio
async def test_drug_education_uuid_route_returns_education_envelope(
    api_client: AsyncClient,
) -> None:
    response = await api_client.get(f"/api/v1/drugs/{RAMIPRIL_ID}/education")

    assert response.status_code == 200
    body = response.json()
    assert body["data"] == []
    assert body["meta"]["count"] == 0
    assert body["meta"]["content_layers"] == ["education"]


@pytest.mark.asyncio
async def test_curator_drug_education_returns_draft_items(
    curator_client: AsyncClient,
) -> None:
    opened = await curator_client.post("/api/v1/curator/drugs/ramipril/workflows")
    assert opened.status_code == 201
    payload = opened.json()["data"]["package"]
    workflow_id = opened.json()["data"]["workflow"]["id"]
    payload["education"] = [
        {
            "id": f"{RAMIPRIL_ID}:education:FiveSecondSummary",
            "entity_type": "EducationResource",
            "kind": "FiveSecondSummary",
            "slug": "ramipril-five-second-summary",
            "label": "Ramipril five second summary",
            "text": "ACE inhibitor high-yield summary.",
            "content_layer": "education",
            "audience": ["medical_student"],
            "difficulty_level": "core",
            "language": "en",
            "linked_entity_ids": [RAMIPRIL_ID],
        }
    ]

    saved = await curator_client.put(
        f"/api/v1/curator/workflows/{workflow_id}/package", json=payload
    )
    assert saved.status_code == 200

    response = await curator_client.get("/api/v1/curator/drugs/ramipril/education")

    assert response.status_code == 200
    body = response.json()
    assert body["meta"]["slug"] == "ramipril"
    assert body["meta"]["count"] == 1
    assert body["data"][0]["kind"] == "FiveSecondSummary"
    assert body["data"][0]["content_layer"] == "education"
