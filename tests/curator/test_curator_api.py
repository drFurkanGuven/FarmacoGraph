"""Curator workflow integration tests — no real pharmacology data."""

from __future__ import annotations

import os
import uuid

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
async def test_curator_full_workflow(client: AsyncClient):
    """draft → review → approved → published with structural stub package."""
    package = build_cardiovascular_publish_package()
    r = await client.post(
        "/api/v1/curator/workflows",
        json={
            "entity_id": CV_STUB_DRUG_ID,
            "entity_type": "Drug",
            "notes": "Structural test stub — not real pharmacology",
        },
    )
    assert r.status_code == 201
    workflow_id = r.json()["data"]["id"]

    await client.post(f"/api/v1/curator/workflows/{workflow_id}/submit")
    await client.post(f"/api/v1/curator/workflows/{workflow_id}/approve")

    r = await client.post(
        f"/api/v1/curator/workflows/{workflow_id}/publish",
        json=package,
    )
    assert r.status_code == 200
    body = r.json()["data"]
    assert body["workflow"]["state"] == "published"
    assert body["graph_write"]["status"] in ("success", "skipped")
    assert "validation_summary" in body


@pytest.mark.asyncio
async def test_cannot_publish_invalid_payload(client: AsyncClient):
    r = await client.post(
        "/api/v1/curator/workflows",
        json={"entity_id": str(uuid.uuid4()), "entity_type": "Drug"},
    )
    workflow_id = r.json()["data"]["id"]
    await client.post(f"/api/v1/curator/workflows/{workflow_id}/submit")
    await client.post(f"/api/v1/curator/workflows/{workflow_id}/approve")

    r = await client.post(
        f"/api/v1/curator/workflows/{workflow_id}/publish",
        json={"entity_payload": {"id": "x", "entity_type": "Drug", "status": "published"}},
    )
    assert r.status_code == 400


@pytest.mark.asyncio
async def test_return_approved_workflow_to_draft_allows_package_edits(client: AsyncClient):
    package = build_cardiovascular_publish_package()
    r = await client.post(
        "/api/v1/curator/workflows",
        json={"entity_id": CV_STUB_DRUG_ID, "entity_type": "Drug"},
    )
    workflow_id = r.json()["data"]["id"]
    await client.post(f"/api/v1/curator/workflows/{workflow_id}/submit")
    await client.post(f"/api/v1/curator/workflows/{workflow_id}/approve")

    returned = await client.post(f"/api/v1/curator/workflows/{workflow_id}/return-to-draft")
    assert returned.status_code == 200
    assert returned.json()["data"]["state"] == "draft"

    saved = await client.put(
        f"/api/v1/curator/workflows/{workflow_id}/package",
        json=package,
    )
    assert saved.status_code == 200
    assert saved.json()["data"]["workflow"]["state"] == "draft"


@pytest.mark.asyncio
async def test_cardiovascular_stub_endpoint(client: AsyncClient):
    r = await client.get("/api/v1/curator/stubs/cardiovascular")
    assert r.status_code == 200
    assert r.json()["data"]["module"] == "cardiovascular"


@pytest.mark.asyncio
async def test_review_queue(client: AsyncClient):
    entity_id = str(uuid.uuid4())
    r = await client.post(
        "/api/v1/curator/workflows",
        json={"entity_id": entity_id, "entity_type": "Drug"},
    )
    workflow_id = r.json()["data"]["id"]
    await client.post(f"/api/v1/curator/workflows/{workflow_id}/submit")

    r = await client.get("/api/v1/curator/queue?state=review")
    assert r.status_code == 200
    assert r.json()["meta"]["count"] >= 1


@pytest.mark.asyncio
async def test_open_drug_workflow_for_slug(client: AsyncClient):
    """POST /curator/drugs/{slug}/workflows get-or-creates draft workflow + package."""
    r = await client.post("/api/v1/curator/drugs/ramipril/workflows")
    assert r.status_code == 201
    body = r.json()
    assert body["data"]["workflow"]["state"] == "draft"
    assert body["data"]["package"]["entity_payload"]["slug"] == "ramipril"
    assert "validation" in body["data"]
    workflow_id = body["data"]["workflow"]["id"]

    r2 = await client.post("/api/v1/curator/drugs/ramipril/workflows")
    assert r2.status_code == 201
    assert r2.json()["data"]["workflow"]["id"] == workflow_id


@pytest.mark.asyncio
async def test_get_drug_workflow_state_without_workflow(client: AsyncClient):
    """GET /curator/drugs/{slug}/workflow-state returns package + validation even without workflow."""
    r = await client.get("/api/v1/curator/drugs/ramipril/workflow-state")
    assert r.status_code == 200
    body = r.json()
    data = body["data"]
    assert body["meta"]["slug"] == "ramipril"
    assert data["slug"] == "ramipril"
    assert data["workflow_id"] is None
    assert data["status"] is None
    assert data["package"]["entity_payload"]["slug"] == "ramipril"
    assert "valid" in data["last_validation"]
    assert "publish_ready" in data["last_validation"]
    assert data["allowed_transitions"] == []


@pytest.mark.asyncio
async def test_get_drug_workflow_state_with_draft(client: AsyncClient):
    """GET /curator/drugs/{slug}/workflow-state aggregates workflow, autosave, and validation."""
    package = {
        "entity_payload": {
            "slug": "ramipril",
            "entity_type": "Drug",
            "label": "Workflow State Test",
        },
        "related_entities": [],
        "relationships": [],
        "dataset_version": "2026.1.0",
        "module": "cardiovascular",
    }
    r = await client.post("/api/v1/curator/drugs/ramipril/workflows")
    workflow_id = r.json()["data"]["workflow"]["id"]

    r = await client.put(f"/api/v1/curator/workflows/{workflow_id}/package", json=package)
    assert r.status_code == 200

    r = await client.get("/api/v1/curator/drugs/ramipril/workflow-state")
    assert r.status_code == 200
    data = r.json()["data"]
    assert data["workflow_id"] == workflow_id
    assert data["status"] == "draft"
    assert data["last_autosave"]["at"] is not None
    assert data["last_validation"]["at"] is not None
    assert data["publish_ready"] is False
    assert data["allowed_transitions"] == ["review"]
    assert data["curator"]["actor_id"] is not None
    assert data["approval"]["status"] == "draft"
    assert data["package"]["entity_payload"]["label"] == "Workflow State Test"


@pytest.mark.asyncio
async def test_get_drug_package(client: AsyncClient):
    r = await client.get("/api/v1/curator/drugs/ramipril/package")
    assert r.status_code == 200
    data = r.json()["data"]
    assert data["entity_payload"]["slug"] == "ramipril"
    assert "workflow_id" in r.json()["meta"]


@pytest.mark.asyncio
async def test_save_workflow_package_draft_autosave(client: AsyncClient):
    """PUT /curator/workflows/{id}/package persists draft_package_json."""
    from farmacograph.curator.drug_package import build_drug_entry_package

    package = build_drug_entry_package("ramipril")
    package["entity_payload"]["label"] = "Ramipril Autosave Test"

    r = await client.post("/api/v1/curator/drugs/ramipril/workflows")
    workflow_id = r.json()["data"]["workflow"]["id"]

    r = await client.put(
        f"/api/v1/curator/workflows/{workflow_id}/package",
        json=package,
    )
    assert r.status_code == 200
    body = r.json()
    assert body["data"]["workflow"]["id"] == workflow_id
    assert "validation" in body["data"]

    r = await client.get(f"/api/v1/curator/workflows/{workflow_id}")
    assert r.status_code == 200
    assert (
        r.json()["data"]["draft_package_json"]["entity_payload"]["label"]
        == "Ramipril Autosave Test"
    )

    r = await client.get("/api/v1/curator/drugs/ramipril/package")
    assert r.status_code == 200
    assert r.json()["data"]["entity_payload"]["label"] == "Ramipril Autosave Test"


@pytest.mark.asyncio
async def test_cannot_save_package_in_published_state(client: AsyncClient):
    package = build_cardiovascular_publish_package()
    r = await client.post(
        "/api/v1/curator/workflows",
        json={
            "entity_id": CV_STUB_DRUG_ID,
            "entity_type": "Drug",
            "notes": "Structural test stub — not real pharmacology",
        },
    )
    workflow_id = r.json()["data"]["id"]
    await client.post(f"/api/v1/curator/workflows/{workflow_id}/submit")
    await client.post(f"/api/v1/curator/workflows/{workflow_id}/approve")
    await client.post(f"/api/v1/curator/workflows/{workflow_id}/publish", json=package)

    r = await client.put(
        f"/api/v1/curator/workflows/{workflow_id}/package",
        json=package,
    )
    assert r.status_code == 400
