"""Integration tests for drug list and detail API flows."""

from __future__ import annotations

import pytest
from httpx import AsyncClient

pytestmark = pytest.mark.integration


@pytest.mark.asyncio
async def test_drugs_pagination_params(api_client: AsyncClient) -> None:
    response = await api_client.get("/api/v1/drugs", params={"limit": 10, "offset": 0})
    assert response.status_code == 200
    body = response.json()
    assert isinstance(body["data"], list)
    assert body["meta"]["api_version"] == "v1"


@pytest.mark.asyncio
async def test_drugs_module_filter_accepted(api_client: AsyncClient) -> None:
    response = await api_client.get("/api/v1/drugs", params={"module": "cardiovascular"})
    assert response.status_code == 200
    assert isinstance(response.json()["data"], list)


@pytest.mark.asyncio
async def test_drug_detail_not_found(api_client: AsyncClient) -> None:
    missing_id = "00000000-0000-4000-8000-000000009999"
    response = await api_client.get(f"/api/v1/drugs/{missing_id}")
    assert response.status_code == 404


@pytest.mark.skip(reason="Skeleton: drug create/update when Task A implements write endpoints")
@pytest.mark.asyncio
async def test_drug_write_flow(api_client: AsyncClient) -> None:
    assert api_client is not None
