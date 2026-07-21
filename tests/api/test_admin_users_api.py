"""Admin users + API keys API tests."""

from __future__ import annotations

import os

import pytest
import pytest_asyncio
from httpx import ASGITransport, AsyncClient

os.environ.setdefault("FG_ENVIRONMENT", "test")
os.environ.setdefault("FG_DATABASE_URL", "sqlite+aiosqlite:///:memory:")
os.environ.setdefault("FG_NEO4J_ENABLED", "false")

from farmacograph.core.container import reset_container
from tests.auth.helpers import (
    admin_token,
    bearer_headers,
    curator_token,
    seed_admin_user,
    seed_curator_user,
)


@pytest.fixture(autouse=True)
def _reset():
    reset_container()
    yield
    reset_container()


@pytest_asyncio.fixture
async def admin_client():
    from farmacograph.api.main import create_app
    from farmacograph.core.config import get_settings
    from farmacograph.core.container import get_container

    app = create_app()
    container = get_container()
    await container.startup()
    user, _ = await seed_admin_user(container.session_factory)
    settings = get_settings()
    auth = bearer_headers(admin_token(settings, user.id))
    transport = ASGITransport(app=app)
    async with AsyncClient(transport=transport, base_url="http://test", headers=auth) as ac:
        yield ac
    await container.shutdown()


@pytest_asyncio.fixture
async def curator_client():
    from farmacograph.api.main import create_app
    from farmacograph.core.config import get_settings
    from farmacograph.core.container import get_container

    app = create_app()
    container = get_container()
    await container.startup()
    user, _ = await seed_curator_user(container.session_factory, email="plain@test.local")
    settings = get_settings()
    auth = bearer_headers(curator_token(settings, user.id))
    transport = ASGITransport(app=app)
    async with AsyncClient(transport=transport, base_url="http://test", headers=auth) as ac:
        yield ac
    await container.shutdown()


@pytest.mark.asyncio
async def test_curator_cannot_list_users(curator_client: AsyncClient):
    response = await curator_client.get("/api/v1/users")
    assert response.status_code == 403


@pytest.mark.asyncio
async def test_admin_create_list_update_user(admin_client: AsyncClient):
    created = await admin_client.post(
        "/api/v1/users",
        json={
            "email": "new.curator@test.local",
            "password": "strong-password-12",
            "full_name": "New Curator",
            "role": "curator",
        },
    )
    assert created.status_code == 201
    user = created.json()["data"]
    assert user["email"] == "new.curator@test.local"
    assert user["role"] == "curator"
    assert "curator:write" in user["scopes"]

    listed = await admin_client.get("/api/v1/users", params={"search": "new.curator"})
    assert listed.status_code == 200
    assert any(row["id"] == user["id"] for row in listed.json()["data"])

    updated = await admin_client.patch(
        f"/api/v1/users/{user['id']}",
        json={"role": "administrator", "full_name": "Promoted Admin"},
    )
    assert updated.status_code == 200
    body = updated.json()["data"]
    assert body["role"] == "administrator"
    assert "admin:org" in body["scopes"]
    assert body["full_name"] == "Promoted Admin"


@pytest.mark.asyncio
async def test_admin_api_key_create_and_revoke(admin_client: AsyncClient):
    created = await admin_client.post(
        "/api/v1/users",
        json={
            "email": "keys@test.local",
            "password": "strong-password-12",
            "role": "curator",
        },
    )
    user_id = created.json()["data"]["id"]

    key = await admin_client.post(
        f"/api/v1/users/{user_id}/api-keys",
        json={"name": "CI"},
    )
    assert key.status_code == 201
    payload = key.json()["data"]
    assert payload["name"] == "CI"
    assert payload["api_key"].startswith("fg_")
    assert payload["is_active"] is True
    key_id = payload["id"]

    listed = await admin_client.get(f"/api/v1/users/{user_id}/api-keys")
    assert listed.status_code == 200
    assert any(row["id"] == key_id for row in listed.json()["data"])
    assert all("api_key" not in row for row in listed.json()["data"])

    revoked = await admin_client.post(f"/api/v1/users/{user_id}/api-keys/{key_id}/revoke")
    assert revoked.status_code == 200
    assert revoked.json()["data"]["is_active"] is False

    # Key can authenticate until revoked — after revoke, token grant fails
    login = await admin_client.post(
        "/api/v1/auth/token",
        json={"grant_type": "api_key", "api_key": payload["api_key"]},
    )
    assert login.status_code == 401


@pytest.mark.asyncio
async def test_users_routes_in_openapi(admin_client: AsyncClient):
    response = await admin_client.get("/api/v1/openapi.json")
    assert response.status_code == 200
    paths = response.json()["paths"]
    assert "/users" in paths
    assert "/users/{user_id}" in paths
    assert "/users/{user_id}/api-keys" in paths
    assert "/users/{user_id}/api-keys/{key_id}/revoke" in paths


@pytest.mark.asyncio
async def test_demo_request_approval_creates_read_only_viewer(admin_client: AsyncClient):
    requested = await admin_client.post(
        "/api/v1/demo-requests",
        json={
            "email": "demo.viewer@test.local",
            "full_name": "Demo Viewer",
            "organization": "Teaching Hospital",
            "intended_use": "Evaluate the knowledge browsing workflow.",
            "website": "",
        },
    )
    assert requested.status_code == 202
    request_id = requested.json()["data"]["id"]

    pending = await admin_client.get("/api/v1/demo-requests")
    assert pending.status_code == 200
    assert any(row["id"] == request_id for row in pending.json()["data"])

    approved = await admin_client.post(f"/api/v1/demo-requests/{request_id}/approve")
    assert approved.status_code == 200
    approval = approved.json()["data"]
    assert approval["temporary_password"]
    assert approval["user_id"]

    login = await admin_client.post(
        "/api/v1/auth/token",
        json={
            "grant_type": "password",
            "username": "demo.viewer@test.local",
            "password": approval["temporary_password"],
        },
    )
    assert login.status_code == 200
    token = login.json()["access_token"]
    assert set(login.json()["scopes"]) == {
        "knowledge:read",
        "knowledge:search",
        "education:read",
    }

    denied = await admin_client.post(
        "/api/v1/curator/workflows",
        headers={"Authorization": f"Bearer {token}"},
        json={"entity_id": "00000000-0000-4000-8000-000000000001"},
    )
    assert denied.status_code == 403


@pytest.mark.asyncio
async def test_non_admin_cannot_review_demo_requests(curator_client: AsyncClient):
    assert (await curator_client.get("/api/v1/demo-requests")).status_code == 403
