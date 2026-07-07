"""Provenance and versioning metadata for all biomedical entities."""

from __future__ import annotations

from datetime import date, datetime
from uuid import UUID

from pydantic import BaseModel, Field

from farmacograph.models.enums import EntityStatus, ValidationState, VerificationMethod


class ProvenanceMetadata(BaseModel):
    """Every biomedical fact must have provenance. Nothing exists without it."""

    created_at: datetime
    updated_at: datetime
    created_by: str = Field(description="Curator or system user ID from PostgreSQL")
    reviewed_by: str | None = None
    approved_by: str | None = None
    source: str = Field(description="manual | drugbank | fda_label | pubmed | ai_assisted_draft | ...")
    generated_from: str | None = Field(default=None, description="Pipeline or import job ID")
    imported_from: str | None = Field(default=None, description="External source identifier")
    last_verified: datetime | None = None
    verification_method: VerificationMethod | None = None
    curator_attestation: bool = False


class VersioningMetadata(BaseModel):
    """Temporal and release versioning for entities and relationships."""

    dataset_version: str = Field(description="CalVer release tag, e.g. 2026.1.0")
    ontology_version: str = Field(default="1.0.0")
    valid_from: date
    valid_to: date | None = None
    deprecated: bool = False
    superseded_by: UUID | None = None
    status: EntityStatus = EntityStatus.DRAFT
    validation_state: ValidationState = ValidationState.PENDING
    approval_status: EntityStatus = EntityStatus.DRAFT
    last_verification: datetime | None = None


class ExternalIdentifiers(BaseModel):
    """Open-standard external ID registry."""

    rxnorm: str | None = None
    atc: list[str] = Field(default_factory=list)
    icd10: str | None = None
    loinc: str | None = None
    mesh: str | None = None
    pubchem: str | None = None
    uniprot: str | None = None
    kegg: str | None = None
    reactome: str | None = None
    drugbank: str | None = None
    snomed: str | None = None
    meddra: str | None = None
