"""Biomedical validator tests — indications and broken disease links."""

from __future__ import annotations

from farmacograph.curator.disease_package import disease_entity_id
from farmacograph.models.enums import EntityStatus
from farmacograph.validators.biomedical_validator import BiomedicalValidator


def _drug_payload(**overrides) -> dict:
    payload = {
        "id": "00000000-0000-4000-8000-000000000002",
        "entity_type": "Drug",
        "slug": "ramipril",
        "label": "Ramipril",
        "relationships": {
            "IS_A": ["00000000-0000-4000-8000-000000000010"],
            "TREATS": [disease_entity_id("hypertension")],
            "HAS_MECHANISM_ROOT": ["00000000-0000-4000-8000-000000000020"],
        },
        "provenance": {"created_by": "curator", "source": "manual"},
        "versioning": {"status": EntityStatus.PUBLISHED},
    }
    payload.update(overrides)
    return payload


def test_unknown_treats_disease_fails_fg_c027():
    validator = BiomedicalValidator()
    drug = _drug_payload(
        relationships={
            "TREATS": ["00000000-0000-4000-8000-000000009999"],
        }
    )
    result = validator.validate(drug)
    assert not result.valid
    assert any(issue.constraint_id == "FG-C027" for issue in result.errors)


def test_known_treats_disease_passes_broken_link_check():
    validator = BiomedicalValidator()
    drug = _drug_payload(
        versioning={"status": EntityStatus.DRAFT},
    )
    result = validator.validate_drug_relationship_targets(drug)
    assert result.valid


def test_published_drug_without_indication_fails_fg_c009():
    validator = BiomedicalValidator()
    drug = _drug_payload(
        relationships={
            "IS_A": ["00000000-0000-4000-8000-000000000010"],
            "HAS_MECHANISM_ROOT": ["00000000-0000-4000-8000-000000000020"],
        }
    )
    result = validator.validate(drug)
    assert not result.valid
    assert any(issue.constraint_id == "FG-C009" for issue in result.errors)
