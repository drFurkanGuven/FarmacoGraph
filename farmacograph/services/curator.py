"""Curator service — orchestrates workflow transitions and publish pipeline."""

from __future__ import annotations

import uuid
from typing import Any

from farmacograph.core.exceptions import NotFoundError, ValidationError
from farmacograph.curator.drug_package import (
    CV_DRUGS_DIR,
    build_drug_entry_package,
    drug_entity_id,
    load_curriculum,
    load_package,
)
from farmacograph.curator.publish_validator import (
    require_valid_publish_package,
    validate_publish_package,
)
from farmacograph.curator.workflow import InvalidTransitionError
from farmacograph.db.postgres.models import CuratorWorkflow
from farmacograph.events.bus import EventBus
from farmacograph.repositories.audit import AuditRepository
from farmacograph.repositories.curator import CuratorRepository
from farmacograph.repositories.graph import GraphRepository
from farmacograph.repositories.graph_writer import GraphWriter
from farmacograph.repositories.jobs import JobRepository
from farmacograph.repositories.outbox import OutboxRepository
from farmacograph.services.snapshot import SnapshotService
from farmacograph.validators.base import ValidationSeverity
from farmacograph.workers.graph_validation import GraphValidationWorker


class CuratorService:
    def __init__(
        self,
        curator_repo: CuratorRepository,
        graph_repo: GraphRepository,
        graph_writer: GraphWriter,
        outbox_repo: OutboxRepository,
        job_repo: JobRepository,
        audit_repo: AuditRepository,
        event_bus: EventBus,
        snapshot_service: SnapshotService,
        graph_validation_worker: GraphValidationWorker,
    ) -> None:
        self._curator = curator_repo
        self._graph = graph_repo
        self._writer = graph_writer
        self._outbox = outbox_repo
        self._jobs = job_repo
        self._audit = audit_repo
        self._bus = event_bus
        self._snapshots = snapshot_service
        self._graph_validation = graph_validation_worker

    async def create_draft(
        self,
        entity_id: str,
        entity_type: str,
        *,
        workspace_id: uuid.UUID | None = None,
        notes: str | None = None,
        actor_id: uuid.UUID | None = None,
    ) -> CuratorWorkflow:
        workflow = await self._curator.create(
            entity_id, entity_type, workspace_id=workspace_id, notes=notes
        )
        await self._audit.log(
            "curator.draft_created",
            "CuratorWorkflow",
            resource_id=str(workflow.id),
            actor_id=actor_id,
            workspace_id=workspace_id,
        )
        return workflow

    async def submit_for_review(
        self, workflow_id: uuid.UUID, *, actor_id: uuid.UUID | None = None
    ) -> CuratorWorkflow:
        return await self._transition(
            workflow_id, "review", action="curator.submitted", actor_id=actor_id
        )

    async def approve(
        self, workflow_id: uuid.UUID, *, actor_id: uuid.UUID | None = None, notes: str | None = None
    ) -> CuratorWorkflow:
        return await self._transition(
            workflow_id, "approved", action="curator.approved", actor_id=actor_id, notes=notes
        )

    async def publish(
        self,
        workflow_id: uuid.UUID,
        entity_payload: dict[str, Any],
        *,
        actor_id: uuid.UUID | None = None,
        dataset_version: str = "2026.1.0",
        related_entities: list[dict[str, Any]] | None = None,
        relationships: list[dict[str, Any]] | None = None,
        module: str | None = None,
        create_snapshot: bool = False,
    ) -> CuratorWorkflow:
        """Validate, write to Neo4j, transition workflow, emit events."""
        workflow = await self._curator.get(workflow_id)
        if workflow is None:
            raise NotFoundError(f"Workflow not found: {workflow_id}")
        if workflow.state != "approved":
            raise ValidationError(f"Cannot publish from state: {workflow.state}")

        label = entity_payload.get("entity_type", workflow.entity_type)
        entity_payload.setdefault("status", "published")
        entity_payload.setdefault("dataset_version", dataset_version)
        if module:
            entity_payload.setdefault("module", module)

        require_valid_publish_package(
            entity_payload,
            related_entities=related_entities,
            relationships=relationships,
        )

        if self._writer.is_available:
            await self._writer.publish_package(
                entity_payload,
                related_entities=related_entities,
                relationships=relationships,
            )

        updated = await self._transition(
            workflow_id, "published", action="curator.published", actor_id=actor_id
        )

        await self._outbox.append(
            "DrugPublished" if label == "Drug" else "KnowledgeValidated",
            label,
            workflow.entity_id,
            {"entity_id": workflow.entity_id, "dataset_version": dataset_version},
            actor_id=actor_id,
        )
        job = await self._jobs.enqueue(
            "graph_validation",
            {"entity_id": workflow.entity_id, "workflow_id": str(workflow_id)},
            created_by=actor_id,
        )
        if self._writer.is_available:
            try:
                await self._graph_validation.execute(job.payload_json)
                await self._jobs.mark_completed(job.id, {"validated": True})
            except Exception as exc:
                await self._jobs.mark_failed(job.id, str(exc))

        if create_snapshot and module:
            await self._snapshots.create_module_snapshot(
                module,
                dataset_version,
                actor_id=actor_id,
                structural_stub=entity_payload.get("slug", "").endswith("structural-stub"),
            )

        event = self._bus.build_event(
            "DrugPublished" if label == "Drug" else "KnowledgeValidated",
            label,
            workflow.entity_id,
            {"dataset_version": dataset_version, "module": module},
        )
        await self._bus.publish(event)
        return updated

    async def get_queue(self, state: str = "review", *, limit: int = 50) -> list[CuratorWorkflow]:
        return await self._curator.list_by_state(state, limit=limit)

    async def get_workflow(self, workflow_id: uuid.UUID) -> CuratorWorkflow:
        workflow = await self._curator.get(workflow_id)
        if workflow is None:
            raise NotFoundError(f"Workflow not found: {workflow_id}")
        return workflow

    async def _transition(
        self,
        workflow_id: uuid.UUID,
        to_state: str,
        *,
        action: str,
        actor_id: uuid.UUID | None = None,
        notes: str | None = None,
    ) -> CuratorWorkflow:
        try:
            workflow = await self._curator.transition(workflow_id, to_state, notes=notes)
        except InvalidTransitionError as exc:
            raise ValidationError(str(exc)) from exc
        await self._audit.log(
            action,
            "CuratorWorkflow",
            resource_id=str(workflow_id),
            actor_id=actor_id,
            diff={"to_state": to_state},
        )
        return workflow

    async def list_drugs_browser(
        self,
        *,
        module: str = "cardiovascular",
        search: str = "",
        status: str | None = None,
        workflow_state: str | None = None,
        limit: int = 50,
        offset: int = 0,
        sort: str = "slug",
    ) -> tuple[list[dict[str, Any]], int]:
        curriculum = load_curriculum()
        workflows = await self._curator.list_all_workflows()
        workflow_by_entity = {w.entity_id: w for w in workflows}
        items: list[dict[str, Any]] = []
        needle = search.strip().lower()

        for category in curriculum.get("categories", []):
            for drug in category.get("drugs", []):
                slug = drug["slug"]
                if (
                    needle
                    and needle not in slug.lower()
                    and needle not in slug.replace("-", " ").lower()
                ):
                    continue

                entity_id = drug_entity_id(slug)
                workflow = workflow_by_entity.get(entity_id)
                graph_drug = (
                    await self._graph.get_drug_by_slug(slug) if self._graph.is_available else None
                )
                curriculum_status = drug.get("status", "pending")
                publication_status = "published" if graph_drug else curriculum_status

                if status and publication_status != status:
                    continue
                if workflow_state and (workflow is None or workflow.state != workflow_state):
                    continue

                validation = self._validate_package_dict(
                    workflow.draft_package_json if workflow else None
                )
                items.append(
                    {
                        "slug": slug,
                        "label": slug.replace("-", " ").title(),
                        "entity_id": entity_id,
                        "module": module,
                        "category_slug": category.get("slug"),
                        "category_name": category.get("name"),
                        "curriculum_status": curriculum_status,
                        "publication_status": publication_status,
                        "workflow_id": str(workflow.id) if workflow else None,
                        "workflow_state": workflow.state if workflow else None,
                        "validation_valid": validation["valid"],
                        "validation_errors": validation["error_count"],
                        "confidence_score": graph_drug.get("confidence_score")
                        if graph_drug
                        else None,
                    }
                )

        reverse = sort.startswith("-")
        key_name = sort.lstrip("-")
        if key_name == "label":
            items.sort(key=lambda row: row["label"].lower(), reverse=reverse)
        else:
            items.sort(key=lambda row: row["slug"], reverse=reverse)

        total = len(items)
        return items[offset : offset + limit], total

    async def get_or_create_workflow_for_slug(
        self, slug: str, *, actor_id: uuid.UUID | None = None
    ) -> tuple[CuratorWorkflow, dict[str, Any]]:
        entity_id = drug_entity_id(slug)
        workflow = await self._curator.get_by_entity(entity_id)
        package = await self.resolve_package(slug, workflow)
        if workflow is None:
            workflow = await self.create_draft(
                entity_id, "Drug", notes=f"Curriculum slug: {slug}", actor_id=actor_id
            )
            workflow = await self._curator.save_draft_package(workflow.id, package)
        elif workflow.draft_package_json is None:
            workflow = await self._curator.save_draft_package(workflow.id, package)
        return workflow, package

    async def get_drug_package(self, slug: str) -> tuple[dict[str, Any], CuratorWorkflow | None]:
        entity_id = drug_entity_id(slug)
        workflow = await self._curator.get_by_entity(entity_id)
        package = await self.resolve_package(slug, workflow)
        return package, workflow

    async def resolve_package(
        self, slug: str, workflow: CuratorWorkflow | None = None
    ) -> dict[str, Any]:
        if workflow and workflow.draft_package_json:
            return workflow.draft_package_json

        package_path = CV_DRUGS_DIR / f"{slug}.json"
        if package_path.is_file():
            return load_package(package_path).model_dump()

        return build_drug_entry_package(slug)

    async def save_draft_package(
        self,
        workflow_id: uuid.UUID,
        package: dict[str, Any],
        *,
        actor_id: uuid.UUID | None = None,
    ) -> CuratorWorkflow:
        workflow = await self.get_workflow(workflow_id)
        if workflow.state not in ("draft", "review"):
            raise ValidationError(f"Cannot edit package in state: {workflow.state}")
        updated = await self._curator.save_draft_package(workflow_id, package)
        await self._audit.log(
            "curator.draft_saved",
            "CuratorWorkflow",
            resource_id=str(workflow_id),
            actor_id=actor_id,
            diff={"slug": package.get("entity_payload", {}).get("slug")},
        )
        return updated

    def validate_draft_package(self, package: dict[str, Any]) -> dict[str, Any]:
        return self._validate_package_dict(package)

    @staticmethod
    def _validate_package_dict(package: dict[str, Any] | None) -> dict[str, Any]:
        if not package:
            return {"valid": False, "error_count": 0, "warning_count": 0, "issues": []}
        entity = package.get("entity_payload") or {}
        result = validate_publish_package(
            entity,
            related_entities=package.get("related_entities"),
            relationships=package.get("relationships"),
        )
        errors = [i for i in result.issues if i.severity == ValidationSeverity.ERROR]
        warnings = [i for i in result.issues if i.severity == ValidationSeverity.WARNING]
        return {
            "valid": result.valid,
            "error_count": len(errors),
            "warning_count": len(warnings),
            "issues": [i.model_dump() for i in result.issues],
            "publish_ready": result.valid
            and entity.get("provenance", {}).get("curator_attestation") is True,
        }
