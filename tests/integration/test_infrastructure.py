"""Infrastructure integration tests."""

from __future__ import annotations

import uuid

import pytest
from httpx import AsyncClient

from farmacograph.core.container import Container
from farmacograph.events.bus import EventBus

pytestmark = pytest.mark.integration


@pytest.mark.asyncio
async def test_health_endpoint(api_client: AsyncClient):
    response = await api_client.get("/api/v1/health")
    assert response.status_code == 200
    body = response.json()
    assert body["data"]["status"] in ("ok", "degraded")
    assert "postgresql" in body["data"]["checks"]


@pytest.mark.asyncio
async def test_list_drugs_empty(api_client: AsyncClient):
    response = await api_client.get("/api/v1/drugs")
    assert response.status_code == 200
    assert response.json()["data"] == []


@pytest.mark.asyncio
async def test_modules_endpoint(api_client: AsyncClient):
    response = await api_client.get("/api/v1/modules")
    assert response.status_code == 200
    assert len(response.json()["data"]) >= 1


@pytest.mark.asyncio
async def test_statistics_endpoint(api_client: AsyncClient):
    response = await api_client.get("/api/v1/statistics")
    assert response.status_code == 200
    assert "entity_count" in response.json()["data"]


@pytest.mark.asyncio
async def test_search_empty(api_client: AsyncClient):
    response = await api_client.get("/api/v1/search", params={"q": "test"})
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
