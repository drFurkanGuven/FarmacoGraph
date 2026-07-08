"""Contract tests for drug list and detail endpoints."""

from __future__ import annotations

import pytest
from httpx import AsyncClient

from tests.api.contract.helpers import assert_api_envelope, validate_openapi_response

pytestmark = pytest.mark.contract


@pytest.mark.asyncio
async def test_list_drugs_matches_openapi(contract_client: AsyncClient, openapi_spec: dict) -> None:
    response = await contract_client.get("/api/v1/drugs")
    assert response.status_code == 200
    body = response.json()
    assert_api_envelope(body)
    assert isinstance(body["data"], list)
    validate_openapi_response(openapi_spec, "/drugs", body)


@pytest.mark.asyncio
async def test_get_drug_not_found_contract(
    contract_client: AsyncClient, openapi_spec: dict
) -> None:
    missing_id = "00000000-0000-4000-8000-000000009999"
    response = await contract_client.get(f"/api/v1/drugs/{missing_id}")
    assert response.status_code == 404
    body = response.json()
    assert "detail" in body


@pytest.mark.skip(
    reason="Route not implemented: GET /drugs/{drug_id}/graph (future graph projection)"
)
@pytest.mark.asyncio
async def test_drug_graph_contract(contract_client: AsyncClient, openapi_spec: dict) -> None:
    response = await contract_client.get("/api/v1/drugs/00000000-0000-4000-8000-000000000001/graph")
    assert response.status_code == 200
    validate_openapi_response(openapi_spec, "/drugs/{drug_id}/graph", response.json())
