"""Snapshot API tests — read-only release manifest routes."""

from __future__ import annotations

import os

import pytest
import pytest_asyncio
from httpx import ASGITransport, AsyncClient

from farmacograph.core.container import reset_container

os.environ.setdefault("FG_ENVIRONMENT", "test")
os.environ.setdefault("FG_DATABASE_URL", "sqlite+aiosqlite:///:memory:")
os.environ.setdefault("FG_NEO4J_ENABLED", "false")


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
    from tests.auth.helpers import bearer_headers, curator_token, seed_curator_user

    user, _ = await seed_curator_user(container.session_factory)
    settings = get_settings()
    auth = bearer_headers(curator_token(settings, user.id))
    transport = ASGITransport(app=app)
    async with AsyncClient(transport=transport, base_url="http://test", headers=auth) as ac:
        yield ac
    await container.shutdown()


@pytest.mark.asyncio
async def test_list_snapshots_empty(client: AsyncClient) -> None:
    response = await client.get("/api/v1/snapshots")
    assert response.status_code == 200
    body = response.json()
    assert isinstance(body["data"], list)
    assert body["meta"]["api_version"] == "v1"
    assert body["meta"]["total"] == 0


@pytest.mark.asyncio
async def test_get_snapshot_not_found(client: AsyncClient) -> None:
    response = await client.get("/api/v1/snapshots/2026.9.9-missing")
    assert response.status_code == 404
    body = response.json()
    assert body["detail"]["code"] == "not_found"


@pytest.mark.asyncio
async def test_list_and_get_snapshot_after_create(client: AsyncClient) -> None:
    from farmacograph.core.container import get_container

    container = get_container()
    created = await container.snapshot_service.create_module_snapshot(
        "cardiovascular",
        "2026.1.0-snapshot-test",
    )
    assert created.version_tag == "2026.1.0-snapshot-test"

    listed = await client.get("/api/v1/snapshots")
    assert listed.status_code == 200
    rows = listed.json()["data"]
    assert len(rows) == 1
    assert rows[0]["version_tag"] == "2026.1.0-snapshot-test"
    assert rows[0]["module"] == "cardiovascular"
    assert rows[0]["entity_count"] >= 0

    detail = await client.get("/api/v1/snapshots/2026.1.0-snapshot-test")
    assert detail.status_code == 200
    assert detail.json()["data"]["id"] == str(created.id)
    assert detail.json()["data"]["manifest"]["module"] == "cardiovascular"


@pytest.mark.asyncio
async def test_snapshots_openapi_paths(client: AsyncClient) -> None:
    response = await client.get("/api/v1/openapi.json")
    assert response.status_code == 200
    paths = response.json()["paths"]
    assert "/snapshots" in paths
    assert "/snapshots/{version_tag}" in paths
