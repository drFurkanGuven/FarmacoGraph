"""Evidence API tests — envelopes, auth, and graph-backed operations."""

from __future__ import annotations

import os
import uuid

import pytest
import pytest_asyncio
from httpx import ASGITransport, AsyncClient

os.environ.setdefault("FG_ENVIRONMENT", "test")
os.environ.setdefault("FG_DATABASE_URL", "sqlite+aiosqlite:///:memory:")
os.environ.setdefault("FG_NEO4J_ENABLED", "false")
os.environ.setdefault("FG_LOG_JSON", "false")

from farmacograph.core.container import reset_container
from tests.auth.helpers import bearer_headers, curator_token, seed_curator_user
from tests.evidence.test_evidence_service import FakeEvidenceRepo

EVIDENCE_ID = "00000000-0000-4000-8000-000000000010"
DRUG_ID = "00000000-0000-4000-8000-000000000001"
DISEASE_ID = "00000000-0000-4000-8000-000000000003"


@pytest.fixture(autouse=True)
def _reset():
    reset_container()
    yield
    reset_container()


@pytest_asyncio.fixture
async def api_client() -> AsyncClient:
    from farmacograph.api.main import create_app
    from farmacograph.core.container import get_container

    app = create_app()
    container = get_container()
    await container.startup()
    transport = ASGITransport(app=app)
    async with AsyncClient(transport=transport, base_url="http://test") as client:
        yield client
    await container.shutdown()


@pytest_asyncio.fixture
async def curator_client() -> AsyncClient:
    from farmacograph.api.main import create_app
    from farmacograph.core.config import get_settings
    from farmacograph.core.container import get_container

    app = create_app()
    container = get_container()
    await container.startup()
    user, _ = await seed_curator_user(container.session_factory)
    settings = get_settings()
    auth = bearer_headers(curator_token(settings, user.id))
    transport = ASGITransport(app=app)
    async with AsyncClient(transport=transport, base_url="http://test", headers=auth) as client:
        yield client
    await container.shutdown()


@pytest.mark.asyncio
async def test_list_evidence_envelope(api_client: AsyncClient) -> None:
    response = await api_client.get("/api/v1/evidence")
    assert response.status_code == 200
    body = response.json()
    assert "data" in body
    assert "meta" in body
    assert isinstance(body["data"], list)
    assert body["meta"]["api_version"] == "v1"
    assert body["meta"]["count"] == 0
    assert body["meta"]["total"] == 0


@pytest.mark.asyncio
async def test_drug_evidence_uuid_route_envelope(curator_client: AsyncClient, monkeypatch) -> None:
    from farmacograph.api.schemas.evidence import CreateEvidenceRequest
    from farmacograph.core.container import get_container
    from farmacograph.models.enums import EvidenceType

    container = get_container()
    fake_repo = FakeEvidenceRepo()
    monkeypatch.setattr(container.evidence_service, "_repo", fake_repo)
    created, _ = await container.evidence_service.create_evidence(
        CreateEvidenceRequest(
            title="Drug Evidence Stub",
            evidence_type=EvidenceType.REVIEW_ARTICLE,
        )
    )

    response = await curator_client.get(f"/api/v1/drugs/{DRUG_ID}/evidence")

    assert response.status_code == 200
    body = response.json()
    assert body["data"][0]["evidence_id"] == created["id"]
    assert body["meta"]["count"] == 1
    assert body["meta"]["drug_id"] == DRUG_ID


@pytest.mark.asyncio
async def test_drug_evidence_slug_on_uuid_route_returns_422(api_client: AsyncClient) -> None:
    response = await api_client.get("/api/v1/drugs/not-a-uuid/evidence")
    assert response.status_code == 422


@pytest.mark.asyncio
async def test_curator_drug_evidence_slug_route_envelope(
    curator_client: AsyncClient, monkeypatch
) -> None:
    from farmacograph.api.schemas.evidence import CreateEvidenceRequest
    from farmacograph.core.container import get_container
    from farmacograph.models.enums import EvidenceType

    container = get_container()
    fake_repo = FakeEvidenceRepo()
    monkeypatch.setattr(container.evidence_service, "_repo", fake_repo)
    created, _ = await container.evidence_service.create_evidence(
        CreateEvidenceRequest(
            title="Curator Drug Evidence Stub",
            evidence_type=EvidenceType.REVIEW_ARTICLE,
        )
    )

    response = await curator_client.get("/api/v1/curator/drugs/ramipril/evidence")

    assert response.status_code == 200
    body = response.json()
    assert body["data"][0]["evidence_id"] == created["id"]
    assert body["meta"]["count"] == 1
    assert body["meta"]["slug"] == "ramipril"


@pytest.mark.asyncio
async def test_evidence_list_drug_id_query_is_not_scoped(
    api_client: AsyncClient, monkeypatch
) -> None:
    from farmacograph.api.schemas.evidence import CreateEvidenceRequest
    from farmacograph.core.container import get_container
    from farmacograph.models.enums import EvidenceType

    container = get_container()
    fake_repo = FakeEvidenceRepo()
    monkeypatch.setattr(container.evidence_service, "_repo", fake_repo)
    await container.evidence_service.create_evidence(
        CreateEvidenceRequest(title="Evidence A", evidence_type=EvidenceType.REVIEW_ARTICLE)
    )
    await container.evidence_service.create_evidence(
        CreateEvidenceRequest(title="Evidence B", evidence_type=EvidenceType.FDA_LABEL)
    )

    response = await api_client.get("/api/v1/evidence", params={"drug_id": DRUG_ID})

    assert response.status_code == 200
    body = response.json()
    assert body["meta"]["count"] == 2
    assert "drug_id" not in body["meta"]


@pytest.mark.asyncio
async def test_get_evidence_not_found(api_client: AsyncClient) -> None:
    response = await api_client.get(f"/api/v1/evidence/{EVIDENCE_ID}")
    assert response.status_code == 404
    body = response.json()
    assert body["detail"]["code"] == "ENTITY_NOT_FOUND"


@pytest.mark.asyncio
async def test_create_evidence_requires_auth(api_client: AsyncClient) -> None:
    response = await api_client.post(
        "/api/v1/evidence",
        json={
            "title": "Structural Evidence Stub",
            "evidence_type": "fda_label",
        },
    )
    assert response.status_code == 401


@pytest.mark.asyncio
async def test_create_evidence_unavailable_without_neo4j(curator_client: AsyncClient) -> None:
    response = await curator_client.post(
        "/api/v1/evidence",
        json={
            "title": "Structural Evidence Stub",
            "evidence_type": "fda_label",
            "supports_claim": "Structural claim placeholder — not real pharmacology",
        },
    )
    assert response.status_code == 503
    assert response.json()["detail"]["code"] == "SERVICE_UNAVAILABLE"


@pytest.mark.asyncio
async def test_create_evidence_graph_write_failure_returns_503(
    curator_client: AsyncClient, monkeypatch
) -> None:
    from farmacograph.core.container import get_container

    container = get_container()
    fake_repo = FakeEvidenceRepo()

    async def fail_merge(_properties):
        raise RuntimeError("Neo4j rejected nested property")

    monkeypatch.setattr(fake_repo, "merge_evidence", fail_merge)
    monkeypatch.setattr(container.evidence_service, "_repo", fake_repo)

    response = await curator_client.post(
        "/api/v1/evidence",
        json={
            "title": "Structural Evidence Stub",
            "evidence_type": "fda_label",
        },
    )

    assert response.status_code == 503
    body = response.json()
    assert body["detail"]["code"] == "SERVICE_UNAVAILABLE"
    assert "Evidence graph write failed" in body["detail"]["message"]


@pytest.mark.asyncio
async def test_evidence_crud_with_mocked_graph(curator_client: AsyncClient, monkeypatch) -> None:
    from farmacograph.core.container import get_container

    container = get_container()
    fake_repo = FakeEvidenceRepo()
    monkeypatch.setattr(container.evidence_service, "_repo", fake_repo)

    create = await curator_client.post(
        "/api/v1/evidence",
        json={
            "title": "Structural Evidence Stub",
            "evidence_type": "fda_label",
            "supports_claim": "Structural claim placeholder",
        },
    )
    assert create.status_code == 201
    created = create.json()
    assert created["data"]["title"] == "Structural Evidence Stub"
    assert created["meta"]["api_version"] == "v1"

    evidence_id = created["data"]["id"]
    detail = await curator_client.get(f"/api/v1/evidence/{evidence_id}")
    assert detail.status_code == 200
    assert detail.json()["data"]["evidence_type"] == "fda_label"

    patch = await curator_client.patch(
        f"/api/v1/evidence/{evidence_id}",
        json={"quality_score": 0.75},
    )
    assert patch.status_code == 200
    assert patch.json()["data"]["quality_score"] == 0.75

    attach = await curator_client.post(f"/api/v1/evidence/{evidence_id}/drugs/{DRUG_ID}")
    assert attach.status_code == 201
    assert attach.json()["data"]["attached"] is True

    detach = await curator_client.delete(f"/api/v1/evidence/{evidence_id}/drugs/{DRUG_ID}")
    assert detach.status_code == 200
    assert detach.json()["data"]["detached"] is True

    assertion_body = {
        "source_id": DRUG_ID,
        "source_type": "Drug",
        "relationship_type": "TREATS",
        "target_id": DISEASE_ID,
        "target_type": "Disease",
    }
    attach_assertion = await curator_client.post(
        f"/api/v1/evidence/{evidence_id}/assertions",
        json=assertion_body,
    )
    assert attach_assertion.status_code == 201
    assert attach_assertion.json()["data"]["relationship_type"] == "TREATS"

    detach_assertion = await curator_client.request(
        "DELETE",
        f"/api/v1/evidence/{evidence_id}/assertions",
        json=assertion_body,
    )
    assert detach_assertion.status_code == 200
    assert detach_assertion.json()["data"]["detached"] is True


@pytest.mark.asyncio
async def test_attach_to_missing_drug_returns_404(curator_client: AsyncClient, monkeypatch) -> None:
    from farmacograph.api.schemas.evidence import CreateEvidenceRequest
    from farmacograph.core.container import get_container
    from farmacograph.models.enums import EvidenceType

    container = get_container()
    fake_repo = FakeEvidenceRepo()
    monkeypatch.setattr(container.evidence_service, "_repo", fake_repo)
    created, _ = await container.evidence_service.create_evidence(
        CreateEvidenceRequest(
            title="Structural Evidence Stub", evidence_type=EvidenceType.FDA_LABEL
        )
    )

    response = await curator_client.post(
        f"/api/v1/evidence/{created['id']}/drugs/{uuid.uuid4()}",
    )
    assert response.status_code == 404


@pytest.mark.asyncio
async def test_attach_assertion_missing_clinical_edge(
    curator_client: AsyncClient, monkeypatch
) -> None:
    from unittest.mock import AsyncMock

    from farmacograph.api.schemas.evidence import CreateEvidenceRequest
    from farmacograph.core.container import get_container
    from farmacograph.models.enums import EvidenceType

    container = get_container()
    fake_repo = FakeEvidenceRepo()
    fake_repo.clinical_assertion_exists = AsyncMock(return_value=False)  # type: ignore[method-assign]
    monkeypatch.setattr(container.evidence_service, "_repo", fake_repo)
    created, _ = await container.evidence_service.create_evidence(
        CreateEvidenceRequest(
            title="Structural Evidence Stub", evidence_type=EvidenceType.FDA_LABEL
        )
    )

    response = await curator_client.post(
        f"/api/v1/evidence/{created['id']}/assertions",
        json={
            "source_id": DRUG_ID,
            "source_type": "Drug",
            "relationship_type": "TREATS",
            "target_id": DISEASE_ID,
            "target_type": "Disease",
        },
    )
    assert response.status_code == 404
