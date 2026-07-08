"""Dashboard API tests — Phase 4.2.1."""

from __future__ import annotations

import os

import pytest
import pytest_asyncio
from httpx import ASGITransport, AsyncClient

from farmacograph.core.container import reset_container
from farmacograph.curator.structural_stub import (
    CV_STUB_DRUG_ID,
)
from tests.auth.helpers import bearer_headers, curator_token, seed_curator_user

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
async def test_dashboard_endpoint(client: AsyncClient):
    r = await client.get("/api/v1/dashboard")
    assert r.status_code == 200
    body = r.json()
    assert "health" in body["data"]
    assert "statistics" in body["data"]
    assert "curator" in body["data"]
    assert "activity" in body["data"]
    assert "jobs" in body["data"]
    assert "validation" in body["data"]
    assert "snapshot" in body["data"]


@pytest.mark.asyncio
async def test_audit_logs_endpoint(client: AsyncClient):
    wf = await client.post(
        "/api/v1/curator/workflows",
        json={"entity_id": CV_STUB_DRUG_ID, "entity_type": "Drug", "notes": "audit test"},
    )
    workflow_id = wf.json()["data"]["id"]
    await client.post(f"/api/v1/curator/workflows/{workflow_id}/submit")

    r = await client.get("/api/v1/audit-logs")
    assert r.status_code == 200
    assert len(r.json()["data"]) >= 1


@pytest.mark.asyncio
async def test_jobs_endpoint(client: AsyncClient):
    r = await client.get("/api/v1/jobs")
    assert r.status_code == 200
    assert "data" in r.json()


@pytest.mark.asyncio
async def test_validation_summary(client: AsyncClient):
    r = await client.get("/api/v1/curator/validation-summary")
    assert r.status_code == 200
    assert "failed_count" in r.json()["data"]


@pytest.mark.asyncio
async def test_curator_queue_limit_and_timestamps(client: AsyncClient):
    await client.post(
        "/api/v1/curator/workflows",
        json={"entity_id": CV_STUB_DRUG_ID, "entity_type": "Drug"},
    )
    r = await client.get("/api/v1/curator/queue?state=draft&limit=5")
    assert r.status_code == 200
    item = r.json()["data"][0]
    assert "created_at" in item
    assert "updated_at" in item
