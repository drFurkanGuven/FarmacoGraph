"""Evidence service — CRUD and SUPPORTED_BY attachment orchestration."""

from __future__ import annotations

import time
import uuid
from datetime import UTC, date, datetime
from typing import Any
from uuid import UUID, uuid4

from farmacograph.api.schemas.evidence import (
    AttachAssertionRequest,
    CreateEvidenceRequest,
    UpdateEvidenceRequest,
)
from farmacograph.api.schemas.responses import ResponseMeta
from farmacograph.core.config import Settings
from farmacograph.core.exceptions import NotFoundError, ServiceUnavailableError, ValidationError
from farmacograph.models.enums import ContentLayer, EntityType
from farmacograph.ontology.registry import load_ontology_registry
from farmacograph.repositories.audit import AuditRepository
from farmacograph.repositories.evidence import EvidenceRepository

EVIDENCE_RESOURCE_TYPE = "Evidence"


class EvidenceService:
    def __init__(
        self,
        evidence_repo: EvidenceRepository,
        audit_repo: AuditRepository,
        settings: Settings,
    ) -> None:
        self._repo = evidence_repo
        self._audit = audit_repo
        self._settings = settings
        self._ontology = load_ontology_registry()

    def _meta(
        self, dataset_version: str | None = None, query_time_ms: int | None = None
    ) -> ResponseMeta:
        return ResponseMeta(
            dataset_version=dataset_version
            or self._settings.current_dataset_version
            or "unpublished",
            ontology_version=self._settings.ontology_version,
            query_time_ms=query_time_ms,
            content_layers=[ContentLayer.BIOMEDICAL],
        )

    def _require_graph(self) -> None:
        if not self._repo.is_available:
            raise ServiceUnavailableError(
                "Neo4j not connected — evidence writes require graph database"
            )

    async def list_evidence(
        self,
        *,
        limit: int = 50,
        offset: int = 0,
        evidence_type: str | None = None,
        search: str | None = None,
        dataset_version: str | None = None,
    ) -> tuple[list[dict[str, Any]], dict[str, Any]]:
        start = time.perf_counter()
        rows, total = await self._repo.list_evidence(
            limit=limit,
            offset=offset,
            evidence_type=evidence_type,
            search=search,
            dataset_version=dataset_version,
        )
        elapsed = int((time.perf_counter() - start) * 1000)
        meta = self._meta(dataset_version, elapsed).model_dump()
        meta.update({"count": len(rows), "total": total, "limit": limit, "offset": offset})
        return rows, meta

    async def get_evidence(
        self,
        evidence_id: UUID,
        dataset_version: str | None = None,
    ) -> tuple[dict[str, Any], ResponseMeta]:
        start = time.perf_counter()
        evidence = await self._repo.get_evidence_by_id(evidence_id)
        if evidence is None:
            raise NotFoundError(f"Evidence not found: {evidence_id}")
        if dataset_version and evidence.get("dataset_version") not in (None, dataset_version):
            raise NotFoundError(f"Evidence not found: {evidence_id}")
        elapsed = int((time.perf_counter() - start) * 1000)
        return evidence, self._meta(dataset_version or evidence.get("dataset_version"), elapsed)

    async def create_evidence(
        self,
        body: CreateEvidenceRequest,
        *,
        actor_id: uuid.UUID | None = None,
    ) -> tuple[dict[str, Any], ResponseMeta]:
        self._require_graph()
        evidence_id = uuid4()
        dataset_version = (
            body.dataset_version or self._settings.current_dataset_version or "2026.1.0"
        )
        now = datetime.now(UTC)
        slug = body.slug or EvidenceRepository.slugify_title(body.title)
        properties: dict[str, Any] = {
            "id": str(evidence_id),
            "entity_type": EntityType.EVIDENCE.value,
            "slug": slug,
            "label": body.title,
            "title": body.title,
            "evidence_type": body.evidence_type.value,
            "quality_score": body.quality_score,
            "extract": body.extract,
            "supports_claim": body.supports_claim,
            "journal": body.journal,
            "year": body.year,
            "authors": body.authors,
            "status": "draft",
            "dataset_version": dataset_version,
            "content_layer": ContentLayer.BIOMEDICAL.value,
            "provenance": {
                "created_at": now.isoformat(),
                "updated_at": now.isoformat(),
                "created_by": str(actor_id) if actor_id else "system",
                "source": "manual",
            },
            "versioning": {
                "dataset_version": dataset_version,
                "ontology_version": self._settings.ontology_version,
                "valid_from": date.today().isoformat(),
                "status": "draft",
            },
        }
        node = await self._repo.merge_evidence(properties)
        await self._audit.log(
            "evidence.created",
            EVIDENCE_RESOURCE_TYPE,
            resource_id=str(evidence_id),
            actor_id=actor_id,
            diff={"title": body.title, "evidence_type": body.evidence_type.value},
        )
        return node, self._meta(dataset_version)

    async def update_evidence(
        self,
        evidence_id: UUID,
        body: UpdateEvidenceRequest,
        *,
        actor_id: uuid.UUID | None = None,
    ) -> tuple[dict[str, Any], ResponseMeta]:
        self._require_graph()
        existing = await self._repo.get_evidence_by_id(evidence_id)
        if existing is None:
            raise NotFoundError(f"Evidence not found: {evidence_id}")

        updates = body.model_dump(exclude_unset=True)
        if not updates:
            raise ValidationError("No fields to update")

        merged = {**existing, **updates}
        if body.evidence_type is not None:
            merged["evidence_type"] = body.evidence_type.value
        if body.title is not None:
            merged["label"] = body.title
        provenance = dict(merged.get("provenance") or {})
        provenance["updated_at"] = datetime.now(UTC).isoformat()
        if actor_id:
            provenance["created_by"] = provenance.get("created_by") or str(actor_id)
        merged["provenance"] = provenance
        merged.pop("attachments", None)

        node = await self._repo.merge_evidence(merged)
        await self._audit.log(
            "evidence.updated",
            EVIDENCE_RESOURCE_TYPE,
            resource_id=str(evidence_id),
            actor_id=actor_id,
            diff=updates,
        )
        return node, self._meta(merged.get("dataset_version"))

    async def list_drug_evidence(
        self,
        drug_id: UUID,
        *,
        dataset_version: str | None = None,
    ) -> tuple[list[dict[str, Any]], dict[str, Any]]:
        start = time.perf_counter()
        rows = await self._repo.list_drug_evidence(str(drug_id))
        if dataset_version:
            rows = [
                row
                for row in rows
                if row.get("evidence", {}).get("dataset_version") in (None, dataset_version)
            ]
        elapsed = int((time.perf_counter() - start) * 1000)
        meta = self._meta(dataset_version, elapsed).model_dump()
        meta.update({"count": len(rows), "drug_id": str(drug_id)})
        return rows, meta

    async def attach_to_drug(
        self,
        evidence_id: UUID,
        drug_id: UUID,
        *,
        actor_id: uuid.UUID | None = None,
    ) -> dict[str, Any]:
        self._require_graph()
        await self._ensure_evidence(evidence_id)
        drug = await self._repo.get_entity_by_id(drug_id, "Drug")
        if drug is None:
            raise NotFoundError(f"Drug not found: {drug_id}")
        if not self._ontology.is_allowed("SUPPORTED_BY", "Drug", "Evidence"):
            raise ValidationError("SUPPORTED_BY from Drug to Evidence is not allowed by ontology")

        attached = await self._repo.attach_to_entity(
            source_id=str(drug_id),
            source_type="Drug",
            evidence_id=str(evidence_id),
        )
        await self._audit.log(
            "evidence.attached_drug",
            EVIDENCE_RESOURCE_TYPE,
            resource_id=str(evidence_id),
            actor_id=actor_id,
            diff={"drug_id": str(drug_id), "attached": attached},
        )
        return {"evidence_id": str(evidence_id), "drug_id": str(drug_id), "attached": attached}

    async def detach_from_drug(
        self,
        evidence_id: UUID,
        drug_id: UUID,
        *,
        actor_id: uuid.UUID | None = None,
    ) -> dict[str, Any]:
        self._require_graph()
        await self._ensure_evidence(evidence_id)
        detached = await self._repo.detach_from_entity(
            source_id=str(drug_id),
            source_type="Drug",
            evidence_id=str(evidence_id),
            assertion=None,
        )
        await self._audit.log(
            "evidence.detached_drug",
            EVIDENCE_RESOURCE_TYPE,
            resource_id=str(evidence_id),
            actor_id=actor_id,
            diff={"drug_id": str(drug_id), "detached": detached},
        )
        return {"evidence_id": str(evidence_id), "drug_id": str(drug_id), "detached": detached}

    async def attach_to_assertion(
        self,
        evidence_id: UUID,
        body: AttachAssertionRequest,
        *,
        actor_id: uuid.UUID | None = None,
    ) -> dict[str, Any]:
        self._require_graph()
        await self._ensure_evidence(evidence_id)
        source_type = body.source_type
        target_type = body.target_type
        if not self._ontology.is_allowed("SUPPORTED_BY", source_type, "Evidence"):
            raise ValidationError(
                f"SUPPORTED_BY from {source_type} to Evidence is not allowed by ontology"
            )
        source = await self._repo.get_entity_by_id(body.source_id, source_type)
        if source is None:
            raise NotFoundError(f"Source entity not found: {body.source_id}")
        target = await self._repo.get_entity_by_id(body.target_id, target_type)
        if target is None:
            raise NotFoundError(f"Target entity not found: {body.target_id}")
        exists = await self._repo.clinical_assertion_exists(
            source_id=str(body.source_id),
            source_type=source_type,
            relationship_type=body.relationship_type,
            target_id=str(body.target_id),
            target_type=target_type,
        )
        if not exists:
            raise NotFoundError(
                f"Clinical assertion not found: {source_type} -[{body.relationship_type}]-> {target_type}"
            )

        assertion = {
            "assertion_relationship": body.relationship_type,
            "assertion_target_id": str(body.target_id),
            "assertion_target_type": target_type,
        }
        attached = await self._repo.attach_to_entity(
            source_id=str(body.source_id),
            source_type=source_type,
            evidence_id=str(evidence_id),
            assertion=assertion,
        )
        await self._audit.log(
            "evidence.attached_assertion",
            EVIDENCE_RESOURCE_TYPE,
            resource_id=str(evidence_id),
            actor_id=actor_id,
            diff={
                "source_id": str(body.source_id),
                "relationship_type": body.relationship_type,
                "target_id": str(body.target_id),
                "attached": attached,
            },
        )
        return {
            "evidence_id": str(evidence_id),
            "source_id": str(body.source_id),
            "relationship_type": body.relationship_type,
            "target_id": str(body.target_id),
            "attached": attached,
        }

    async def detach_from_assertion(
        self,
        evidence_id: UUID,
        body: AttachAssertionRequest,
        *,
        actor_id: uuid.UUID | None = None,
    ) -> dict[str, Any]:
        self._require_graph()
        await self._ensure_evidence(evidence_id)
        assertion = {
            "assertion_relationship": body.relationship_type,
            "assertion_target_id": str(body.target_id),
            "assertion_target_type": body.target_type,
        }
        detached = await self._repo.detach_from_entity(
            source_id=str(body.source_id),
            source_type=body.source_type,
            evidence_id=str(evidence_id),
            assertion=assertion,
        )
        await self._audit.log(
            "evidence.detached_assertion",
            EVIDENCE_RESOURCE_TYPE,
            resource_id=str(evidence_id),
            actor_id=actor_id,
            diff={
                "source_id": str(body.source_id),
                "relationship_type": body.relationship_type,
                "target_id": str(body.target_id),
                "detached": detached,
            },
        )
        return {
            "evidence_id": str(evidence_id),
            "source_id": str(body.source_id),
            "relationship_type": body.relationship_type,
            "target_id": str(body.target_id),
            "detached": detached,
        }

    async def _ensure_evidence(self, evidence_id: UUID) -> dict[str, Any]:
        evidence = await self._repo.get_evidence_by_id(evidence_id)
        if evidence is None:
            raise NotFoundError(f"Evidence not found: {evidence_id}")
        return evidence
