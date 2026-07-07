"""Education validator tests."""

from farmacograph.models.enums import ContentLayer
from farmacograph.validators.education_validator import EducationValidator


def test_education_requires_content_layer() -> None:
    validator = EducationValidator()
    result = validator.validate_education_entity({
        "id": "test-id",
        "content_layer": "biomedical",
        "outgoing_relationships": [],
    })
    assert not result.valid
    assert any(i.constraint_id == "FG-C029" for i in result.issues)


def test_education_forbidden_clinical_edge() -> None:
    validator = EducationValidator()
    result = validator.validate_education_entity({
        "id": "test-id",
        "content_layer": ContentLayer.EDUCATION,
        "outgoing_relationships": [{"type": "TREATS", "direction": "outgoing"}],
    })
    assert not result.valid
    assert any(i.constraint_id == "FG-C013" for i in result.issues)
