"""Publish validation tests."""

from __future__ import annotations

import pytest

from farmacograph.core.exceptions import ValidationError
from farmacograph.curator.publish_validator import (
    require_valid_publish_package,
    validate_publish_package,
)
from farmacograph.curator.structural_stub import build_cardiovascular_publish_package


def test_structural_stub_passes_validation():
    package = build_cardiovascular_publish_package()
    result = validate_publish_package(
        package["entity_payload"],
        related_entities=package["related_entities"],
        relationships=package["relationships"],
    )
    assert result.valid is True
    assert not result.errors


def test_minimal_drug_fails_biomedical_validation():
    result = validate_publish_package(
        {
            "id": "00000000-0000-4000-8000-000000009999",
            "entity_type": "Drug",
            "slug": "invalid-stub",
            "label": "Invalid",
            "generic_name": "Invalid",
            "status": "published",
        }
    )
    assert result.valid is False
    assert any(i.constraint_id == "FG-C008" for i in result.errors)


def test_require_valid_raises():
    with pytest.raises(ValidationError, match="Publish validation failed"):
        require_valid_publish_package({"entity_type": "Drug", "status": "published"})


def test_education_items_are_validated_in_publish_gate():
    package = build_cardiovascular_publish_package()
    result = validate_publish_package(
        package["entity_payload"],
        related_entities=package["related_entities"],
        relationships=package["relationships"],
        education=[
            {
                "id": "education-1",
                "entity_type": "EducationResource",
                "content_layer": "biomedical",
                "outgoing_relationships": [],
            }
        ],
    )

    assert result.valid is False
    assert any(i.constraint_id == "FG-C029" for i in result.errors)


def test_education_kind_specific_required_fields_are_validated():
    package = build_cardiovascular_publish_package()
    result = validate_publish_package(
        package["entity_payload"],
        related_entities=package["related_entities"],
        relationships=package["relationships"],
        education=[
            {
                "id": "education-1",
                "entity_type": "EducationResource",
                "kind": "Flashcard",
                "content_layer": "education",
                "front": "What is the key recall point?",
                "back": "",
                "outgoing_relationships": [],
            }
        ],
    )

    assert result.valid is False
    assert any(i.constraint_id == "FG-C031" and i.field == "back" for i in result.errors)


def test_unknown_education_kind_fails_validation():
    package = build_cardiovascular_publish_package()
    result = validate_publish_package(
        package["entity_payload"],
        related_entities=package["related_entities"],
        relationships=package["relationships"],
        education=[
            {
                "id": "education-1",
                "entity_type": "EducationResource",
                "kind": "ClinicalAssertion",
                "content_layer": "education",
                "text": "Wrong layer.",
                "outgoing_relationships": [],
            }
        ],
    )

    assert result.valid is False
    assert any(i.constraint_id == "FG-C030" for i in result.errors)
