"""Evidence service unit tests."""

from __future__ import annotations

import uuid
from typing import Any
from unittest.mock import AsyncMock

import pytest

from farmacograph.api.schemas.evidence import (
    AttachAssertionRequest,
    CreateEvidenceRequest,
    UpdateEvidenceRequest,
)
from farmacograph.core.config import Settings
from farmacograph.core.exceptions import NotFoundError, ServiceUnavailableError, ValidationError
from farmacograph.models.enums import EvidenceType
from farmacograph.repositories.audit import AuditRepository
from farmacograph.services.evidence import EvidenceService


class FakeEvidenceRepo:
    is_available = True

    def __init__(self) -> None:
        self.nodes: dict[str, dict[str, Any]] = {}

    async def list_evidence(self, **kwargs: Any) -> tuple[list[dict[str, Any]], int]:
        rows = list(self.nodes.values())
        return rows, len(rows)

    async def list_drug_evidence(self, drug_id: str) -> list[dict[str, Any]]:
        rows = list(self.nodes.values())
        return [
            {
                "evidence_id": row["id"],
                "evidence": row,
                "assertion": None,
            }
            for row in rows
        ]

    async def get_evidence_by_id(self, evidence_id: uuid.UUID) -> dict[str, Any] | None:
        return self.nodes.get(str(evidence_id))

    async def get_entity_by_id(self, entity_id: uuid.UUID, label: str) -> dict[str, Any] | None:
        entity_key = str(entity_id)
        if label == "Drug" and entity_key == "00000000-0000-4000-8000-000000000001":
            return {"id": entity_key, "slug": "cv-structural-stub"}
        if label == "Disease" and entity_key == "00000000-0000-4000-8000-000000000003":
            return {"id": entity_key, "slug": "cv-stub-indication"}
        return None

    async def merge_evidence(self, properties: dict[str, Any]) -> dict[str, Any]:
        node = dict(properties)
        self.nodes[node["id"]] = node
        return node

    async def attach_to_entity(self, **kwargs: Any) -> bool:
        return True

    async def detach_from_entity(self, **kwargs: Any) -> bool:
        return True

    async def clinical_assertion_exists(self, **kwargs: Any) -> bool:
        return True


@pytest.fixture
def service() -> EvidenceService:
    repo = FakeEvidenceRepo()
    audit = AsyncMock(spec=AuditRepository)
    audit.log = AsyncMock()
    settings = Settings(environment="test", current_dataset_version="2026.1.0")
    svc = EvidenceService(repo, audit, settings)  # type: ignore[arg-type]
    return svc


@pytest.mark.asyncio
async def test_create_evidence_structural_stub(service: EvidenceService) -> None:
    body = CreateEvidenceRequest(
        title="Structural Evidence Stub",
        evidence_type=EvidenceType.FDA_LABEL,
        supports_claim="Placeholder claim",
    )
    data, meta = await service.create_evidence(body, actor_id=uuid.uuid4())
    assert data["title"] == "Structural Evidence Stub"
    assert data["evidence_type"] == "fda_label"
    assert data["status"] == "draft"
    assert meta.dataset_version == "2026.1.0"


@pytest.mark.asyncio
async def test_update_requires_fields(service: EvidenceService) -> None:
    body = CreateEvidenceRequest(
        title="Structural Evidence Stub", evidence_type=EvidenceType.FDA_LABEL
    )
    data, _ = await service.create_evidence(body)
    evidence_id = uuid.UUID(data["id"])

    with pytest.raises(ValidationError):
        await service.update_evidence(evidence_id, UpdateEvidenceRequest())


@pytest.mark.asyncio
async def test_get_missing_evidence(service: EvidenceService) -> None:
    with pytest.raises(NotFoundError):
        await service.get_evidence(uuid.UUID("00000000-0000-4000-8000-000000009999"))


@pytest.mark.asyncio
async def test_writes_fail_when_graph_unavailable() -> None:
    repo = FakeEvidenceRepo()
    repo.is_available = False
    audit = AsyncMock(spec=AuditRepository)
    settings = Settings(environment="test")
    svc = EvidenceService(repo, audit, settings)  # type: ignore[arg-type]
    body = CreateEvidenceRequest(
        title="Structural Evidence Stub", evidence_type=EvidenceType.FDA_LABEL
    )

    with pytest.raises(ServiceUnavailableError):
        await svc.create_evidence(body)


@pytest.mark.asyncio
async def test_attach_assertion_validates_ontology(service: EvidenceService) -> None:
    body = CreateEvidenceRequest(
        title="Structural Evidence Stub", evidence_type=EvidenceType.FDA_LABEL
    )
    data, _ = await service.create_evidence(body)
    evidence_id = uuid.UUID(data["id"])

    with pytest.raises(ValidationError):
        await service.attach_to_assertion(
            evidence_id,
            AttachAssertionRequest(
                source_id=uuid.UUID("00000000-0000-4000-8000-000000000001"),
                source_type="EducationResource",
                relationship_type="TREATS",
                target_id=uuid.UUID("00000000-0000-4000-8000-000000000003"),
                target_type="Disease",
            ),
        )
