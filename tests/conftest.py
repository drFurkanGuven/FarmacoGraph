"""Test fixtures and configuration."""

from datetime import UTC

import pytest

from farmacograph.models.enums import ContentLayer, EntityStatus, ValidationState
from farmacograph.models.provenance import ProvenanceMetadata, VersioningMetadata


@pytest.fixture
def sample_provenance() -> ProvenanceMetadata:
    from datetime import datetime

    now = datetime.now(UTC)
    return ProvenanceMetadata(
        created_at=now,
        updated_at=now,
        created_by="curator-test",
        source="manual",
    )


@pytest.fixture
def sample_versioning() -> VersioningMetadata:
    from datetime import date

    return VersioningMetadata(
        dataset_version="2026.1.0",
        valid_from=date(2026, 1, 1),
        status=EntityStatus.DRAFT,
        validation_state=ValidationState.PENDING,
        approval_status=EntityStatus.DRAFT,
    )


@pytest.fixture
def structural_drug_payload(sample_provenance, sample_versioning) -> dict:
    """Structural stub only — no real pharmacology data."""
    return {
        "id": "00000000-0000-4000-8000-000000000001",
        "entity_type": "Drug",
        "slug": "structural-stub-drug",
        "label": "Structural Stub Drug",
        "generic_name": "Structural Stub Drug",
        "content_layer": ContentLayer.BIOMEDICAL,
        "provenance": sample_provenance.model_dump(mode="json"),
        "versioning": sample_versioning.model_dump(mode="json"),
        "external_ids": {},
        "relationships": {},
    }
