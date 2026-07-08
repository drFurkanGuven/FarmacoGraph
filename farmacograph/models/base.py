"""Base entity models — all biomedical entities inherit from BiomedicalEntity."""

from __future__ import annotations

from datetime import datetime
from typing import Any
from uuid import UUID, uuid4

from pydantic import BaseModel, Field

from farmacograph.models.enums import ContentLayer, EntityType
from farmacograph.models.provenance import (
    ExternalIdentifiers,
    ProvenanceMetadata,
    VersioningMetadata,
)


class BiomedicalEntity(BaseModel):
    """Root type for all versioned, provenance-tracked knowledge objects."""

    id: UUID = Field(default_factory=uuid4)
    entity_type: EntityType
    slug: str = Field(pattern=r"^[a-z0-9]+(?:-[a-z0-9]+)*$")
    label: str
    synonyms: list[str] = Field(default_factory=list)
    description: str | None = None
    external_ids: ExternalIdentifiers = Field(default_factory=ExternalIdentifiers)
    provenance: ProvenanceMetadata
    versioning: VersioningMetadata
    content_layer: ContentLayer = ContentLayer.BIOMEDICAL
    metadata: dict[str, Any] = Field(default_factory=dict)

    model_config = {"frozen": False}


class EducationResource(BiomedicalEntity):
    """Pedagogical content — never a source of biomedical truth."""

    entity_type: EntityType = EntityType.EDUCATION_RESOURCE
    content_layer: ContentLayer = ContentLayer.EDUCATION
    audience: list[str] = Field(default_factory=list)
    difficulty_level: str | None = None
    language: str = "en"
    linked_entity_ids: list[UUID] = Field(default_factory=list)
    reviewed_at: datetime | None = None
    module: str | None = None
