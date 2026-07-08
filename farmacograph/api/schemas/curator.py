"""Curator API request/response schemas."""

from __future__ import annotations

from datetime import datetime
from uuid import UUID

from pydantic import BaseModel, Field


class CreateWorkflowRequest(BaseModel):
    entity_id: str = Field(description="Canonical entity UUID string")
    entity_type: str = Field(description="Neo4j label, e.g. Drug")
    notes: str | None = None


class PublishRequest(BaseModel):
    entity_payload: dict = Field(description="Validated entity properties for Neo4j MERGE")
    related_entities: list[dict] = Field(default_factory=list)
    relationships: list[dict] = Field(default_factory=list)
    dataset_version: str = "2026.1.0"
    module: str | None = None
    create_snapshot: bool = False


class WorkflowActorRef(BaseModel):
    actor_id: UUID | None = None
    at: datetime | None = None


class WorkflowAutosaveInfo(BaseModel):
    at: datetime | None = None
    by: UUID | None = None


class WorkflowValidationState(BaseModel):
    at: datetime | None = None
    valid: bool
    error_count: int = 0
    warning_count: int = 0
    publish_ready: bool = False
    issues: list[dict] = Field(default_factory=list)


class WorkflowApprovalState(BaseModel):
    status: str | None = None
    approved_by: UUID | None = None
    approved_at: datetime | None = None


class WorkflowSnapshotRef(BaseModel):
    id: UUID | None = None
    version_tag: str | None = None
    status: str | None = None
    module: str | None = None
    released_at: datetime | None = None
    entity_count: int | None = None
    relationship_count: int | None = None


class DrugWorkflowStateResponse(BaseModel):
    slug: str
    entity_id: str
    workflow_id: UUID | None = None
    status: str | None = None
    curator: WorkflowActorRef | None = None
    reviewer: WorkflowActorRef | None = None
    approval: WorkflowApprovalState | None = None
    last_autosave: WorkflowAutosaveInfo | None = None
    last_validation: WorkflowValidationState
    publish_ready: bool = False
    allowed_transitions: list[str] = Field(default_factory=list)
    snapshot: WorkflowSnapshotRef | None = None
    package: dict | None = None


class GraphWriteResult(BaseModel):
    available: bool
    status: str


class PublishValidationSummary(BaseModel):
    valid: bool
    publish_ready: bool = True


class PublishResultData(BaseModel):
    workflow: WorkflowResponse
    published_slug: str | None = None
    dataset_version: str | None = None
    published_at: datetime | None = None
    graph_write: GraphWriteResult
    snapshot: WorkflowSnapshotRef | None = None
    validation_summary: PublishValidationSummary


class WorkflowResponse(BaseModel):
    id: UUID
    entity_id: str
    entity_type: str
    state: str
    notes: str | None = None
    assigned_to: UUID | None = None
    workspace_id: UUID | None = None
    created_at: datetime | None = None
    updated_at: datetime | None = None
    entity_label: str | None = None
    entity_slug: str | None = None
    draft_package_json: dict | None = None

    @classmethod
    def from_model(cls, w, *, entity: dict | None = None) -> WorkflowResponse:
        return cls(
            id=w.id,
            entity_id=w.entity_id,
            entity_type=w.entity_type,
            state=w.state,
            notes=w.notes,
            assigned_to=w.assigned_to,
            workspace_id=w.workspace_id,
            created_at=w.created_at,
            updated_at=w.updated_at,
            entity_label=(entity or {}).get("label"),
            entity_slug=(entity or {}).get("slug"),
            draft_package_json=getattr(w, "draft_package_json", None),
        )
