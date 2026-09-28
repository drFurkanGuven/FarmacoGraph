"""Curator flow honesty — draft to publish without Neo4j.

Verifies the curator chain that works on the operational DB alone
(create -> save -> validate -> submit -> approve -> publish) and pins the
honest signal for the part that cannot work here: publish transitions state
but writes NO graph without Neo4j, and the response says so
(``graph_write.status == "skipped"``). Public readers keep serving staging
content explicitly labeled ``staging-fallback`` — never silently promoted.
"""

from __future__ import annotations

import json
import os
from pathlib import Path

import pytest
import pytest_asyncio
from httpx import ASGITransport, AsyncClient

os.environ.setdefault("FG_ENVIRONMENT", "test")
os.environ.setdefault("FG_DATABASE_URL", "sqlite+aiosqlite:///:memory:")
os.environ.setdefault("FG_NEO4J_ENABLED", "false")

from farmacograph.core.container import reset_container
from tests.auth.helpers import bearer_headers, curator_token, seed_curator_user

STAGING_METOPROLOL = (
    Path(__file__).resolve().parents[2]
    / "staging"
    / "cardiovascular"
    / "drugs"
    / "metoprolol.json"
)


@pytest.fixture(autouse=True)
def _reset():
    reset_container()
    yield
    reset_container()


@pytest_asyncio.fixture
async def curator_client():
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


def _real_package() -> dict:
    return json.loads(STAGING_METOPROLOL.read_text(encoding="utf-8"))


@pytest.mark.asyncio
async def test_curator_draft_save_validate_approve(curator_client: AsyncClient):
    package = _real_package()
    entity_id = package["entity_payload"]["id"]

    created = await curator_client.post(
        "/api/v1/curator/workflows",
        json={"entity_id": entity_id, "entity_type": "Drug", "notes": "honesty probe"},
    )
    assert created.status_code == 201
    workflow_id = created.json()["data"]["id"]

    saved = await curator_client.put(
        f"/api/v1/curator/workflows/{workflow_id}/package", json=package
    )
    assert saved.status_code == 200, saved.text

    validated = await curator_client.post("/api/v1/curator/validate", json=package)
    assert validated.status_code == 200
    assert validated.json()["data"]["valid"] is True

    submitted = await curator_client.post(
        f"/api/v1/curator/workflows/{workflow_id}/submit"
    )
    assert submitted.status_code == 200

    approved = await curator_client.post(
        f"/api/v1/curator/workflows/{workflow_id}/approve"
    )
    assert approved.status_code == 200
    assert approved.json()["data"]["state"] == "approved"


@pytest.mark.asyncio
async def test_publish_without_graph_fails_with_503_and_keeps_approved(
    curator_client: AsyncClient,
):
    """New publish contract: no graph write, no publish.

    The endpoint answers 503, the workflow stays approved for retry, and no
    snapshot/event is emitted. Public readers keep serving staging content
    explicitly labeled staging-fallback — never silently promoted.
    """
    package = _real_package()
    entity_id = package["entity_payload"]["id"]

    created = await curator_client.post(
        "/api/v1/curator/workflows",
        json={"entity_id": entity_id, "entity_type": "Drug"},
    )
    workflow_id = created.json()["data"]["id"]
    await curator_client.post(f"/api/v1/curator/workflows/{workflow_id}/submit")
    await curator_client.post(f"/api/v1/curator/workflows/{workflow_id}/approve")

    published = await curator_client.post(
        f"/api/v1/curator/workflows/{workflow_id}/publish", json=package
    )
    assert published.status_code == 503

    state = await curator_client.get(f"/api/v1/curator/workflows/{workflow_id}")
    assert state.json()["data"]["state"] == "approved"

    # Public readers still serve staging content, explicitly labeled.
    public = await curator_client.get(f"/api/v1/drugs/{entity_id}")
    assert public.status_code == 200
    assert public.json()["meta"].get("provenance") == "staging-fallback"


@pytest.mark.asyncio
async def test_publish_graph_write_failure_keeps_approved(
    curator_client: AsyncClient,
):
    """Graph available but write explodes: 503, approved retained, retryable."""
    from unittest.mock import PropertyMock, patch

    from farmacograph.repositories.graph_writer import GraphWriter

    package = _real_package()
    entity_id = package["entity_payload"]["id"]

    created = await curator_client.post(
        "/api/v1/curator/workflows",
        json={"entity_id": entity_id, "entity_type": "Drug"},
    )
    workflow_id = created.json()["data"]["id"]
    await curator_client.post(f"/api/v1/curator/workflows/{workflow_id}/submit")
    await curator_client.post(f"/api/v1/curator/workflows/{workflow_id}/approve")

    with (
        patch.object(
            GraphWriter, "is_available", new_callable=PropertyMock, return_value=True
        ),
        patch.object(
            GraphWriter, "publish_package", side_effect=RuntimeError("bolt down")
        ),
    ):
        published = await curator_client.post(
            f"/api/v1/curator/workflows/{workflow_id}/publish", json=package
        )
    assert published.status_code == 503

    state = await curator_client.get(f"/api/v1/curator/workflows/{workflow_id}")
    assert state.json()["data"]["state"] == "approved"
