"""Curator drug browser API tests."""

from __future__ import annotations

import os

import pytest
import pytest_asyncio
from httpx import ASGITransport, AsyncClient

os.environ.setdefault("FG_ENVIRONMENT", "test")
os.environ.setdefault("FG_DATABASE_URL", "sqlite+aiosqlite:///:memory:")
os.environ.setdefault("FG_NEO4J_ENABLED", "false")
os.environ.setdefault("FG_JWT_SECRET_KEY", "test-secret-key-32-characters-min")

from farmacograph.core.container import reset_container
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
async def test_curator_drug_browser_lists_ramipril(client: AsyncClient):
    r = await client.get("/api/v1/curator/drugs?module=cardiovascular&search=ramipril")
    assert r.status_code == 200
    data = r.json()["data"]
    assert any(row["slug"] == "ramipril" for row in data)


@pytest.mark.asyncio
async def test_open_ramipril_workflow_returns_package(client: AsyncClient):
    r = await client.post("/api/v1/curator/drugs/ramipril/workflows")
    assert r.status_code == 201
    body = r.json()["data"]
    assert body["package"]["entity_payload"]["slug"] == "ramipril"
    assert "validation" in body
