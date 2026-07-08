"""Contract tests for health and discovery endpoints."""

from __future__ import annotations

import pytest
from httpx import AsyncClient

from tests.api.contract.helpers import assert_api_envelope, validate_openapi_response

pytestmark = pytest.mark.contract


@pytest.mark.asyncio
async def test_health_response_contract(contract_client: AsyncClient, openapi_spec: dict) -> None:
    response = await contract_client.get("/api/v1/health")
    assert response.status_code == 200
    body = response.json()
    assert_api_envelope(body)
    assert body["data"]["status"] in ("ok", "degraded")
    assert isinstance(body["data"]["checks"], dict)
    validate_openapi_response(openapi_spec, "/health", body)


@pytest.mark.asyncio
async def test_info_endpoint_envelope(contract_client: AsyncClient, openapi_spec: dict) -> None:
    response = await contract_client.get("/api/v1/info")
    assert response.status_code == 200
    body = response.json()
    assert_api_envelope(body)
    assert body["data"]["api_version"] == "v1"
    assert "authentication" in body["data"]
    validate_openapi_response(openapi_spec, "/info", body)
