"""Contract tests for auth endpoints."""

from __future__ import annotations

import pytest
from httpx import AsyncClient

from tests.api.contract.helpers import validate_openapi_response

pytestmark = pytest.mark.contract


@pytest.mark.asyncio
async def test_introspect_matches_openapi(
    curator_contract_client: AsyncClient, openapi_spec: dict
) -> None:
    response = await curator_contract_client.post("/api/v1/auth/introspect", json={})
    assert response.status_code == 200
    validate_openapi_response(
        openapi_spec,
        "/auth/introspect",
        response.json(),
        method="post",
    )
