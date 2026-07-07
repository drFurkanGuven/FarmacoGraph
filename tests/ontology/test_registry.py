"""Ontology registry tests."""

from farmacograph.ontology import load_ontology_registry


def test_load_ontology_registry() -> None:
    registry = load_ontology_registry()
    assert registry.version == "1.0.0"
    assert len(registry.relationships) >= 30
    assert len(registry.constraints) >= 25


def test_targets_disease_forbidden() -> None:
    registry = load_ontology_registry()
    assert not registry.is_allowed("TARGETS", "Drug", "Disease")


def test_treats_disease_allowed() -> None:
    registry = load_ontology_registry()
    assert registry.is_allowed("TREATS", "Drug", "Disease")


def test_constraint_fg_c001_exists() -> None:
    registry = load_ontology_registry()
    constraint = registry.get_constraint("FG-C001")
    assert constraint is not None
    assert constraint.severity == "error"
