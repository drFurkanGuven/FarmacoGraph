"""Curator service — orchestrates workflow transitions and publish pipeline."""

from __future__ import annotations

import uuid
from typing import Any

from farmacograph.core.exceptions import FarmacoGraphError, NotFoundError, ValidationError
from farmacograph.curator.workflow import InvalidTransitionError
from farmacograph.db.postgres.models import CuratorWorkflow
from farmacograph.events.bus import EventBus
from farmacograph.repositories.audit import AuditRepository
from farmacograph.repositories.curator import CuratorRepository
from farmacograph.repositories.graph_writer import GraphWriter
from farmacograph.repositories.jobs import JobRepository
from farmacograph.repositories.outbox import OutboxRepository


class CuratorService:
    def __init__(
        self,
        curator_repo: CuratorRepository,
        graph_writer: GraphWriter,
        outbox_repo: OutboxRepository,
        job_repo: JobRepository,
        audit_repo: AuditRepository,
        event_bus: EventBus,
    ) -> None:
        self._curator = curator_repo
        self._writer = graph_writer
        self._outbox = outbox_repo
        self._jobs = job_repo
        self._audit = audit_repo
        self._bus = event_bus

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
        return await self._transition(workflow_id, "review", action="curator.submitted", actor_id=actor_id)

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
    ) -> CuratorWorkflow:
        """Transition approved → published and write entity to Neo4j."""
        workflow = await self._curator.get(workflow_id)
        if workflow is None:
            raise NotFoundError(f"Workflow not found: {workflow_id}")
        if workflow.state != "approved":
            raise ValidationError(f"Cannot publish from state: {workflow.state}")

        label = entity_payload.get("entity_type", workflow.entity_type)
        entity_payload.setdefault("status", "published")
        entity_payload.setdefault("dataset_version", dataset_version)

        if self._writer.is_available:
            await self._writer.merge_entity(label, entity_payload)

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
        await self._jobs.enqueue(
            "graph_validation",
            {"entity_id": workflow.entity_id, "workflow_id": str(workflow_id)},
            created_by=actor_id,
        )
        event = self._bus.build_event(
            "DrugPublished" if label == "Drug" else "KnowledgeValidated",
            label,
            workflow.entity_id,
            {"dataset_version": dataset_version},
        )
        await self._bus.publish(event)
        return updated

    async def get_queue(self, state: str = "review") -> list[CuratorWorkflow]:
        return await self._curator.list_by_state(state)

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
