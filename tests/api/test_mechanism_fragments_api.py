"""Mechanism fragment catalog API tests."""

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
    from tests.auth.helpers import bearer_headers, curator_token, seed_curator_user

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
async def test_list_mechanism_fragments_returns_catalog(client: AsyncClient):
    response = await client.get("/api/v1/curator/mechanism-fragments")
    assert response.status_code == 200
    body = response.json()
    assert body["meta"]["total"] >= 1
    assert any(row["slug"] == "ace-inhibition" for row in body["data"])


@pytest.mark.asyncio
async def test_list_mechanism_fragments_search(client: AsyncClient):
    response = await client.get("/api/v1/curator/mechanism-fragments", params={"search": "ace"})
    assert response.status_code == 200
    body = response.json()
    assert body["meta"]["total"] >= 1
    assert all("ace" in row["slug"] or "ace" in row["label"].lower() for row in body["data"])


@pytest.mark.asyncio
async def test_create_mechanism_fragment(client: AsyncClient, tmp_path, monkeypatch):
    runtime = tmp_path / "mechanisms.runtime.json"
    monkeypatch.setenv("FG_MECHANISM_CATALOG_PATH", str(runtime))
    response = await client.post(
        "/api/v1/curator/mechanism-fragments",
        json={
            "slug": "nitric-oxide-release",
            "label": "Nitric oxide release",
            "description": "Pathway editor test fragment",
        },
    )
    assert response.status_code == 201
    body = response.json()
    assert body["data"]["entity"]["slug"] == "nitric-oxide-release"
    assert body["data"]["entity"]["entity_type"] == "MechanismFragment"

    listed = await client.get(
        "/api/v1/curator/mechanism-fragments", params={"search": "nitric-oxide-release"}
    )
    assert listed.status_code == 200
    assert any(row["slug"] == "nitric-oxide-release" for row in listed.json()["data"])


@pytest.mark.asyncio
async def test_create_mechanism_fragment_rejects_duplicate(client: AsyncClient):
    response = await client.post(
        "/api/v1/curator/mechanism-fragments",
        json={"slug": "ace-inhibition", "label": "ACE inhibition"},
    )
    assert response.status_code == 400


@pytest.mark.asyncio
async def test_openapi_includes_mechanism_fragments(client: AsyncClient):
    response = await client.get("/api/v1/openapi.json")
    assert response.status_code == 200
    paths = response.json()["paths"]
    assert "/api/v1/curator/mechanism-fragments" in paths or "/curator/mechanism-fragments" in paths
    post = paths.get("/api/v1/curator/mechanism-fragments") or paths.get(
        "/curator/mechanism-fragments"
    )
    assert "post" in post
