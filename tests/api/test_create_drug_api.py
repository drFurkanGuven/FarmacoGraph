"""POST /curator/drugs create API tests."""

from __future__ import annotations

import os
from pathlib import Path

import pytest
import pytest_asyncio
from httpx import ASGITransport, AsyncClient

os.environ.setdefault("FG_ENVIRONMENT", "test")
os.environ.setdefault("FG_DATABASE_URL", "sqlite+aiosqlite:///:memory:")
os.environ.setdefault("FG_NEO4J_ENABLED", "false")

from farmacograph.core.container import reset_container
from tests.auth.helpers import bearer_headers, curator_token, seed_curator_user


@pytest.fixture(autouse=True)
def _runtime(tmp_path: Path, monkeypatch: pytest.MonkeyPatch):
    monkeypatch.setenv("FG_DRUG_CATALOG_PATH", str(tmp_path / "drugs.runtime.json"))
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
async def test_list_drug_classes(client: AsyncClient):
    response = await client.get("/api/v1/curator/drug-classes")
    assert response.status_code == 200
    assert any(row["slug"] == "ace-inhibitors" for row in response.json()["data"])


@pytest.mark.asyncio
async def test_list_drug_classes_by_module(client: AsyncClient):
    response = await client.get(
        "/api/v1/curator/drug-classes",
        params={"module": "psychiatry"},
    )
    assert response.status_code == 200
    data = response.json()["data"]
    assert data
    assert all(row["module"] == "psychiatry" for row in data)
    assert any(row["slug"] == "antidepressants" for row in data)


@pytest.mark.asyncio
async def test_create_drug_with_class(client: AsyncClient):
    response = await client.post(
        "/api/v1/curator/drugs",
        json={
            "slug": "trandolapril",
            "label": "Trandolapril",
            "drug_class_slug": "ace-inhibitors",
            "module": "cardiovascular",
            "description": "ACE inhibitor",
        },
    )
    assert response.status_code == 201, response.text
    body = response.json()["data"]
    assert body["entity"]["slug"] == "trandolapril"
    assert body["entity"]["module"] == "cardiovascular"
    assert body["workflow"]["state"] == "draft"
    assert body["package"]["entity_payload"]["relationships"]["BELONGS_TO"]
    assert body["package"]["module"] == "cardiovascular"

    listed = await client.get("/api/v1/curator/drugs", params={"search": "trandolapril"})
    assert listed.status_code == 200
    assert any(row["slug"] == "trandolapril" for row in listed.json()["data"])


@pytest.mark.asyncio
async def test_create_drug_other_module(client: AsyncClient):
    response = await client.post(
        "/api/v1/curator/drugs",
        json={
            "slug": "sertraline",
            "label": "Sertraline",
            "drug_class_slug": "antidepressants",
            "module": "psychiatry",
        },
    )
    assert response.status_code == 201, response.text
    body = response.json()["data"]
    assert body["entity"]["module"] == "psychiatry"
    assert body["package"]["module"] == "psychiatry"

    listed = await client.get(
        "/api/v1/curator/drugs",
        params={"module": "psychiatry", "search": "sertraline"},
    )
    assert listed.status_code == 200
    assert any(row["slug"] == "sertraline" for row in listed.json()["data"])
