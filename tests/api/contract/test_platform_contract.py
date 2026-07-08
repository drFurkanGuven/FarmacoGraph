"""Contract tests for search, modules, and statistics endpoints."""

from __future__ import annotations

import pytest
from httpx import AsyncClient

from tests.api.contract.helpers import assert_api_envelope, validate_openapi_response

pytestmark = pytest.mark.contract


@pytest.mark.asyncio
async def test_search_matches_openapi(contract_client: AsyncClient, openapi_spec: dict) -> None:
    response = await contract_client.get("/api/v1/search", params={"q": "stub"})
    assert response.status_code == 200
    body = response.json()
    assert_api_envelope(body)
    validate_openapi_response(openapi_spec, "/search", body)


@pytest.mark.asyncio
async def test_modules_matches_openapi(contract_client: AsyncClient, openapi_spec: dict) -> None:
    response = await contract_client.get("/api/v1/modules")
    assert response.status_code == 200
    body = response.json()
    assert_api_envelope(body)
    validate_openapi_response(openapi_spec, "/modules", body)


@pytest.mark.asyncio
async def test_statistics_matches_openapi(contract_client: AsyncClient, openapi_spec: dict) -> None:
    response = await contract_client.get("/api/v1/statistics")
    assert response.status_code == 200
    body = response.json()
    assert_api_envelope(body)
    validate_openapi_response(openapi_spec, "/statistics", body)
