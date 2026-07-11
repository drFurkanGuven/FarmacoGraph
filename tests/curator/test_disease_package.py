"""Disease package builder tests."""

from __future__ import annotations

from pathlib import Path

import pytest

from farmacograph.curator.disease_package import (
    allocate_disease_entity_id,
    build_disease_entry_package,
    disease_entity_id,
    list_disease_catalog,
    register_disease,
)
from farmacograph.curator.publish_validator import validate_publish_package


@pytest.fixture(autouse=True)
def _runtime_catalog(tmp_path: Path, monkeypatch: pytest.MonkeyPatch):
    monkeypatch.setenv("FG_DISEASE_CATALOG_PATH", str(tmp_path / "diseases.runtime.json"))


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


def test_register_disease_merges_into_catalog():
    entity = register_disease(
        slug="Myocarditis",
        label="Myocarditis",
        description="Inflammation of the myocardium.",
        icd10="I40",
    )
    assert entity["slug"] == "myocarditis"
    assert entity["id"] == allocate_disease_entity_id("myocarditis")
    rows, _ = list_disease_catalog(search="myocarditis")
    assert any(row["slug"] == "myocarditis" for row in rows)
    package = build_disease_entry_package("myocarditis")
    assert package["entity_payload"]["id"] == entity["id"]
    assert package["entity_payload"]["external_ids"]["icd10"] == "I40"


def test_register_disease_rejects_duplicate():
    register_disease(slug="pericarditis", label="Pericarditis")
    with pytest.raises(ValueError, match="already exists"):
        register_disease(slug="pericarditis", label="Pericarditis again")


def test_register_disease_rejects_unwritable_catalog(
    tmp_path: Path, monkeypatch: pytest.MonkeyPatch
):
    readonly_dir = tmp_path / "readonly"
    readonly_dir.mkdir()
    readonly_dir.chmod(0o555)
    monkeypatch.setenv("FG_DISEASE_CATALOG_PATH", str(readonly_dir / "diseases.runtime.json"))
    try:
        with pytest.raises(ValueError, match="Cannot write disease runtime catalog"):
            register_disease(slug="readonly-fail", label="Readonly fail")
    finally:
        readonly_dir.chmod(0o755)
