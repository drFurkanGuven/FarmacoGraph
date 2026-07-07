"""Infrastructure integration tests."""

from __future__ import annotations

import os
import uuid

import pytest
import pytest_asyncio
from httpx import ASGITransport, AsyncClient

# Force test environment before imports
os.environ["FG_ENVIRONMENT"] = "test"
os.environ["FG_DATABASE_URL"] = "sqlite+aiosqlite:///:memory:"
os.environ["FG_NEO4J_ENABLED"] = "false"
os.environ["FG_LOG_JSON"] = "false"

from farmacograph.core.container import Container, reset_container
from farmacograph.repositories.jobs import JobRepository
from farmacograph.events.bus import EventBus


@pytest.fixture(autouse=True)
def _reset_container():
    reset_container()
    yield
    reset_container()


@pytest_asyncio.fixture
async def container():
    c = Container()
    await c.startup()
    yield c
    await c.shutdown()


@pytest_asyncio.fixture
async def client():
    from farmacograph.api.main import create_app
    from farmacograph.core.container import get_container

    app = create_app()
    container = get_container()
    await container.startup()
    transport = ASGITransport(app=app)
    async with AsyncClient(transport=transport, base_url="http://test") as ac:
        yield ac
    await container.shutdown()


@pytest.mark.asyncio
async def test_health_endpoint(client: AsyncClient):
    response = await client.get("/api/v1/health")
    assert response.status_code == 200
    body = response.json()
    assert body["data"]["status"] in ("ok", "degraded")
    assert "postgresql" in body["data"]["checks"]


@pytest.mark.asyncio
async def test_list_drugs_empty(client: AsyncClient):
    response = await client.get("/api/v1/drugs")
    assert response.status_code == 200
    assert response.json()["data"] == []


@pytest.mark.asyncio
async def test_modules_endpoint(client: AsyncClient):
    response = await client.get("/api/v1/modules")
    assert response.status_code == 200
    assert len(response.json()["data"]) >= 1


@pytest.mark.asyncio
async def test_statistics_endpoint(client: AsyncClient):
    response = await client.get("/api/v1/statistics")
    assert response.status_code == 200
    assert "entity_count" in response.json()["data"]


@pytest.mark.asyncio
async def test_search_empty(client: AsyncClient):
    response = await client.get("/api/v1/search", params={"q": "test"})
    assert response.status_code == 200
    assert response.json()["data"] == []


@pytest.mark.asyncio
async def test_job_enqueue(container: Container):
    repo = container.job_repo
    job = await repo.enqueue("graph_validation", {"scope": "test"})
    assert job.status == "pending"
    assert job.job_type == "graph_validation"


@pytest.mark.asyncio
async def test_outbox_append(container: Container):
    event = await container.outbox_repo.append(
        "KnowledgeValidated",
        "ValidationRun",
        str(uuid.uuid4()),
        {"passed": True},
    )
    assert event.status == "pending"


@pytest.mark.asyncio
async def test_event_bus_publish():
    bus = EventBus()
    received: list[dict] = []

    async def handler(event: dict) -> None:
        received.append(event)

    bus.subscribe("DrugPublished", handler)
    await bus.publish(bus.build_event("DrugPublished", "Drug", "test-id", {"slug": "test"}))
    assert len(received) == 1
    assert received[0]["event_type"] == "DrugPublished"


@pytest.mark.asyncio
async def test_jwt_auth_roundtrip():
    from farmacograph.auth.models import create_access_token, decode_access_token
    from farmacograph.core.config import get_settings

    settings = get_settings()
    token = create_access_token("user-1", settings, scopes=["knowledge:read"])
    payload = decode_access_token(token, settings)
    assert payload["sub"] == "user-1"
