"""API-level publish workflow envelope and error handling tests."""

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


async def _create_workflow(client: AsyncClient) -> str:
    response = await client.post(
        "/api/v1/curator/workflows",
        json={"entity_id": CV_STUB_DRUG_ID, "entity_type": "Drug"},
    )
    assert response.status_code == 201
    return response.json()["data"]["id"]


@pytest.mark.asyncio
async def test_submit_response_envelope(client: AsyncClient):
    workflow_id = await _create_workflow(client)

    response = await client.post(f"/api/v1/curator/workflows/{workflow_id}/submit")

    assert response.status_code == 200
    body = response.json()
    assert "data" in body
    assert "meta" in body
    assert body["meta"]["api_version"] == "v1"
    assert body["data"]["id"] == workflow_id
    assert body["data"]["state"] == "review"


@pytest.mark.asyncio
async def test_approve_response_envelope(client: AsyncClient):
    workflow_id = await _create_workflow(client)
    await client.post(f"/api/v1/curator/workflows/{workflow_id}/submit")

    response = await client.post(f"/api/v1/curator/workflows/{workflow_id}/approve")

    assert response.status_code == 200
    body = response.json()
    assert body["data"]["state"] == "approved"
    assert body["meta"]["api_version"] == "v1"


@pytest.mark.asyncio
async def test_publish_response_includes_graph_and_validation_summary(client: AsyncClient):
    package = build_cardiovascular_publish_package()
    workflow_id = await _create_workflow(client)
    await client.post(f"/api/v1/curator/workflows/{workflow_id}/submit")
    await client.post(f"/api/v1/curator/workflows/{workflow_id}/approve")

    response = await client.post(
        f"/api/v1/curator/workflows/{workflow_id}/publish",
        json=package,
    )

    assert response.status_code == 200
    data = response.json()["data"]
    assert "workflow" in data
    assert "graph_write" in data
    assert "validation_summary" in data
    assert data["workflow"]["state"] == "published"
    assert isinstance(data["graph_write"]["available"], bool)
    assert data["validation_summary"]["publish_ready"] is True


@pytest.mark.asyncio
async def test_publish_blocked_state_returns_fastapi_detail(client: AsyncClient):
    workflow_id = await _create_workflow(client)

    response = await client.post(
        f"/api/v1/curator/workflows/{workflow_id}/publish",
        json=build_cardiovascular_publish_package(),
    )

    assert response.status_code == 400
    detail = response.json()["detail"]
    assert isinstance(detail, str)
    assert detail


@pytest.mark.asyncio
async def test_submit_missing_workflow_returns_400(client: AsyncClient):
    workflow_id = str(uuid.uuid4())

    response = await client.post(f"/api/v1/curator/workflows/{workflow_id}/submit")

    assert response.status_code == 400
    assert "not found" in response.json()["detail"].lower()
