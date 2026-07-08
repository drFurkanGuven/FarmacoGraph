"""Disease API route tests."""

from __future__ import annotations

import os

import pytest
import pytest_asyncio
from httpx import ASGITransport, AsyncClient

os.environ.setdefault("FG_ENVIRONMENT", "test")
os.environ.setdefault("FG_DATABASE_URL", "sqlite+aiosqlite:///:memory:")
os.environ.setdefault("FG_NEO4J_ENABLED", "false")

from farmacograph.core.container import reset_container
from tests.auth.helpers import bearer_headers, curator_token, seed_curator_user

HYPERTENSION_ID = "d1000001-0000-4000-8010-000000000001"


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
async def test_list_diseases_returns_catalog(client: AsyncClient):
    response = await client.get("/api/v1/diseases")
    assert response.status_code == 200
    body = response.json()
    slugs = {row["slug"] for row in body["data"]}
    assert "hypertension" in slugs
    assert "angina-pectoris" in slugs
    assert body["meta"]["total"] >= 2


@pytest.mark.asyncio
async def test_get_disease_by_uuid(client: AsyncClient):
    response = await client.get(f"/api/v1/diseases/{HYPERTENSION_ID}")
    assert response.status_code == 200
    assert response.json()["data"]["slug"] == "hypertension"


@pytest.mark.asyncio
async def test_curator_disease_browser(client: AsyncClient):
    response = await client.get("/api/v1/curator/diseases")
    assert response.status_code == 200
    body = response.json()
    assert any(row["slug"] == "hypertension" for row in body["data"])


@pytest.mark.asyncio
async def test_open_disease_workflow_creates_draft(client: AsyncClient):
    response = await client.post("/api/v1/curator/diseases/hypertension/workflows")
    assert response.status_code == 201
    body = response.json()["data"]
    assert body["workflow"]["entity_type"] == "Disease"
    assert body["package"]["entity_payload"]["slug"] == "hypertension"
    assert body["package"]["entity_payload"]["entity_type"] == "Disease"


@pytest.mark.asyncio
async def test_get_disease_package(client: AsyncClient):
    await client.post("/api/v1/curator/diseases/hypertension/workflows")
    response = await client.get("/api/v1/curator/diseases/hypertension/package")
    assert response.status_code == 200
    assert response.json()["data"]["entity_payload"]["slug"] == "hypertension"


@pytest.mark.asyncio
async def test_get_disease_workflow_state(client: AsyncClient):
    await client.post("/api/v1/curator/diseases/hypertension/workflows")
    response = await client.get("/api/v1/curator/diseases/hypertension/workflow-state")
    assert response.status_code == 200
    body = response.json()["data"]
    assert body["slug"] == "hypertension"
    assert body["entity_id"] == HYPERTENSION_ID
    assert body["workflow_id"]
    assert body["status"] == "draft"
    assert body["package"]["entity_payload"]["entity_type"] == "Disease"


@pytest.mark.asyncio
async def test_curator_disease_routes_are_in_openapi(client: AsyncClient):
    response = await client.get("/api/v1/openapi.json")
    assert response.status_code == 200
    paths = response.json()["paths"]
    assert "/curator/diseases" in paths
    assert "/curator/diseases/{slug}/workflows" in paths
    assert "/curator/diseases/{slug}/package" in paths
    assert "/curator/diseases/{slug}/workflow-state" in paths
