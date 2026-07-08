"""Evidence API request schemas."""

from __future__ import annotations

from uuid import UUID

from pydantic import BaseModel, Field

from farmacograph.models.enums import EvidenceType


class CreateEvidenceRequest(BaseModel):
    title: str = Field(min_length=1, max_length=500)
    evidence_type: EvidenceType
    slug: str | None = Field(default=None, pattern=r"^[a-z0-9]+(?:-[a-z0-9]+)*$")
    quality_score: float = Field(default=0.5, ge=0.0, le=1.0)
    extract: str | None = None
    supports_claim: str | None = None
    journal: str | None = None
    year: int | None = Field(default=None, ge=1800, le=2100)
    authors: list[str] = Field(default_factory=list)
    dataset_version: str | None = None


class UpdateEvidenceRequest(BaseModel):
    title: str | None = Field(default=None, min_length=1, max_length=500)
    evidence_type: EvidenceType | None = None
    slug: str | None = Field(default=None, pattern=r"^[a-z0-9]+(?:-[a-z0-9]+)*$")
    quality_score: float | None = Field(default=None, ge=0.0, le=1.0)
    extract: str | None = None
    supports_claim: str | None = None
    journal: str | None = None
    year: int | None = Field(default=None, ge=1800, le=2100)
    authors: list[str] | None = None
    dataset_version: str | None = None


class AttachAssertionRequest(BaseModel):
    """Attach evidence to a specific clinical assertion (relationship edge)."""

    source_id: UUID
    source_type: str = Field(description="Neo4j label, e.g. Drug")
    relationship_type: str = Field(description="Clinical relationship type, e.g. TREATS")
    target_id: UUID
    target_type: str = Field(description="Neo4j label, e.g. Disease")


class AttachDrugEvidenceRequest(BaseModel):
    evidence_id: UUID
