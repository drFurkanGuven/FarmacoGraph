"""Rate-limit tier regression tests — quota follows verified identity.

Root causes covered:
1. Quota escalation: the middleware used to grant the enterprise tier (5000/min)
   to any request carrying an ``fg_ent_``-prefixed header WITHOUT validating the
   key. A forged header bypassed the anonymous quota entirely.
2. Test pollution: the process-global sliding-window limiter is shared by every
   test (anonymous tests collide on one IP bucket). ``tests/conftest.py`` clears
   it per test; these tests additionally isolate themselves with distinct
   X-Forwarded-For identities so they pass in any order, with or without the
   fixture.

Quota is not authorization: these tests assert rate-limit buckets/headers only.
Endpoint scopes are enforced independently in deps.
"""

from __future__ import annotations

import os
import uuid

import pytest
import pytest_asyncio
from httpx import ASGITransport, AsyncClient

os.environ.setdefault("FG_ENVIRONMENT", "test")
os.environ.setdefault("FG_DATABASE_URL", "sqlite+aiosqlite:///:memory:")
os.environ.setdefault("FG_NEO4J_ENABLED", "false")

from farmacograph.api.middleware import (
    TIER_ANONYMOUS,
    TIER_DEVELOPER,
    TIER_ENTERPRISE,
    TIER_STUDENT,
    resolve_client_quota,
)
from farmacograph.auth.models import AuthContext, create_access_token
from farmacograph.core.config import get_settings


def _verified_key_context() -> AuthContext:
    return AuthContext(
        user_id=uuid.uuid4(),
        scopes=frozenset({"knowledge:read"}),
        is_authenticated=True,
        auth_method="api_key",
    )


def test_resolve_anonymous_without_credentials():
    bucket, limit = resolve_client_quota(AuthContext(), client_host="10.0.0.1")
    assert (bucket, limit) == ("ip:10.0.0.1", TIER_ANONYMOUS)


def test_resolve_forged_enterprise_key_is_anonymous():
    # Forged header, no verified context -> anonymous bucket, NOT enterprise.
    bucket, limit = resolve_client_quota(
        AuthContext(),
        api_key_header="fg_ent_forged_key_12345",
        client_host="10.0.0.2",
    )
    assert (bucket, limit) == ("ip:10.0.0.2", TIER_ANONYMOUS)


def test_resolve_verified_developer_key():
    bucket, limit = resolve_client_quota(
        _verified_key_context(),
        api_key_header="fg_live_abcdef12_rest_of_key",
        client_host="10.0.0.3",
    )
    assert bucket == "apikey:fg_live_abcdef12"
    assert limit == TIER_DEVELOPER


def test_resolve_verified_enterprise_key_keeps_tier():
    bucket, limit = resolve_client_quota(
        _verified_key_context(),
        api_key_header="fg_ent_real_key_0001",
        client_host="10.0.0.4",
    )
    assert bucket == "apikey:fg_ent_real_key_"
    assert limit == TIER_ENTERPRISE


def test_resolve_verified_jwt_gets_student_tier():
    context = AuthContext(
        user_id=uuid.uuid4(),
        scopes=frozenset({"knowledge:read"}),
        is_authenticated=True,
        auth_method="jwt",
    )
    bucket, limit = resolve_client_quota(
        context, auth_header="Bearer header.payload.sig", client_host="10.0.0.5"
    )
    assert bucket.startswith("jwt:")
    assert limit == TIER_STUDENT


@pytest_asyncio.fixture
async def started_client():
    from farmacograph.api.main import create_app
    from farmacograph.core.container import get_container, reset_container

    reset_container()
    fresh_app = create_app()
    container = get_container()
    await container.startup()
    transport = ASGITransport(app=fresh_app)
    async with AsyncClient(transport=transport, base_url="http://test") as ac:
        yield ac
    await container.shutdown()
    reset_container()


async def _flood(client: AsyncClient, count: int, headers: dict, ip: str) -> list[int]:
    codes: list[int] = []
    for _ in range(count):
        response = await client.get(
            "/api/v1/drugs", headers={**headers, "X-Forwarded-For": ip}
        )
        codes.append(response.status_code)
    return codes


@pytest.mark.asyncio
async def test_anonymous_quota_still_enforced(started_client: AsyncClient):
    """Production limiting must keep working: 61st anonymous hit is rejected."""
    codes = await _flood(started_client, TIER_ANONYMOUS + 1, {}, "198.51.100.10")
    assert codes.count(200) == TIER_ANONYMOUS
    assert codes[-1] == 429


@pytest.mark.asyncio
async def test_forged_enterprise_key_capped_at_anonymous(started_client: AsyncClient):
    """Escalation closed: forged fg_ent_ header gets the anonymous bucket."""
    codes = await _flood(
        started_client,
        TIER_ANONYMOUS + 1,
        {"X-API-Key": "fg_ent_forged_key_12345"},
        "198.51.100.11",
    )
    assert codes.count(200) == TIER_ANONYMOUS
    assert codes[-1] == 429


@pytest.mark.asyncio
async def test_valid_api_key_keeps_developer_quota(started_client: AsyncClient):
    issued = await started_client.post(
        "/api/v1/developer/instant-key",
        json={"name": "Quota Probe", "email": "quota@example.org", "intended_use": "research"},
    )
    assert issued.status_code == 201
    api_key = issued.json()["data"]["api_key"]

    first = await started_client.get(
        "/api/v1/drugs",
        headers={"X-API-Key": api_key, "X-Forwarded-For": "198.51.100.12"},
    )
    assert first.status_code == 200
    assert first.headers["X-RateLimit-Limit"] == str(TIER_DEVELOPER)

    codes = await _flood(
        started_client,
        TIER_ANONYMOUS + 1,
        {"X-API-Key": api_key},
        "198.51.100.12",
    )
    # 61 hits stay far below the 1000/min developer tier: no rejection.
    assert codes.count(200) == TIER_ANONYMOUS + 1


@pytest.mark.asyncio
async def test_jwt_keeps_student_quota(started_client: AsyncClient):
    settings = get_settings()
    token = create_access_token(
        subject=str(uuid.uuid4()), settings=settings, scopes=["knowledge:read"]
    )
    first = await started_client.get(
        "/api/v1/drugs",
        headers={
            "Authorization": f"Bearer {token}",
            "X-Forwarded-For": "198.51.100.13",
        },
    )
    assert first.status_code == 200
    assert first.headers["X-RateLimit-Limit"] == str(TIER_STUDENT)

    codes = await _flood(
        started_client,
        TIER_ANONYMOUS + 1,
        {"Authorization": f"Bearer {token}"},
        "198.51.100.13",
    )
    assert codes.count(200) == TIER_ANONYMOUS + 1
