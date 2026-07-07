"""Ontology validator tests."""

from farmacograph.validators.ontology_validator import OntologyValidator


def test_forbidden_drug_targets_disease() -> None:
    validator = OntologyValidator()
    result = validator.validate_relationship("TARGETS", "Drug", "Disease")
    assert not result.valid
    assert any(i.constraint_id == "FG-C001" for i in result.issues)


def test_allowed_drug_treats_disease() -> None:
    validator = OntologyValidator()
    result = validator.validate_relationship("TREATS", "Drug", "Disease")
    assert result.valid


def test_self_interaction_forbidden() -> None:
    validator = OntologyValidator()
    result = validator.validate_relationship(
        "INTERACTS_WITH", "Drug", "Drug", same_node=True
    )
    assert not result.valid
    assert any(i.constraint_id == "FG-C005" for i in result.issues)
