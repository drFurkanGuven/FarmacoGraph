"""Curator workflow integration tests — no real pharmacology data."""

from __future__ import annotations

import os
import uuid

import pytest
import pytest_asyncio
from httpx import ASGITransport, AsyncClient

os.environ.setdefault("FG_ENVIRONMENT", "test")
os.environ.setdefault("FG_DATABASE_URL", "sqlite+aiosqlite:///:memory:")
os.environ.setdefault("FG_NEO4J_ENABLED", "false")

from farmacograph.core.container import reset_container


@pytest.fixture(autouse=True)
def _reset():
    reset_container()
    yield
    reset_container()


@pytest_asyncio.fixture
async def client():
    from farmacograph.api.main import create_app
    from farmacograph.core.container import get_container

    app = create_app()
    container = get_container()
    await container.startup()
    transport = ASGITransport(app=app)
    async with AsyncClient(transport=transport, base_url="http://test") as ac:
        yield ac
    await container.shutdown()


STRUCTURAL_ENTITY_ID = str(uuid.uuid4())


@pytest.mark.asyncio
async def test_curator_full_workflow(client: AsyncClient):
    """draft → review → approved → published (Neo4j disabled — skips graph write)."""
    # Create draft
    r = await client.post(
        "/api/v1/curator/workflows",
        json={
            "entity_id": STRUCTURAL_ENTITY_ID,
            "entity_type": "Drug",
            "notes": "Structural test stub — not real pharmacology",
        },
    )
    assert r.status_code == 201
    workflow_id = r.json()["data"]["id"]
    assert r.json()["data"]["state"] == "draft"

    # Submit
    r = await client.post(f"/api/v1/curator/workflows/{workflow_id}/submit")
    assert r.status_code == 200
    assert r.json()["data"]["state"] == "review"

    # Approve
    r = await client.post(f"/api/v1/curator/workflows/{workflow_id}/approve")
    assert r.status_code == 200
    assert r.json()["data"]["state"] == "approved"

    # Publish
    r = await client.post(
        f"/api/v1/curator/workflows/{workflow_id}/publish",
        json={
            "entity_payload": {
                "id": STRUCTURAL_ENTITY_ID,
                "entity_type": "Drug",
                "slug": "structural-test-stub",
                "label": "Structural Test Stub",
                "generic_name": "Structural Test Stub",
                "status": "published",
            },
            "dataset_version": "2026.1.0",
        },
    )
    assert r.status_code == 200
    assert r.json()["data"]["state"] == "published"


@pytest.mark.asyncio
async def test_cannot_publish_from_draft(client: AsyncClient):
    r = await client.post(
        "/api/v1/curator/workflows",
        json={"entity_id": str(uuid.uuid4()), "entity_type": "Drug"},
    )
    workflow_id = r.json()["data"]["id"]
    r = await client.post(
        f"/api/v1/curator/workflows/{workflow_id}/publish",
        json={"entity_payload": {"id": "x", "entity_type": "Drug"}},
    )
    assert r.status_code == 400


@pytest.mark.asyncio
async def test_review_queue(client: AsyncClient):
    entity_id = str(uuid.uuid4())
    r = await client.post(
        "/api/v1/curator/workflows",
        json={"entity_id": entity_id, "entity_type": "Drug"},
    )
    workflow_id = r.json()["data"]["id"]
    await client.post(f"/api/v1/curator/workflows/{workflow_id}/submit")

    r = await client.get("/api/v1/curator/queue?state=review")
    assert r.status_code == 200
    assert r.json()["meta"]["count"] >= 1
