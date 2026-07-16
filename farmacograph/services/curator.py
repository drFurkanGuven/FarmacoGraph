"""Curator service — orchestrates workflow transitions and publish pipeline."""

from __future__ import annotations

import uuid
from datetime import UTC, datetime
from typing import Any

from farmacograph.core.exceptions import NotFoundError, ValidationError
from farmacograph.curator.disease_package import (
    CV_DISEASES_DIR,
    build_disease_entry_package,
    disease_entity_id,
    list_disease_catalog,
    load_disease_package,
    register_disease,
)
from farmacograph.curator.drug_package import (
    CV_DRUGS_DIR,
    build_drug_entry_package,
    drug_entity_id,
    load_curriculum,
    load_package,
)
from farmacograph.curator.drug_runtime import (
    build_drug_package_for_class,
    find_runtime_drug,
    list_drug_classes,
    list_runtime_drug_entries,
    register_drug,
)
from farmacograph.curator.education_graph import normalize_education_graph
from farmacograph.curator.education_package import education_items_for_entity, flashcards_for_entity
from farmacograph.curator.mechanism_catalog import (
    list_mechanism_fragment_catalog,
    register_mechanism_fragment,
)
from farmacograph.curator.publish_validator import (
    require_valid_publish_package,
    validate_publish_package,
)
from farmacograph.curator.relationship_graph import normalize_drug_relationship_graph
from farmacograph.curator.workflow import InvalidTransitionError, allowed_transitions
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

WORKFLOW_RESOURCE_TYPE = "CuratorWorkflow"

ACTION_TIMELINE_KIND: dict[str, str] = {
    "curator.draft_created": "workflow_created",
    "curator.draft_saved": "autosaved",
    "curator.validated": "validation_run",
    "curator.submitted": "submitted",
    "curator.approved": "approved",
    "curator.returned_to_draft": "returned_to_draft",
    "curator.unpublished": "returned_to_draft",
    "curator.restored": "returned_to_draft",
    "curator.unpublish_requested": "unpublish_requested",
    "curator.unpublish_request_cancelled": "unpublish_request_cancelled",
    "curator.unpublish_request_rejected": "unpublish_request_rejected",
    "curator.published": "published",
    "curator.publish_failed": "publish_failed",
    "curator.deprecated": "deprecated",
    "curator.snapshot_created": "snapshot_created",
}


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
            WORKFLOW_RESOURCE_TYPE,
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

    async def return_to_draft(
        self,
        workflow_id: uuid.UUID,
        *,
        actor_id: uuid.UUID | None = None,
        notes: str | None = None,
        allow_published: bool = False,
        allow_deprecated: bool = False,
    ) -> CuratorWorkflow:
        """Return workflow to draft.

        Published → draft requires allow_published (admin unpublish).
        Deprecated → draft requires allow_deprecated (admin restore).
        """
        workflow = await self.get_workflow(workflow_id)
        if workflow.state == "published" and not allow_published:
            raise ValidationError(
                "Cannot return published workflow to draft without admin unpublish "
                "(requires admin:org)."
            )
        if workflow.state == "deprecated" and not allow_deprecated:
            raise ValidationError(
                "Cannot restore deprecated workflow to draft without admin restore "
                "(requires admin:org)."
            )
        was_published = workflow.state == "published"
        was_deprecated = workflow.state == "deprecated"
        if was_deprecated:
            action = "curator.restored"
        elif was_published:
            action = "curator.unpublished"
        else:
            action = "curator.returned_to_draft"
        workflow = await self._transition(
            workflow_id,
            "draft",
            action=action,
            actor_id=actor_id,
            notes=notes,
        )
        if was_published or was_deprecated:
            workflow = await self._patch_package_status(workflow, "draft", deprecated=False)
            workflow = await self._curator.clear_unpublish_request(workflow.id)
            await self._sync_graph_status(workflow, status="draft", deprecated=False)
        else:
            workflow = await self._patch_package_status(workflow, "draft")
        return workflow

    async def request_unpublish(
        self,
        workflow_id: uuid.UUID,
        *,
        actor_id: uuid.UUID,
        notes: str,
    ) -> CuratorWorkflow:
        """Curator asks admin to unpublish; does not change workflow state."""
        workflow = await self.get_workflow(workflow_id)
        if workflow.state != "published":
            raise ValidationError(
                f"Unpublish requests require published state, got: {workflow.state}"
            )
        if workflow.unpublish_requested_at is not None:
            raise ValidationError("An unpublish request is already pending for this workflow")
        reason = notes.strip()
        if not reason:
            raise ValidationError("Unpublish request notes are required")
        workflow = await self._curator.set_unpublish_request(
            workflow_id,
            requested_by=actor_id,
            notes=reason,
            requested_at=datetime.now(UTC),
        )
        await self._audit.log(
            "curator.unpublish_requested",
            WORKFLOW_RESOURCE_TYPE,
            resource_id=str(workflow_id),
            actor_id=actor_id,
            diff={"notes": reason},
        )
        return workflow

    async def cancel_unpublish_request(
        self,
        workflow_id: uuid.UUID,
        *,
        actor_id: uuid.UUID,
        allow_admin: bool = False,
    ) -> CuratorWorkflow:
        """Requester (or admin) cancels a pending unpublish request."""
        workflow = await self.get_workflow(workflow_id)
        if workflow.unpublish_requested_at is None:
            raise ValidationError("No pending unpublish request for this workflow")
        if not allow_admin and workflow.unpublish_requested_by != actor_id:
            raise ValidationError("Only the requester or an admin can cancel this request")
        workflow = await self._curator.clear_unpublish_request(workflow_id)
        await self._audit.log(
            "curator.unpublish_request_cancelled",
            WORKFLOW_RESOURCE_TYPE,
            resource_id=str(workflow_id),
            actor_id=actor_id,
            diff={},
        )
        return workflow

    async def reject_unpublish_request(
        self,
        workflow_id: uuid.UUID,
        *,
        actor_id: uuid.UUID,
        notes: str | None = None,
    ) -> CuratorWorkflow:
        """Admin rejects a pending unpublish request without changing state."""
        workflow = await self.get_workflow(workflow_id)
        if workflow.unpublish_requested_at is None:
            raise ValidationError("No pending unpublish request for this workflow")
        workflow = await self._curator.clear_unpublish_request(workflow_id)
        diff: dict[str, Any] = {}
        if notes and notes.strip():
            diff["notes"] = notes.strip()
        await self._audit.log(
            "curator.unpublish_request_rejected",
            WORKFLOW_RESOURCE_TYPE,
            resource_id=str(workflow_id),
            actor_id=actor_id,
            diff=diff,
        )
        return workflow

    async def deprecate(
        self,
        workflow_id: uuid.UUID,
        *,
        actor_id: uuid.UUID | None = None,
        notes: str | None = None,
    ) -> CuratorWorkflow:
        """Soft-delete a published workflow (published → deprecated) and hide from public graph reads."""
        workflow = await self.get_workflow(workflow_id)
        if workflow.state != "published":
            raise ValidationError(f"Cannot deprecate from state: {workflow.state}")
        workflow = await self._transition(
            workflow_id,
            "deprecated",
            action="curator.deprecated",
            actor_id=actor_id,
            notes=notes,
        )
        workflow = await self._patch_package_status(workflow, "deprecated", deprecated=True)
        workflow = await self._curator.clear_unpublish_request(workflow.id)
        await self._sync_graph_status(workflow, status="deprecated", deprecated=True)
        return workflow

    async def _patch_package_status(
        self,
        workflow: CuratorWorkflow,
        status: str,
        *,
        deprecated: bool | None = None,
    ) -> CuratorWorkflow:
        package = workflow.draft_package_json
        if not isinstance(package, dict):
            return workflow
        payload = dict(package)
        entity = dict(payload.get("entity_payload") or {})
        entity["status"] = status
        if deprecated is not None:
            entity["deprecated"] = deprecated
        versioning = entity.get("versioning")
        if isinstance(versioning, dict):
            versioning = dict(versioning)
            versioning["status"] = status
            entity["versioning"] = versioning
        payload["entity_payload"] = entity
        return await self._curator.save_draft_package(workflow.id, payload)

    async def _sync_graph_status(
        self,
        workflow: CuratorWorkflow,
        *,
        status: str,
        deprecated: bool,
    ) -> None:
        if not self._writer.is_available:
            return
        label = workflow.entity_type or "BiomedicalEntity"
        try:
            await self._writer.merge_entity(
                label,
                {
                    "id": workflow.entity_id,
                    "status": status,
                    "deprecated": deprecated,
                },
            )
        except Exception:
            # Graph sync is best-effort; workflow transition already committed.
            return

    async def publish(
        self,
        workflow_id: uuid.UUID,
        entity_payload: dict[str, Any],
        *,
        actor_id: uuid.UUID | None = None,
        dataset_version: str = "2026.1.0",
        related_entities: list[dict[str, Any]] | None = None,
        relationships: list[dict[str, Any]] | None = None,
        education: list[dict[str, Any]] | None = None,
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

        package = normalize_education_graph(
            {
                "entity_payload": entity_payload,
                "related_entities": related_entities or [],
                "relationships": relationships or [],
                "education": education or [],
                "dataset_version": dataset_version,
                "module": module,
                "create_snapshot": create_snapshot,
            }
        )
        package = normalize_drug_relationship_graph(package)
        entity_payload = package["entity_payload"]
        related_entities = package["related_entities"]
        relationships = package["relationships"]
        education = package["education"]

        require_valid_publish_package(
            entity_payload,
            related_entities=related_entities,
            relationships=relationships,
            education=education,
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
            await self._audit.log(
                "curator.snapshot_created",
                WORKFLOW_RESOURCE_TYPE,
                resource_id=str(workflow_id),
                actor_id=actor_id,
                diff={"version_tag": dataset_version, "module": module},
            )

        event = self._bus.build_event(
            "DrugPublished" if label == "Drug" else "KnowledgeValidated",
            label,
            workflow.entity_id,
            {"dataset_version": dataset_version, "module": module},
        )
        await self._bus.publish(event)
        return updated

    async def build_publish_result_async(
        self,
        workflow: CuratorWorkflow,
        package: dict[str, Any],
    ) -> dict[str, Any]:
        entity_payload = package.get("entity_payload", package)
        version_tag = package.get("dataset_version") or entity_payload.get("dataset_version")
        pkg_for_snapshot = {**package, "dataset_version": version_tag}
        snapshot_ref = await self._resolve_workflow_snapshot(workflow, pkg_for_snapshot)
        graph_available = self._writer.is_available
        return {
            "published_slug": entity_payload.get("slug"),
            "dataset_version": version_tag,
            "published_at": workflow.updated_at,
            "graph_write": {
                "available": graph_available,
                "status": "success" if graph_available else "skipped",
            },
            "snapshot": snapshot_ref,
            "validation_summary": {"valid": True, "publish_ready": True},
        }

    async def get_queue(self, state: str = "review", *, limit: int = 50) -> list[CuratorWorkflow]:
        return await self._curator.list_by_state(state, limit=limit)

    async def get_unpublish_requests(self, *, limit: int = 50) -> list[CuratorWorkflow]:
        return await self._curator.list_unpublish_requests(limit=limit)

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
            WORKFLOW_RESOURCE_TYPE,
            resource_id=str(workflow_id),
            actor_id=actor_id,
            diff={"to_state": to_state},
        )
        return workflow

    async def log_validation_run(
        self,
        workflow_id: uuid.UUID,
        validation: dict[str, Any],
        *,
        actor_id: uuid.UUID | None = None,
    ) -> None:
        await self._audit.log(
            "curator.validated",
            WORKFLOW_RESOURCE_TYPE,
            resource_id=str(workflow_id),
            actor_id=actor_id,
            diff={
                "valid": validation.get("valid"),
                "error_count": validation.get("error_count", 0),
                "warning_count": validation.get("warning_count", 0),
            },
        )

    async def log_publish_failure(
        self,
        workflow_id: uuid.UUID,
        message: str,
        *,
        actor_id: uuid.UUID | None = None,
    ) -> None:
        await self._audit.log(
            "curator.publish_failed",
            WORKFLOW_RESOURCE_TYPE,
            resource_id=str(workflow_id),
            actor_id=actor_id,
            diff={"message": message},
        )

    async def get_workflow_timeline(
        self,
        workflow_id: uuid.UUID,
        *,
        limit: int = 50,
        offset: int = 0,
    ) -> list[dict[str, Any]]:
        await self.get_workflow(workflow_id)
        entries = await self._audit.list_for_resource(
            WORKFLOW_RESOURCE_TYPE,
            str(workflow_id),
            limit=limit,
            offset=offset,
            ascending=True,
        )
        return [_timeline_entry(entry) for entry in entries]

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
        seen_slugs: set[str] = set()
        include_curriculum = module in ("cardiovascular", "all", "")

        if include_curriculum:
            for category in curriculum.get("categories", []):
                for drug in category.get("drugs", []):
                    slug = drug["slug"]
                    seen_slugs.add(slug)
                    if (
                        needle
                        and needle not in slug.lower()
                        and needle not in slug.replace("-", " ").lower()
                    ):
                        continue

                    entity_id = drug_entity_id(slug)
                    workflow = workflow_by_entity.get(entity_id)
                    graph_drug = (
                        await self._graph.get_drug_by_slug(slug)
                        if self._graph.is_available
                        else None
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
                            "module": "cardiovascular",
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

        runtime_module = None if module in ("all", "") else module
        class_labels = {
            row["slug"]: row["label"] for row in list_drug_classes(module=runtime_module)
        }
        # When filtering one module, class_labels is scoped; for "all" load every class label.
        if runtime_module is None:
            class_labels = {row["slug"]: row["label"] for row in list_drug_classes()}

        for drug in list_runtime_drug_entries(module=runtime_module):
            slug = drug["slug"]
            if slug in seen_slugs:
                continue
            label = drug.get("label") or slug.replace("-", " ").title()
            if needle and needle not in slug.lower() and needle not in label.lower():
                continue

            entity_id = drug["id"]
            workflow = workflow_by_entity.get(entity_id)
            graph_drug = (
                await self._graph.get_drug_by_slug(slug) if self._graph.is_available else None
            )
            publication_status = "published" if graph_drug else drug.get("status", "draft")
            if status and publication_status != status:
                continue
            if workflow_state and (workflow is None or workflow.state != workflow_state):
                continue

            validation = self._validate_package_dict(
                workflow.draft_package_json if workflow else None
            )
            class_slug = drug.get("drug_class_slug") or drug.get("category_slug")
            items.append(
                {
                    "slug": slug,
                    "label": label,
                    "entity_id": entity_id,
                    "module": drug.get("module") or "cardiovascular",
                    "category_slug": drug.get("category_slug") or class_slug,
                    "category_name": class_labels.get(class_slug, class_slug),
                    "curriculum_status": drug.get("status", "draft"),
                    "publication_status": publication_status,
                    "workflow_id": str(workflow.id) if workflow else None,
                    "workflow_state": workflow.state if workflow else None,
                    "validation_valid": validation["valid"],
                    "validation_errors": validation["error_count"],
                    "confidence_score": graph_drug.get("confidence_score") if graph_drug else None,
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

    async def list_drug_classes_browser(self, *, module: str | None = None) -> list[dict[str, Any]]:
        return list_drug_classes(module=module or None)

    async def create_drug(
        self,
        *,
        slug: str,
        label: str,
        drug_class_slug: str,
        module: str = "cardiovascular",
        description: str | None = None,
        actor_id: uuid.UUID | None = None,
    ) -> tuple[dict[str, Any], CuratorWorkflow, dict[str, Any]]:
        try:
            entity = register_drug(
                slug=slug,
                label=label,
                drug_class_slug=drug_class_slug,
                module=module,
                description=description,
            )
            package = build_drug_package_for_class(
                slug=entity["slug"],
                label=entity["label"],
                drug_class_slug=drug_class_slug,
                module=entity["module"],
            )
        except ValueError as exc:
            raise ValidationError(str(exc)) from exc

        workflow, _existing = await self.get_or_create_workflow_for_slug(
            entity["slug"], actor_id=actor_id
        )
        workflow = await self._curator.save_draft_package(workflow.id, package)
        return entity, workflow, package

    async def list_mechanism_fragments_browser(
        self,
        *,
        search: str = "",
        limit: int = 50,
        offset: int = 0,
        sort: str = "slug",
    ) -> tuple[list[dict[str, Any]], int]:
        catalog, _ = list_mechanism_fragment_catalog(search=search, limit=10_000, offset=0)
        items = [
            {
                "slug": row["slug"],
                "label": row["label"],
                "entity_id": row["id"],
                "module": "cardiovascular",
                "publication_status": row.get("status", "published"),
                "description": row.get("description"),
            }
            for row in catalog
        ]
        reverse = sort.startswith("-")
        key_name = sort.lstrip("-")
        if key_name == "label":
            items.sort(key=lambda row: row["label"].lower(), reverse=reverse)
        else:
            items.sort(key=lambda row: row["slug"], reverse=reverse)
        total = len(items)
        return items[offset : offset + limit], total

    async def create_mechanism_fragment(
        self,
        *,
        slug: str,
        label: str,
        description: str | None = None,
    ) -> dict[str, Any]:
        try:
            return register_mechanism_fragment(
                slug=slug,
                label=label,
                description=description,
            )
        except ValueError as exc:
            raise ValidationError(str(exc)) from exc

    async def list_diseases_browser(
        self,
        *,
        search: str = "",
        status: str | None = None,
        workflow_state: str | None = None,
        limit: int = 50,
        offset: int = 0,
        sort: str = "slug",
    ) -> tuple[list[dict[str, Any]], int]:
        workflows = await self._curator.list_all_workflows()
        workflow_by_entity = {w.entity_id: w for w in workflows}
        catalog, _ = list_disease_catalog(search=search, limit=10_000, offset=0)
        items: list[dict[str, Any]] = []

        for disease in catalog:
            slug = disease["slug"]
            entity_id = disease["id"]
            workflow = workflow_by_entity.get(entity_id)
            publication_status = disease.get("status", "published")

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
                    "label": disease["label"],
                    "entity_id": entity_id,
                    "module": "cardiovascular",
                    "publication_status": publication_status,
                    "workflow_id": str(workflow.id) if workflow else None,
                    "workflow_state": workflow.state if workflow else None,
                    "validation_valid": validation["valid"],
                    "validation_errors": validation["error_count"],
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

    async def create_disease(
        self,
        *,
        slug: str,
        label: str,
        description: str | None = None,
        icd10: str | None = None,
        mesh: str | None = None,
        actor_id: uuid.UUID | None = None,
    ) -> tuple[dict[str, Any], CuratorWorkflow, dict[str, Any]]:
        """Register a disease in the runtime catalog and open a draft workflow."""
        try:
            entity = register_disease(
                slug=slug,
                label=label,
                description=description,
                icd10=icd10,
                mesh=mesh,
            )
        except ValueError as exc:
            raise ValidationError(str(exc)) from exc

        workflow, package = await self.get_or_create_workflow_for_disease_slug(
            entity["slug"], actor_id=actor_id
        )
        return entity, workflow, package

    async def get_or_create_workflow_for_disease_slug(
        self, slug: str, *, actor_id: uuid.UUID | None = None
    ) -> tuple[CuratorWorkflow, dict[str, Any]]:
        try:
            entity_id = disease_entity_id(slug)
        except ValueError as exc:
            raise NotFoundError(str(exc)) from exc
        workflow = await self._curator.get_by_entity(entity_id)
        package = await self.resolve_disease_package(slug, workflow)
        if workflow is None:
            workflow = await self.create_draft(
                entity_id, "Disease", notes=f"Disease slug: {slug}", actor_id=actor_id
            )
            workflow = await self._curator.save_draft_package(workflow.id, package)
        elif workflow.draft_package_json is None:
            workflow = await self._curator.save_draft_package(workflow.id, package)
        return workflow, package

    async def get_disease_package(self, slug: str) -> tuple[dict[str, Any], CuratorWorkflow | None]:
        try:
            entity_id = disease_entity_id(slug)
        except ValueError as exc:
            raise NotFoundError(str(exc)) from exc
        workflow = await self._curator.get_by_entity(entity_id)
        package = await self.resolve_disease_package(slug, workflow)
        return package, workflow

    async def resolve_disease_package(
        self, slug: str, workflow: CuratorWorkflow | None = None
    ) -> dict[str, Any]:
        if workflow and workflow.draft_package_json:
            return workflow.draft_package_json

        package_path = CV_DISEASES_DIR / f"{slug}.json"
        if package_path.is_file():
            return load_disease_package(package_path).model_dump()

        try:
            return build_disease_entry_package(slug)
        except ValueError as exc:
            raise NotFoundError(str(exc)) from exc

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

    async def get_drug_education(
        self, slug: str
    ) -> tuple[list[dict[str, Any]], CuratorWorkflow | None]:
        entity_id = drug_entity_id(slug)
        workflow = await self._curator.get_by_entity(entity_id)
        package = await self.resolve_package(slug, workflow)
        return education_items_for_entity(package, entity_id), workflow

    async def get_drug_flashcards(
        self, slug: str
    ) -> tuple[list[dict[str, Any]], CuratorWorkflow | None]:
        entity_id = drug_entity_id(slug)
        workflow = await self._curator.get_by_entity(entity_id)
        package = await self.resolve_package(slug, workflow)
        return flashcards_for_entity(package, entity_id), workflow

    async def get_drug_workflow_state(self, slug: str) -> dict[str, Any]:
        """Aggregate workflow, validation, actors, and snapshot for a curriculum drug slug."""
        entity_id = drug_entity_id(slug)
        return await self._get_entity_workflow_state(
            slug, entity_id, package_loader=self.resolve_package
        )

    async def get_disease_workflow_state(self, slug: str) -> dict[str, Any]:
        """Aggregate workflow, validation, actors, and snapshot for a disease slug."""
        try:
            entity_id = disease_entity_id(slug)
        except ValueError as exc:
            raise NotFoundError(str(exc)) from exc
        return await self._get_entity_workflow_state(
            slug, entity_id, package_loader=self.resolve_disease_package
        )

    async def _get_entity_workflow_state(
        self,
        slug: str,
        entity_id: str,
        *,
        package_loader,
    ) -> dict[str, Any]:
        workflow = await self._curator.get_by_entity(entity_id)
        package = await package_loader(slug, workflow)
        validation = self._validate_package_dict(package)

        audit_refs: dict[str, Any] = {}
        if workflow is not None:
            audit_refs = await self._workflow_audit_refs(workflow.id)

        created = audit_refs.get("created")
        autosaved = audit_refs.get("autosaved")
        approved = audit_refs.get("approved")

        curator_actor = None
        curator_at = None
        if autosaved is not None:
            curator_actor = autosaved.actor_id
            curator_at = autosaved.timestamp
        elif created is not None:
            curator_actor = created.actor_id
            curator_at = created.timestamp
        elif workflow is not None:
            curator_actor = workflow.assigned_to
            curator_at = workflow.created_at

        autosave_at = autosaved.timestamp if autosaved else None
        if autosave_at is None and workflow is not None and workflow.draft_package_json:
            autosave_at = workflow.updated_at

        autosave_by = autosaved.actor_id if autosaved else None

        reviewer_actor = approved.actor_id if approved else None
        reviewer_at = approved.timestamp if approved else None

        approval_status = workflow.state if workflow else None
        approved_by = approved.actor_id if approved else None
        approved_at = approved.timestamp if approved else None

        validation_at = autosave_at
        if validation_at is None and workflow is not None:
            validation_at = workflow.updated_at

        snapshot_ref = await self._resolve_workflow_snapshot(workflow, package)

        status = workflow.state if workflow else None
        transitions = allowed_transitions(status) if status else []

        return {
            "slug": slug,
            "entity_id": entity_id,
            "workflow_id": workflow.id if workflow else None,
            "status": status,
            "curator": {"actor_id": curator_actor, "at": curator_at},
            "reviewer": {"actor_id": reviewer_actor, "at": reviewer_at},
            "approval": {
                "status": approval_status,
                "approved_by": approved_by,
                "approved_at": approved_at,
            },
            "last_autosave": {"at": autosave_at, "by": autosave_by},
            "last_validation": {
                "at": validation_at,
                "valid": validation["valid"],
                "error_count": validation["error_count"],
                "warning_count": validation["warning_count"],
                "publish_ready": validation.get("publish_ready", False),
                "issues": validation.get("issues", []),
            },
            "publish_ready": validation.get("publish_ready", False),
            "allowed_transitions": transitions,
            "snapshot": snapshot_ref,
            "package": package,
        }

    async def _workflow_audit_refs(self, workflow_id: uuid.UUID) -> dict[str, Any]:
        logs = await self._audit.list_for_resource(
            WORKFLOW_RESOURCE_TYPE, str(workflow_id), limit=100
        )
        by_action: dict[str, list[Any]] = {}
        for log in logs:
            by_action.setdefault(log.action, []).append(log)

        def latest(action: str):
            entries = by_action.get(action, [])
            return entries[-1] if entries else None

        def first(action: str):
            entries = by_action.get(action, [])
            return entries[0] if entries else None

        return {
            "created": first("curator.draft_created"),
            "autosaved": latest("curator.draft_saved"),
            "submitted": latest("curator.submitted"),
            "approved": latest("curator.approved"),
            "published": latest("curator.published"),
        }

    async def _resolve_workflow_snapshot(
        self, workflow: CuratorWorkflow | None, package: dict[str, Any]
    ) -> dict[str, Any] | None:
        if workflow is None or workflow.state not in ("published", "deprecated"):
            return None
        version_tag = package.get("dataset_version")
        if not version_tag:
            return None
        snapshot = await self._snapshots.get_by_version(version_tag)
        if snapshot is None:
            return None
        return {
            "id": snapshot.id,
            "version_tag": snapshot.version_tag,
            "status": snapshot.status,
            "module": snapshot.module,
            "released_at": snapshot.released_at,
            "entity_count": snapshot.entity_count,
            "relationship_count": snapshot.relationship_count,
        }

    async def resolve_package(
        self, slug: str, workflow: CuratorWorkflow | None = None
    ) -> dict[str, Any]:
        if workflow and workflow.draft_package_json:
            return workflow.draft_package_json

        package_path = CV_DRUGS_DIR / f"{slug}.json"
        if package_path.is_file():
            return load_package(package_path).model_dump()

        runtime = find_runtime_drug(slug)
        if runtime is not None:
            return build_drug_package_for_class(
                slug=runtime["slug"],
                label=runtime.get("label") or runtime["slug"],
                drug_class_slug=runtime["drug_class_slug"],
                module=runtime.get("module") or "cardiovascular",
            )

        try:
            return build_drug_entry_package(slug)
        except ValueError as exc:
            raise NotFoundError(str(exc)) from exc

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
        package = normalize_education_graph(package)
        package = normalize_drug_relationship_graph(package)
        updated = await self._curator.save_draft_package(workflow_id, package)
        await self._audit.log(
            "curator.draft_saved",
            WORKFLOW_RESOURCE_TYPE,
            resource_id=str(workflow_id),
            actor_id=actor_id,
            diff={"slug": package.get("entity_payload", {}).get("slug")},
        )
        validation = self._validate_package_dict(package)
        await self._audit.log(
            "curator.validated",
            WORKFLOW_RESOURCE_TYPE,
            resource_id=str(workflow_id),
            actor_id=actor_id,
            diff={
                "valid": validation["valid"],
                "error_count": validation["error_count"],
                "warning_count": validation["warning_count"],
            },
        )
        return updated

    def validate_draft_package(self, package: dict[str, Any]) -> dict[str, Any]:
        return self._validate_package_dict(package)

    @staticmethod
    def _validate_package_dict(package: dict[str, Any] | None) -> dict[str, Any]:
        if not package:
            return {"valid": False, "error_count": 0, "warning_count": 0, "issues": []}
        package = normalize_education_graph(package)
        package = normalize_drug_relationship_graph(package)
        entity = package.get("entity_payload") or {}
        result = validate_publish_package(
            entity,
            related_entities=package.get("related_entities"),
            relationships=package.get("relationships"),
            education=package.get("education"),
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


def _timeline_entry(entry) -> dict[str, Any]:
    action = entry.action
    diff = entry.diff_json or {}
    return {
        "id": str(entry.id),
        "kind": ACTION_TIMELINE_KIND.get(action, "unknown"),
        "action": action,
        "timestamp": entry.timestamp.isoformat() if entry.timestamp else None,
        "actor_id": str(entry.actor_id) if entry.actor_id else None,
        "detail": _timeline_detail(action, diff),
        "diff": diff,
    }


def _timeline_detail(action: str, diff: dict[str, Any]) -> str | None:
    if action == "curator.draft_saved":
        slug = diff.get("slug")
        return f"Draft saved for {slug}" if slug else "Draft autosaved"
    if action == "curator.validated":
        if diff.get("valid"):
            warnings = diff.get("warning_count", 0)
            return f"Validation passed ({warnings} warnings)" if warnings else "Validation passed"
        errors = diff.get("error_count", 0)
        return f"Validation failed ({errors} errors)"
    if action == "curator.submitted":
        return "Submitted for review"
    if action == "curator.approved":
        return "Approved for publish"
    if action == "curator.returned_to_draft":
        return "Returned to draft for edits"
    if action == "curator.unpublished":
        return "Unpublished — returned to draft for admin edits"
    if action == "curator.restored":
        return "Restored from deprecated — returned to draft for admin edits"
    if action == "curator.unpublish_requested":
        reason = diff.get("notes")
        return f"Unpublish requested: {reason}" if reason else "Unpublish requested"
    if action == "curator.unpublish_request_cancelled":
        return "Unpublish request cancelled"
    if action == "curator.unpublish_request_rejected":
        reason = diff.get("notes")
        return f"Unpublish request rejected: {reason}" if reason else "Unpublish request rejected"
    if action == "curator.deprecated":
        return "Deprecated (soft-deleted from public graph)"
    if action == "curator.published":
        return "Published to knowledge graph"
    if action == "curator.publish_failed":
        return str(diff.get("message") or "Publish failed")
    if action == "curator.snapshot_created":
        version = diff.get("version_tag")
        module = diff.get("module")
        if version and module:
            return f"Snapshot {version} for {module}"
        return "Knowledge snapshot created"
    if action == "curator.draft_created":
        return "Workflow created"
    return None
