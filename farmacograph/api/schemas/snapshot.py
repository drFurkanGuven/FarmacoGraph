"""Snapshot API response schemas."""

from __future__ import annotations

from datetime import datetime
from uuid import UUID

from pydantic import BaseModel, Field


class SnapshotItem(BaseModel):
    id: UUID
    version_tag: str
    module: str | None = None
    status: str
    ontology_version: str
    api_version: str
    entity_count: int = 0
    relationship_count: int = 0
    evidence_count: int = 0
    manifest: dict = Field(default_factory=dict)
    released_at: datetime | None = None
    released_by: UUID | None = None
    created_at: datetime | None = None
    updated_at: datetime | None = None
