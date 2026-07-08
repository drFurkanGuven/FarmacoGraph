"""Curator publish workflow transition tests — submit, approve, publish."""

from __future__ import annotations

import os
import uuid

import pytest
import pytest_asyncio
from httpx import ASGITransport, AsyncClient

os.environ.setdefault("FG_ENVIRONMENT", "test")
os.environ.setdefault("FG_DATABASE_URL", "sqlite+aiosqlite:///:memory:")
os.environ.setdefault("FG_NEO4J_ENABLED", "false")

from farmacograph.auth.models import create_access_token
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


@pytest_asyncio.fixture
async def write_only_client():
    from farmacograph.api.main import create_app
    from farmacograph.core.config import get_settings
    from farmacograph.core.container import get_container

    app = create_app()
    container = get_container()
    await container.startup()
    user, _ = await seed_curator_user(container.session_factory)
    settings = get_settings()
    token = create_access_token(str(user.id), settings, scopes=["curator:write", "knowledge:read"])
    auth = bearer_headers(token)
    transport = ASGITransport(app=app)
    async with AsyncClient(transport=transport, base_url="http://test", headers=auth) as ac:
        yield ac
    await container.shutdown()


async def _create_workflow(client: AsyncClient, *, entity_id: str | None = None) -> str:
    response = await client.post(
        "/api/v1/curator/workflows",
        json={
            "entity_id": entity_id or CV_STUB_DRUG_ID,
            "entity_type": "Drug",
            "notes": "publish workflow test stub",
        },
    )
    assert response.status_code == 201
    return response.json()["data"]["id"]


async def _advance_to_review(client: AsyncClient, workflow_id: str) -> None:
    response = await client.post(f"/api/v1/curator/workflows/{workflow_id}/submit")
    assert response.status_code == 200
    assert response.json()["data"]["state"] == "review"


async def _advance_to_approved(client: AsyncClient, workflow_id: str) -> None:
    await _advance_to_review(client, workflow_id)
    response = await client.post(f"/api/v1/curator/workflows/{workflow_id}/approve")
    assert response.status_code == 200
    assert response.json()["data"]["state"] == "approved"


@pytest.mark.asyncio
async def test_submit_transitions_draft_to_review(client: AsyncClient):
    workflow_id = await _create_workflow(client)

    response = await client.post(f"/api/v1/curator/workflows/{workflow_id}/submit")

    assert response.status_code == 200
    body = response.json()
    assert body["data"]["state"] == "review"
    assert body["meta"]["api_version"] == "v1"


@pytest.mark.asyncio
async def test_approve_transitions_review_to_approved(client: AsyncClient):
    workflow_id = await _create_workflow(client)
    await _advance_to_review(client, workflow_id)

    response = await client.post(f"/api/v1/curator/workflows/{workflow_id}/approve")

    assert response.status_code == 200
    assert response.json()["data"]["state"] == "approved"


@pytest.mark.asyncio
async def test_publish_transitions_approved_to_published(client: AsyncClient):
    package = build_cardiovascular_publish_package()
    workflow_id = await _create_workflow(client)
    await _advance_to_approved(client, workflow_id)

    response = await client.post(
        f"/api/v1/curator/workflows/{workflow_id}/publish",
        json=package,
    )

    assert response.status_code == 200
    body = response.json()["data"]
    assert body["workflow"]["state"] == "published"
    assert body["published_slug"] == package["entity_payload"]["slug"]
    assert body["graph_write"]["status"] in {"success", "skipped"}
    assert body["validation_summary"]["valid"] is True


@pytest.mark.asyncio
async def test_cannot_publish_from_draft(client: AsyncClient):
    workflow_id = await _create_workflow(client)
    package = build_cardiovascular_publish_package()

    response = await client.post(
        f"/api/v1/curator/workflows/{workflow_id}/publish",
        json=package,
    )

    assert response.status_code == 400
    assert "cannot publish" in response.json()["detail"].lower()


@pytest.mark.asyncio
async def test_cannot_publish_from_review(client: AsyncClient):
    workflow_id = await _create_workflow(client)
    await _advance_to_review(client, workflow_id)
    package = build_cardiovascular_publish_package()

    response = await client.post(
        f"/api/v1/curator/workflows/{workflow_id}/publish",
        json=package,
    )

    assert response.status_code == 400
    assert "cannot publish" in response.json()["detail"].lower()


@pytest.mark.asyncio
async def test_cannot_approve_from_draft(client: AsyncClient):
    workflow_id = await _create_workflow(client)

    response = await client.post(f"/api/v1/curator/workflows/{workflow_id}/approve")

    assert response.status_code == 400
    assert "transition" in response.json()["detail"].lower()


@pytest.mark.asyncio
async def test_cannot_submit_from_review(client: AsyncClient):
    workflow_id = await _create_workflow(client)
    await _advance_to_review(client, workflow_id)

    response = await client.post(f"/api/v1/curator/workflows/{workflow_id}/submit")

    assert response.status_code == 400
    assert "transition" in response.json()["detail"].lower()


@pytest.mark.asyncio
async def test_publish_invalid_payload_returns_400(client: AsyncClient):
    workflow_id = await _create_workflow(client)
    await _advance_to_approved(client, workflow_id)

    response = await client.post(
        f"/api/v1/curator/workflows/{workflow_id}/publish",
        json={"entity_payload": {"id": "x", "entity_type": "Drug", "status": "published"}},
    )

    assert response.status_code == 400
    assert response.json()["detail"]


@pytest.mark.asyncio
async def test_publish_unknown_workflow_returns_400(client: AsyncClient):
    workflow_id = str(uuid.uuid4())
    package = build_cardiovascular_publish_package()

    response = await client.post(
        f"/api/v1/curator/workflows/{workflow_id}/publish",
        json=package,
    )

    assert response.status_code == 400
    assert "not found" in response.json()["detail"].lower()


@pytest.mark.asyncio
async def test_write_scope_can_submit_but_not_approve_or_publish(
    write_only_client: AsyncClient,
):
    workflow_id = await _create_workflow(write_only_client)
    package = build_cardiovascular_publish_package()

    submit = await write_only_client.post(f"/api/v1/curator/workflows/{workflow_id}/submit")
    assert submit.status_code == 200

    approve = await write_only_client.post(f"/api/v1/curator/workflows/{workflow_id}/approve")
    assert approve.status_code == 403
    assert "curator:publish" in approve.json()["detail"]

    publish = await write_only_client.post(
        f"/api/v1/curator/workflows/{workflow_id}/publish",
        json=package,
    )
    assert publish.status_code == 403
    assert "curator:publish" in publish.json()["detail"]
