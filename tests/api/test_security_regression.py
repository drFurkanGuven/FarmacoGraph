"""API security regression — anonymous users cannot mutate curator state."""

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
from tests.auth.helpers import (
    SECURITY_WORKFLOW_ID,
    TEST_DRUG_SLUG,
    curator_create_workflow_payload,
    curator_publish_payload,
)

_CURATOR_WRITE_ENDPOINTS: list[tuple[str, str, dict | None]] = [
    ("GET", "/api/v1/curator/drugs", None),
    ("POST", f"/api/v1/curator/drugs/{TEST_DRUG_SLUG}/workflows", None),
    ("GET", f"/api/v1/curator/drugs/{TEST_DRUG_SLUG}/package", None),
    (
        "PUT",
        f"/api/v1/curator/workflows/{SECURITY_WORKFLOW_ID}/package",
        curator_publish_payload(),
    ),
    ("POST", "/api/v1/curator/validate", curator_publish_payload()),
    ("GET", "/api/v1/curator/stubs/cardiovascular", None),
    ("POST", "/api/v1/curator/workflows", curator_create_workflow_payload()),
    ("GET", f"/api/v1/curator/workflows/{SECURITY_WORKFLOW_ID}", None),
    ("GET", "/api/v1/curator/queue", None),
    ("GET", "/api/v1/curator/validation-summary", None),
]

_CURATOR_PUBLISH_ENDPOINTS: list[tuple[str, str, dict | None]] = [
    ("POST", f"/api/v1/curator/workflows/{SECURITY_WORKFLOW_ID}/approve", None),
    (
        "POST",
        f"/api/v1/curator/workflows/{SECURITY_WORKFLOW_ID}/publish",
        curator_publish_payload(),
    ),
]

_WORKFLOW_MUTATION_ENDPOINTS: list[tuple[str, str, dict | None]] = [
    ("POST", f"/api/v1/curator/workflows/{SECURITY_WORKFLOW_ID}/submit", None),
    ("POST", f"/api/v1/curator/workflows/{SECURITY_WORKFLOW_ID}/approve", None),
    (
        "POST",
        f"/api/v1/curator/workflows/{SECURITY_WORKFLOW_ID}/publish",
        curator_publish_payload(),
    ),
]


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


@pytest.mark.parametrize("method,path,json_body", _CURATOR_WRITE_ENDPOINTS)
@pytest.mark.asyncio
async def test_anonymous_curator_write_denied(
    anonymous_client: AsyncClient,
    method: str,
    path: str,
    json_body: dict | None,
) -> None:
    response = await anonymous_client.request(method, path, json=json_body)
    assert response.status_code == 401
    assert response.json()["detail"] == "Authentication required"


@pytest.mark.parametrize("method,path,json_body", _CURATOR_PUBLISH_ENDPOINTS)
@pytest.mark.asyncio
async def test_anonymous_curator_publish_denied(
    anonymous_client: AsyncClient,
    method: str,
    path: str,
    json_body: dict | None,
) -> None:
    response = await anonymous_client.request(method, path, json=json_body)
    assert response.status_code == 401
    assert response.json()["detail"] == "Authentication required"


@pytest.mark.parametrize("method,path,json_body", _WORKFLOW_MUTATION_ENDPOINTS)
@pytest.mark.asyncio
async def test_anonymous_workflow_mutations_denied(
    anonymous_client: AsyncClient,
    method: str,
    path: str,
    json_body: dict | None,
) -> None:
    response = await anonymous_client.request(method, path, json=json_body)
    assert response.status_code == 401
    assert response.json()["detail"] == "Authentication required"
