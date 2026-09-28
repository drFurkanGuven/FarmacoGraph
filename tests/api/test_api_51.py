"""API 5.1 — info and search tests."""

from __future__ import annotations

import os

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


@pytest.mark.asyncio
async def test_api_info(client: AsyncClient):
    r = await client.get("/api/v1/info")
    assert r.status_code == 200
    data = r.json()["data"]
    assert data["api_version"] == "v1"
    assert "authentication" in data
    assert data["endpoints"]["search"] == "/api/v1/search"


@pytest.mark.asyncio
async def test_search_staging_fallback_without_neo4j(client: AsyncClient):
    r = await client.get("/api/v1/search?q=met")
    assert r.status_code == 200
    slugs = [row["slug"] for row in r.json()["data"]]
    assert "metoprolol" in slugs
    assert r.json()["meta"].get("provenance") == "staging-fallback"


@pytest.mark.asyncio
async def test_search_empty_query_without_neo4j(client: AsyncClient):
    r = await client.get("/api/v1/search?q=zzz_no_such_drug_xyz")
    assert r.status_code == 200
    assert r.json()["data"] == []


@pytest.mark.asyncio
async def test_drug_graph_endpoint_fallback(client: AsyncClient):
    metoprolol_id = "bb260890-9589-5ede-b29d-937e4b73d5ee"
    r = await client.get(f"/api/v1/drugs/{metoprolol_id}/graph?depth=2")
    assert r.status_code == 200
    body = r.json()
    assert "data" in body
    data = body["data"]
    assert data["drug_in_graph"] is True
    assert len(data["nodes"]) >= 6
    assert len(data["edges"]) >= 5
    node_ids = {n["id"] for n in data["nodes"]}
    assert metoprolol_id in node_ids

