"""Shared fixtures for OpenAPI contract tests."""

from __future__ import annotations

import os

import pytest
import pytest_asyncio
from httpx import ASGITransport, AsyncClient

from tests.api.contract.helpers import load_openapi

os.environ.setdefault("FG_ENVIRONMENT", "test")
os.environ.setdefault("FG_DATABASE_URL", "sqlite+aiosqlite:///:memory:")
os.environ.setdefault("FG_NEO4J_ENABLED", "false")
os.environ.setdefault("FG_LOG_JSON", "false")

from farmacograph.core.container import reset_container
from tests.auth.helpers import bearer_headers, curator_token, seed_curator_user


@pytest.fixture(scope="session")
def openapi_spec() -> dict:
    return load_openapi()


@pytest.fixture(autouse=True)
def _reset_container() -> None:
    reset_container()
    yield
    reset_container()


@pytest_asyncio.fixture
async def contract_client() -> AsyncClient:
    from farmacograph.api.main import create_app
    from farmacograph.core.container import get_container

    app = create_app()
    container = get_container()
    await container.startup()
    transport = ASGITransport(app=app)
    async with AsyncClient(transport=transport, base_url="http://test") as client:
        yield client
    await container.shutdown()


@pytest_asyncio.fixture
async def curator_contract_client() -> AsyncClient:
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
    async with AsyncClient(transport=transport, base_url="http://test", headers=auth) as client:
        yield client
    await container.shutdown()
