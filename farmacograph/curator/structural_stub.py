"""Structural stub payloads for Phase 4.4 — no real pharmacology content."""

from __future__ import annotations

from datetime import UTC, date, datetime
from typing import Any

# Fixed UUIDs for reproducible structural stubs (not real drug IDs)
CV_STUB_DRUG_ID = "00000000-0000-4000-8000-000000000001"
CV_STUB_CLASS_ID = "00000000-0000-4000-8000-000000000002"
CV_STUB_DISEASE_ID = "00000000-0000-4000-8000-000000000003"
CV_STUB_MECHANISM_ID = "00000000-0000-4000-8000-000000000004"

_NOW = datetime(2026, 1, 1, tzinfo=UTC)
_TODAY = date(2026, 1, 1)


def _base_entity(
    entity_id: str,
    entity_type: str,
    slug: str,
    label: str,
    *,
    dataset_version: str = "2026.1.0",
) -> dict[str, Any]:
    return {
        "id": entity_id,
        "entity_type": entity_type,
        "slug": slug,
        "label": label,
        "status": "published",
        "dataset_version": dataset_version,
        "provenance": {
            "created_at": _NOW.isoformat(),
            "updated_at": _NOW.isoformat(),
            "created_by": "curator-system",
            "source": "manual",
        },
        "versioning": {
            "dataset_version": dataset_version,
            "ontology_version": "1.0.0",
            "valid_from": _TODAY.isoformat(),
            "status": "published",
        },
    }


def build_cardiovascular_publish_package(
    dataset_version: str = "2026.1.0",
) -> dict[str, Any]:
    """Minimum valid publish package for cardiovascular module bootstrap."""
    drug = _base_entity(
        CV_STUB_DRUG_ID,
        "Drug",
        "cv-structural-stub",
        "Cardiovascular Structural Stub",
        dataset_version=dataset_version,
    )
    drug["generic_name"] = "Cardiovascular Structural Stub"
    drug["module"] = "cardiovascular"
    drug["relationships"] = {
        "BELONGS_TO": [CV_STUB_CLASS_ID],
        "TREATS": [CV_STUB_DISEASE_ID],
        "HAS_MECHANISM_ROOT": [CV_STUB_MECHANISM_ID],
    }

    related = [
        {
            **_base_entity(
                CV_STUB_CLASS_ID,
                "DrugClass",
                "cv-stub-class",
                "Structural Drug Class Stub",
                dataset_version=dataset_version,
            ),
            "organ_system": "cardiovascular",
        },
        _base_entity(
            CV_STUB_DISEASE_ID,
            "Disease",
            "cv-stub-indication",
            "Structural Indication Stub",
            dataset_version=dataset_version,
        ),
        _base_entity(
            CV_STUB_MECHANISM_ID,
            "MechanismFragment",
            "cv-stub-mechanism-root",
            "Structural Mechanism Root Stub",
            dataset_version=dataset_version,
        ),
    ]

    relationships = [
        {
            "relationship_type": "BELONGS_TO",
            "source_type": "Drug",
            "target_type": "DrugClass",
            "source_id": CV_STUB_DRUG_ID,
            "target_id": CV_STUB_CLASS_ID,
        },
        {
            "relationship_type": "TREATS",
            "source_type": "Drug",
            "target_type": "Disease",
            "source_id": CV_STUB_DRUG_ID,
            "target_id": CV_STUB_DISEASE_ID,
        },
        {
            "relationship_type": "HAS_MECHANISM_ROOT",
            "source_type": "Drug",
            "target_type": "MechanismFragment",
            "source_id": CV_STUB_DRUG_ID,
            "target_id": CV_STUB_MECHANISM_ID,
        },
    ]

    return {
        "entity_payload": drug,
        "related_entities": related,
        "relationships": relationships,
        "dataset_version": dataset_version,
        "module": "cardiovascular",
        "create_snapshot": True,
    }
