"""Integration tests for validation and curator API flows."""

from __future__ import annotations

import pytest
from httpx import AsyncClient

from farmacograph.curator.structural_stub import (
    CV_STUB_DRUG_ID,
    build_cardiovascular_publish_package,
)

pytestmark = pytest.mark.integration


@pytest.mark.asyncio
async def test_validate_structural_stub_package(curator_client: AsyncClient) -> None:
    package = build_cardiovascular_publish_package()
    response = await curator_client.post(
        "/api/v1/curator/validate",
        json={
            "entity_payload": package["entity_payload"],
            "related_entities": package.get("related_entities", []),
            "relationships": package.get("relationships", []),
        },
    )
    assert response.status_code == 200
    body = response.json()["data"]
    assert "valid" in body
    assert isinstance(body["issues"], list)


@pytest.mark.asyncio
async def test_validation_summary_after_workflow(curator_client: AsyncClient) -> None:
    await curator_client.post(
        "/api/v1/curator/workflows",
        json={"entity_id": CV_STUB_DRUG_ID, "entity_type": "Drug", "notes": "validation flow"},
    )
    response = await curator_client.get("/api/v1/curator/validation-summary")
    assert response.status_code == 200
    assert "failed_count" in response.json()["data"]


@pytest.mark.skip(reason="Skeleton: validation UI job trigger when Task A wires async validation")
@pytest.mark.asyncio
async def test_validation_job_enqueue(api_client: AsyncClient) -> None:
    response = await api_client.get("/api/v1/jobs", params={"job_type": "graph_validation"})
    assert response.status_code == 200
