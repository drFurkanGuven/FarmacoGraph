"""Workflow activity timeline API tests."""

from __future__ import annotations

import os

import pytest
import pytest_asyncio
from httpx import ASGITransport, AsyncClient

os.environ.setdefault("FG_ENVIRONMENT", "test")
os.environ.setdefault("FG_DATABASE_URL", "sqlite+aiosqlite:///:memory:")
os.environ.setdefault("FG_NEO4J_ENABLED", "false")

from farmacograph.core.container import reset_container
from farmacograph.curator.structural_stub import (
    CV_STUB_DRUG_ID,
    build_cardiovascular_publish_package,
)
from tests.auth.helpers import bearer_headers, curator_token, seed_curator_user


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
async def test_workflow_timeline_returns_audit_events(client: AsyncClient):
    package = build_cardiovascular_publish_package()
    created = await client.post(
        "/api/v1/curator/workflows",
        json={"entity_id": CV_STUB_DRUG_ID, "entity_type": "Drug", "notes": "timeline test"},
    )
    workflow_id = created.json()["data"]["id"]

    await client.put(
        f"/api/v1/curator/workflows/{workflow_id}/package",
        json=package,
    )
    await client.post(f"/api/v1/curator/workflows/{workflow_id}/submit")

    response = await client.get(f"/api/v1/curator/workflows/{workflow_id}/timeline")
    assert response.status_code == 200
    body = response.json()
    kinds = {item["kind"] for item in body["data"]}
    assert "workflow_created" in kinds
    assert "autosaved" in kinds
    assert "validation_run" in kinds
    assert "submitted" in kinds
    assert body["meta"]["workflow_id"] == workflow_id


@pytest.mark.asyncio
async def test_workflow_timeline_logs_publish_failure(client: AsyncClient):
    created = await client.post(
        "/api/v1/curator/workflows",
        json={"entity_id": CV_STUB_DRUG_ID, "entity_type": "Drug"},
    )
    workflow_id = created.json()["data"]["id"]

    failed = await client.post(
        f"/api/v1/curator/workflows/{workflow_id}/publish",
        json={"entity_payload": {"slug": "invalid"}},
    )
    assert failed.status_code == 400

    response = await client.get(f"/api/v1/curator/workflows/{workflow_id}/timeline")
    kinds = {item["kind"] for item in response.json()["data"]}
    assert "publish_failed" in kinds
