"""Mechanism fragment catalog unit tests."""

from __future__ import annotations

from pathlib import Path

import pytest

from farmacograph.curator import mechanism_catalog as catalog


@pytest.fixture(autouse=True)
def _runtime_path(tmp_path: Path, monkeypatch: pytest.MonkeyPatch):
    path = tmp_path / "mechanisms.runtime.json"
    monkeypatch.setenv("FG_MECHANISM_CATALOG_PATH", str(path))
    yield path


def test_register_mechanism_fragment_merges_into_catalog():
    entity = catalog.register_mechanism_fragment(
        slug="bradykinin-accumulation-runtime",
        label="Bradykinin accumulation (runtime)",
        description="Test fragment",
    )
    assert entity["entity_type"] == "MechanismFragment"
    assert entity["slug"] == "bradykinin-accumulation-runtime"

    rows, total = catalog.list_mechanism_fragment_catalog(search="bradykinin-accumulation-runtime")
    assert total >= 1
    assert any(row["id"] == entity["id"] for row in rows)


def test_register_mechanism_fragment_rejects_duplicate():
    catalog.register_mechanism_fragment(slug="custom-fragment", label="Custom")
    with pytest.raises(ValueError, match="already exists"):
        catalog.register_mechanism_fragment(slug="custom-fragment", label="Custom again")


def test_register_mechanism_fragment_rejects_invalid_slug():
    with pytest.raises(ValueError, match="kebab-case"):
        catalog.register_mechanism_fragment(slug="Bad!!!", label="Bad")
