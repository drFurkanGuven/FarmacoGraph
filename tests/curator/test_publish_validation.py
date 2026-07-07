"""Publish validation tests."""

from __future__ import annotations

import pytest

from farmacograph.curator.publish_validator import require_valid_publish_package, validate_publish_package
from farmacograph.curator.structural_stub import build_cardiovascular_publish_package
from farmacograph.core.exceptions import ValidationError


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
