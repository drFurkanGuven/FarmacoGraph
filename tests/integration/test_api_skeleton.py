"""Skeleton for future API contract and full-stack integration tests.

Run integration tests:
    pytest -m integration

Skip integration tests in fast local runs:
    pytest -m "not integration"
"""

from __future__ import annotations

import pytest
from httpx import AsyncClient

pytestmark = pytest.mark.integration


@pytest.mark.asyncio
async def test_openapi_health_contract(api_client: AsyncClient) -> None:
    """Covered in tests/api/contract/; kept as integration smoke."""
    response = await api_client.get("/api/v1/health")
    assert response.status_code == 200
    body = response.json()
    assert body["data"]["status"] in ("ok", "degraded")
    assert body["meta"]["api_version"] == "v1"


@pytest.mark.skip(reason="Skeleton: end-to-end curator publish workflow")
@pytest.mark.asyncio
async def test_curator_publish_workflow(api_client: AsyncClient) -> None:
    assert api_client is not None
    # TODO: create draft → validate → publish → verify graph projection


@pytest.mark.skip(reason="Skeleton: search index integration when provider is enabled")
@pytest.mark.asyncio
async def test_search_index_integration(api_client: AsyncClient) -> None:
    response = await api_client.get("/api/v1/search", params={"q": "stub"})
    assert response.status_code == 200
