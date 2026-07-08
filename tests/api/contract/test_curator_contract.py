"""Contract tests for curator and validation endpoints."""

from __future__ import annotations

import pytest
from httpx import AsyncClient

from farmacograph.curator.structural_stub import build_cardiovascular_publish_package
from tests.api.contract.helpers import assert_api_envelope, validate_openapi_response

pytestmark = pytest.mark.contract


@pytest.mark.asyncio
async def test_validation_summary_envelope(
    curator_contract_client: AsyncClient, openapi_spec: dict
) -> None:
    response = await curator_contract_client.get("/api/v1/curator/validation-summary")
    assert response.status_code == 200
    body = response.json()
    assert_api_envelope(body)
    assert "failed_count" in body["data"]
    validate_openapi_response(openapi_spec, "/curator/validation-summary", body)


@pytest.mark.asyncio
async def test_validate_package_envelope(curator_contract_client: AsyncClient) -> None:
    package = build_cardiovascular_publish_package()
    response = await curator_contract_client.post(
        "/api/v1/curator/validate",
        json={
            "entity_payload": package["entity_payload"],
            "related_entities": package.get("related_entities", []),
            "relationships": package.get("relationships", []),
        },
    )
    assert response.status_code == 200
    body = response.json()
    assert_api_envelope(body)
    assert "valid" in body["data"]
    assert isinstance(body["data"]["issues"], list)


@pytest.mark.asyncio
async def test_validate_package_openapi_schema(
    curator_contract_client: AsyncClient, openapi_spec: dict
) -> None:
    package = build_cardiovascular_publish_package()
    response = await curator_contract_client.post(
        "/api/v1/curator/validate",
        json={
            "entity_payload": package["entity_payload"],
            "related_entities": package.get("related_entities", []),
            "relationships": package.get("relationships", []),
        },
    )
    assert response.status_code == 200
    validate_openapi_response(
        openapi_spec,
        "/curator/validate",
        response.json(),
        method="post",
    )
