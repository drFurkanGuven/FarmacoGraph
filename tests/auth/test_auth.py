"""Auth endpoint and dependency tests."""

from __future__ import annotations

import os
import uuid

import pytest
import pytest_asyncio
from httpx import ASGITransport, AsyncClient

os.environ.setdefault("FG_ENVIRONMENT", "test")
os.environ.setdefault("FG_DATABASE_URL", "sqlite+aiosqlite:///:memory:")
os.environ.setdefault("FG_NEO4J_ENABLED", "false")
os.environ.setdefault("FG_JWT_SECRET_KEY", "test-secret-key-32-characters-min")

from farmacograph.auth.models import (
    create_refresh_token,
    decode_access_token,
)
from farmacograph.core.config import get_settings
from farmacograph.core.container import get_container, reset_container
from tests.auth.helpers import bearer_headers, seed_api_key, seed_curator_user


@pytest.fixture(autouse=True)
def _reset():
    reset_container()
    yield
    reset_container()


@pytest_asyncio.fixture
async def client():
    from farmacograph.api.main import create_app

    app = create_app()
    container = get_container()
    await container.startup()
    transport = ASGITransport(app=app)
    async with AsyncClient(transport=transport, base_url="http://test") as ac:
        yield ac
    await container.shutdown()


@pytest.mark.asyncio
async def test_password_token_and_refresh(client: AsyncClient):
    container = get_container()
    settings = get_settings()
    user, password = await seed_curator_user(container.session_factory)

    r = await client.post(
        "/api/v1/auth/token",
        json={"grant_type": "password", "username": user.email, "password": password},
    )
    assert r.status_code == 200
    body = r.json()
    assert body["token_type"] == "bearer"
    assert "curator:write" in body["scopes"]
    assert body["email"] == user.email

    payload = decode_access_token(body["access_token"], settings)
    assert payload["sub"] == str(user.id)

    r2 = await client.post("/api/v1/auth/refresh", json={"refresh_token": body["refresh_token"]})
    assert r2.status_code == 200
    assert r2.json()["access_token"] != body["access_token"]


@pytest.mark.asyncio
async def test_api_key_token_grant(client: AsyncClient):
    container = get_container()
    settings = get_settings()
    full_key, _ = await seed_api_key(container.session_factory, settings)

    r = await client.post(
        "/api/v1/auth/token",
        json={"grant_type": "api_key", "api_key": full_key},
    )
    assert r.status_code == 200
    assert "curator:write" in r.json()["scopes"]


@pytest.mark.asyncio
async def test_api_key_bearer_auth_on_protected_route(client: AsyncClient):
    container = get_container()
    settings = get_settings()
    full_key, _ = await seed_api_key(container.session_factory, settings)

    r = await client.post(
        "/api/v1/curator/workflows",
        headers=bearer_headers(full_key),
        json={"entity_id": str(uuid.uuid4()), "entity_type": "Drug"},
    )
    assert r.status_code == 201


@pytest.mark.asyncio
async def test_refresh_token_rejected_as_bearer(client: AsyncClient):
    settings = get_settings()
    token = create_refresh_token(str(uuid.uuid4()), settings, scopes=["curator:write"])
    r = await client.post(
        "/api/v1/curator/workflows",
        headers=bearer_headers(token),
        json={"entity_id": str(uuid.uuid4()), "entity_type": "Drug"},
    )
    assert r.status_code == 401


@pytest.mark.asyncio
async def test_anonymous_curator_write_denied(client: AsyncClient):
    r = await client.post(
        "/api/v1/curator/workflows",
        json={"entity_id": str(uuid.uuid4()), "entity_type": "Drug"},
    )
    assert r.status_code == 401


@pytest.mark.asyncio
async def test_anonymous_read_still_allowed_in_test_env(client: AsyncClient):
    r = await client.get("/api/v1/drugs")
    assert r.status_code == 200


@pytest.mark.asyncio
async def test_invalid_password_rejected(client: AsyncClient):
    container = get_container()
    user, _ = await seed_curator_user(container.session_factory)

    r = await client.post(
        "/api/v1/auth/token",
        json={"grant_type": "password", "username": user.email, "password": "wrong"},
    )
    assert r.status_code == 401


@pytest.mark.asyncio
async def test_jwt_secret_rejected_in_production():
    from farmacograph.core.config import Settings

    insecure = "dev-only-jwt-secret-change-in-production"
    with pytest.raises(ValueError, match="FG_JWT_SECRET_KEY"):
        Settings(environment="production", jwt_secret_key=insecure)
