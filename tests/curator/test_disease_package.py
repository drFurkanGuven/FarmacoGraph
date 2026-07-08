"""Disease package builder tests."""

from __future__ import annotations

import pytest

from farmacograph.curator.disease_package import (
    build_disease_entry_package,
    disease_entity_id,
    list_disease_catalog,
)
from farmacograph.curator.publish_validator import validate_publish_package


def test_list_disease_catalog_includes_shared_nodes():
    rows, total = list_disease_catalog()
    assert total >= 2
    assert any(row["slug"] == "hypertension" for row in rows)


def test_disease_entity_id_from_index():
    assert disease_entity_id("hypertension") == "d1000001-0000-4000-8010-000000000001"


def test_build_disease_entry_package_validates():
    package = build_disease_entry_package("hypertension")
    result = validate_publish_package(
        package["entity_payload"],
        related_entities=package["related_entities"],
        relationships=package["relationships"],
    )
    assert package["entity_payload"]["entity_type"] == "Disease"
    assert result.valid or len(result.errors) == 0


def test_unknown_disease_slug_raises():
    with pytest.raises(ValueError, match="not in nodes index"):
        build_disease_entry_package("not-a-real-disease")
