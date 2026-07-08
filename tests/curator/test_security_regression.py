"""Curator workflow security regression — anonymous callers cannot advance state."""

from __future__ import annotations

import os

import pytest
import pytest_asyncio
from httpx import ASGITransport, AsyncClient

os.environ.setdefault("FG_ENVIRONMENT", "test")
os.environ.setdefault("FG_DATABASE_URL", "sqlite+aiosqlite:///:memory:")
os.environ.setdefault("FG_NEO4J_ENABLED", "false")
os.environ.setdefault("FG_JWT_SECRET_KEY", "test-secret-key-32-characters-min")

from farmacograph.core.container import get_container, reset_container
from farmacograph.curator.structural_stub import CV_STUB_DRUG_ID
from tests.auth.helpers import curator_publish_payload


@pytest.fixture(autouse=True)
def _reset() -> None:
    reset_container()
    yield
    reset_container()


@pytest_asyncio.fixture
async def anonymous_client() -> AsyncClient:
    from farmacograph.api.main import create_app

    app = create_app()
    container = get_container()
    await container.startup()
    transport = ASGITransport(app=app)
    async with AsyncClient(transport=transport, base_url="http://test") as client:
        yield client
    await container.shutdown()


@pytest.mark.asyncio
async def test_anonymous_cannot_create_workflow(anonymous_client: AsyncClient) -> None:
    response = await anonymous_client.post(
        "/api/v1/curator/workflows",
        json={
            "entity_id": CV_STUB_DRUG_ID,
            "entity_type": "Drug",
            "notes": "anonymous regression probe",
        },
    )
    assert response.status_code == 401
    assert response.json()["detail"] == "Authentication required"


@pytest.mark.asyncio
async def test_anonymous_cannot_submit_approve_or_publish_without_workflow(
    anonymous_client: AsyncClient,
) -> None:
    workflow_id = "00000000-0000-4000-8000-000000000099"
    package = curator_publish_payload()

    submit = await anonymous_client.post(f"/api/v1/curator/workflows/{workflow_id}/submit")
    approve = await anonymous_client.post(f"/api/v1/curator/workflows/{workflow_id}/approve")
    publish = await anonymous_client.post(
        f"/api/v1/curator/workflows/{workflow_id}/publish",
        json=package,
    )

    for response in (submit, approve, publish):
        assert response.status_code == 401
        assert response.json()["detail"] == "Authentication required"
