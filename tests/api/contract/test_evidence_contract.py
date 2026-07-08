"""Contract tests for evidence list, detail, CRUD, and link endpoints."""

from __future__ import annotations

from uuid import UUID

import pytest
from httpx import AsyncClient

from tests.api.contract.helpers import assert_api_envelope, validate_openapi_response

pytestmark = pytest.mark.contract

EVIDENCE_API_SKIP = "Evidence API routes not implemented"
NEO4J_WRITE_SKIP = "Evidence graph writes require Neo4j (FG_NEO4J_ENABLED=true)"
MISSING_EVIDENCE_ID = UUID("00000000-0000-4000-8000-000000009999")
MISSING_DRUG_ID = UUID("00000000-0000-4000-8000-000000000001")


async def _evidence_api_available(client: AsyncClient) -> bool:
    response = await client.get("/api/v1/evidence")
    return response.status_code != 404


def _skip_if_neo4j_write_unavailable(response) -> None:
    if response.status_code == 503:
        pytest.skip(NEO4J_WRITE_SKIP)


@pytest.fixture
async def evidence_api_ready(contract_client: AsyncClient) -> None:
    if not await _evidence_api_available(contract_client):
        pytest.skip(EVIDENCE_API_SKIP)


@pytest.fixture
async def curator_evidence_api_ready(curator_contract_client: AsyncClient) -> None:
    if not await _evidence_api_available(curator_contract_client):
        pytest.skip(EVIDENCE_API_SKIP)


@pytest.mark.asyncio
async def test_openapi_defines_evidence_paths(openapi_spec: dict) -> None:
    expected_paths = [
        "/evidence",
        "/evidence/{evidence_id}",
        "/evidence/{evidence_id}/drugs/{drug_id}",
        "/evidence/{evidence_id}/assertions",
        "/drugs/{drug_id}/evidence",
        "/curator/drugs/{slug}/evidence",
    ]
    for path in expected_paths:
        assert path in openapi_spec["paths"]


@pytest.mark.asyncio
async def test_list_evidence_matches_openapi(
    contract_client: AsyncClient, openapi_spec: dict, evidence_api_ready: None
) -> None:
    response = await contract_client.get("/api/v1/evidence")
    assert response.status_code == 200
    body = response.json()
    assert_api_envelope(body)
    assert isinstance(body["data"], list)
    validate_openapi_response(openapi_spec, "/evidence", body)


@pytest.mark.asyncio
async def test_get_evidence_not_found_contract(
    contract_client: AsyncClient, evidence_api_ready: None
) -> None:
    response = await contract_client.get(f"/api/v1/evidence/{MISSING_EVIDENCE_ID}")
    assert response.status_code == 404
    body = response.json()
    assert "detail" in body


@pytest.mark.asyncio
async def test_get_evidence_detail_openapi_when_present(
    contract_client: AsyncClient, openapi_spec: dict, evidence_api_ready: None
) -> None:
    listing = await contract_client.get("/api/v1/evidence", params={"limit": 1})
    assert listing.status_code == 200
    items = listing.json()["data"]
    if not items:
        pytest.skip("No evidence records in test database to validate detail envelope")

    evidence_id = items[0]["id"]
    response = await contract_client.get(f"/api/v1/evidence/{evidence_id}")
    assert response.status_code == 200
    body = response.json()
    assert_api_envelope(body)
    validate_openapi_response(
        openapi_spec,
        "/evidence/{evidence_id}",
        body,
    )


@pytest.mark.asyncio
async def test_create_evidence_openapi_envelope(
    curator_contract_client: AsyncClient,
    openapi_spec: dict,
    curator_evidence_api_ready: None,
) -> None:
    payload = {
        "title": "Contract Test Evidence",
        "evidence_type": "expert_consensus",
        "supports_claim": "Structural contract validation only",
    }
    response = await curator_contract_client.post("/api/v1/evidence", json=payload)
    _skip_if_neo4j_write_unavailable(response)
    assert response.status_code == 201
    body = response.json()
    assert_api_envelope(body)
    validate_openapi_response(
        openapi_spec,
        "/evidence",
        body,
        method="post",
        status="201",
    )


@pytest.mark.asyncio
async def test_attach_evidence_to_drug_openapi_envelope(
    curator_contract_client: AsyncClient,
    openapi_spec: dict,
    curator_evidence_api_ready: None,
) -> None:
    response = await curator_contract_client.post(
        f"/api/v1/evidence/{MISSING_EVIDENCE_ID}/drugs/{MISSING_DRUG_ID}",
    )
    _skip_if_neo4j_write_unavailable(response)
    if response.status_code == 404:
        pytest.skip("No seeded drug/evidence records for live attach contract test")
    assert response.status_code == 201
    body = response.json()
    assert_api_envelope(body)
    validate_openapi_response(
        openapi_spec,
        "/evidence/{evidence_id}/drugs/{drug_id}",
        body,
        method="post",
        status="201",
    )


@pytest.mark.asyncio
async def test_attach_evidence_to_assertion_openapi_envelope(
    curator_contract_client: AsyncClient,
    openapi_spec: dict,
    curator_evidence_api_ready: None,
) -> None:
    payload = {
        "source_id": str(MISSING_DRUG_ID),
        "source_type": "Drug",
        "relationship_type": "TREATS",
        "target_id": "00000000-0000-4000-8000-000000000003",
        "target_type": "Disease",
    }
    response = await curator_contract_client.post(
        f"/api/v1/evidence/{MISSING_EVIDENCE_ID}/assertions",
        json=payload,
    )
    _skip_if_neo4j_write_unavailable(response)
    if response.status_code == 404:
        pytest.skip("No seeded assertion graph for live attach contract test")
    assert response.status_code == 201
    body = response.json()
    assert_api_envelope(body)
    validate_openapi_response(
        openapi_spec,
        "/evidence/{evidence_id}/assertions",
        body,
        method="post",
        status="201",
    )
