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
