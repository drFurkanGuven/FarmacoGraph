"""Runtime drug catalog tests."""

from __future__ import annotations

from pathlib import Path

import pytest

from farmacograph.curator import drug_runtime as catalog
from farmacograph.curator.drug_package import drug_entity_id


@pytest.fixture(autouse=True)
def _runtime_path(tmp_path: Path, monkeypatch: pytest.MonkeyPatch):
    path = tmp_path / "drugs.runtime.json"
    monkeypatch.setenv("FG_DRUG_CATALOG_PATH", str(path))
    yield path


def test_list_drug_classes_includes_ace_inhibitors():
    rows = catalog.list_drug_classes()
    assert any(row["slug"] == "ace-inhibitors" for row in rows)


def test_register_drug_builds_belongs_to_package():
    entity = catalog.register_drug(
        slug="Trandolapril",
        label="Trandolapril",
        drug_class_slug="ace-inhibitors",
    )
    assert entity["slug"] == "trandolapril"
    assert entity["id"] == drug_entity_id("trandolapril")
    assert entity["drug_class_slug"] == "ace-inhibitors"

    package = catalog.build_drug_package_for_class(
        slug="trandolapril",
        label="Trandolapril",
        drug_class_slug="ace-inhibitors",
    )
    assert package["entity_payload"]["label"] == "Trandolapril"
    assert package["entity_payload"]["relationships"]["BELONGS_TO"]
    assert any(row["relationship_type"] == "BELONGS_TO" for row in package["relationships"])


def test_register_drug_rejects_curriculum_duplicate():
    with pytest.raises(ValueError, match="curriculum"):
        catalog.register_drug(
            slug="ramipril",
            label="Ramipril",
            drug_class_slug="ace-inhibitors",
        )
