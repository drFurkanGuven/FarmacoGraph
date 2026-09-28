"""Tests for Developer & B2B Partner onboarding router."""

from __future__ import annotations

import os

import pytest
import pytest_asyncio
from fastapi.testclient import TestClient
from httpx import ASGITransport, AsyncClient

os.environ.setdefault("FG_ENVIRONMENT", "test")
os.environ.setdefault("FG_DATABASE_URL", "sqlite+aiosqlite:///:memory:")
os.environ.setdefault("FG_NEO4J_ENABLED", "false")

from farmacograph.api.main import app, create_app
from farmacograph.core.container import get_container, reset_container

client = TestClient(app)


@pytest_asyncio.fixture
async def started_client():
    reset_container()
    fresh_app = create_app()
    container = get_container()
    await container.startup()
    transport = ASGITransport(app=fresh_app)
    async with AsyncClient(transport=transport, base_url="http://test") as ac:
        yield ac
    await container.shutdown()
    reset_container()


def test_get_api_tiers():
    response = client.get("/api/v1/developer/tiers")
    assert response.status_code == 200
    data = response.json()
    assert "tiers" in data
    tier_names = [t["tier"] for t in data["tiers"]]
    assert "public_explorer" in tier_names
    assert "student_learner" in tier_names
    assert "developer_researcher" in tier_names
    assert "enterprise_clinical" in tier_names


def test_enterprise_inquiry():
    payload = {
        "company_name": "NextGen Hospital Software",
        "contact_name": "Jane Doe, MD",
        "work_email": "jane@nextgen-ehr.com",
        "use_case": "Integrating FarmacoGraph explainable DDI engine into inpatient prescription workflow",
        "estimated_monthly_volume": "500k-5M",
        "needs_on_premise": True,
    }
    response = client.post("/api/v1/developer/enterprise-inquiry", json=payload)
    assert response.status_code == 202
    res = response.json()
    assert res["data"]["status"] == "received"
    assert "inquiry_id" in res["data"]


@pytest.mark.asyncio
async def test_instant_developer_key_shape(started_client: AsyncClient):
    payload = {
        "name": "Dr. Test App",
        "email": "dev@healthtech.example.org",
        "organization": "Stanford Medical Lab",
        "intended_use": "research",
    }
    response = await started_client.post("/api/v1/developer/instant-key", json=payload)
    assert response.status_code == 201
    res = response.json()
    assert "api_key" in res["data"]
    assert res["data"]["api_key"].startswith("fg_")
    assert res["data"]["tier"] == "developer_researcher"
    assert "expires_at" in res["data"]
    assert "key_id" in res["data"]


@pytest.mark.asyncio
async def test_instant_developer_key_authenticates(started_client: AsyncClient):
    """An issued instant key must validate on introspect (DB persistence + hash check)."""
    payload = {
        "name": "Validity Probe",
        "email": "probe@example.org",
        "intended_use": "education",
    }
    issued = await started_client.post("/api/v1/developer/instant-key", json=payload)
    assert issued.status_code == 201
    api_key = issued.json()["data"]["api_key"]

    introspect = await started_client.post(
        "/api/v1/auth/introspect", headers={"X-API-Key": api_key}
    )
    assert introspect.status_code == 200, introspect.text
    body = introspect.json()
    assert body["active"] is True
    assert body["token_type"] == "api_key"
    assert "knowledge:read" in body["scopes"]


@pytest.mark.asyncio
async def test_unknown_api_key_rejected(started_client: AsyncClient):
    probe = await started_client.post(
        "/api/v1/auth/introspect", headers={"X-API-Key": "fg_live_deadbeef_deadbeef"}
    )
    assert probe.status_code == 401
