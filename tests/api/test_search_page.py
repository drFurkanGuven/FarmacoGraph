"""Public search page tests."""

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
    async with AsyncClient(transport=transport, base_url="http://test", follow_redirects=False) as ac:
        yield ac
    await container.shutdown()


@pytest.mark.asyncio
async def test_root_redirects_to_docs(client: AsyncClient):
    r = await client.get("/")
    assert r.status_code == 307
    assert r.headers["location"] == "/docs"


@pytest.mark.asyncio
async def test_search_page_html(client: AsyncClient):
    r = await client.get("/search")
    assert r.status_code == 200
    assert "text/html" in r.headers["content-type"]
    assert "FarmacoGraph" in r.text
    assert "/api/v1/search" in r.text
