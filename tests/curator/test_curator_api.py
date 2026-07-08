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
from farmacograph.curator.structural_stub import (
    CV_STUB_DRUG_ID,
    build_cardiovascular_publish_package,
)
from tests.auth.helpers import bearer_headers, curator_token, seed_curator_user


@pytest.fixture(autouse=True)
def _reset():
    reset_container()
    yield
    reset_container()


@pytest_asyncio.fixture
async def client():
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
    async with AsyncClient(transport=transport, base_url="http://test", headers=auth) as ac:
        yield ac
    await container.shutdown()


@pytest.mark.asyncio
async def test_curator_full_workflow(client: AsyncClient):
    """draft → review → approved → published with structural stub package."""
    package = build_cardiovascular_publish_package()
    r = await client.post(
        "/api/v1/curator/workflows",
        json={
            "entity_id": CV_STUB_DRUG_ID,
            "entity_type": "Drug",
            "notes": "Structural test stub — not real pharmacology",
        },
    )
    assert r.status_code == 201
    workflow_id = r.json()["data"]["id"]

    await client.post(f"/api/v1/curator/workflows/{workflow_id}/submit")
    await client.post(f"/api/v1/curator/workflows/{workflow_id}/approve")

    r = await client.post(
        f"/api/v1/curator/workflows/{workflow_id}/publish",
        json=package,
    )
    assert r.status_code == 200
    assert r.json()["data"]["state"] == "published"


@pytest.mark.asyncio
async def test_cannot_publish_invalid_payload(client: AsyncClient):
    r = await client.post(
        "/api/v1/curator/workflows",
        json={"entity_id": str(uuid.uuid4()), "entity_type": "Drug"},
    )
    workflow_id = r.json()["data"]["id"]
    await client.post(f"/api/v1/curator/workflows/{workflow_id}/submit")
    await client.post(f"/api/v1/curator/workflows/{workflow_id}/approve")

    r = await client.post(
        f"/api/v1/curator/workflows/{workflow_id}/publish",
        json={"entity_payload": {"id": "x", "entity_type": "Drug", "status": "published"}},
    )
    assert r.status_code == 400


@pytest.mark.asyncio
async def test_cardiovascular_stub_endpoint(client: AsyncClient):
    r = await client.get("/api/v1/curator/stubs/cardiovascular")
    assert r.status_code == 200
    assert r.json()["data"]["module"] == "cardiovascular"


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
