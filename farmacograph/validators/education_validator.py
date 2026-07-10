"""Educational layer validation."""

from __future__ import annotations

from farmacograph.models.enums import ContentLayer
from farmacograph.validators.base import (
    BaseValidator,
    ValidationIssue,
    ValidationLevel,
    ValidationResult,
    ValidationSeverity,
)

CLINICAL_RELATIONSHIP_TYPES = {
    "TREATS",
    "CAUSES",
    "INHIBITS",
    "TARGETS",
    "INTERACTS_WITH",
    "CONTRAINDICATED_IN",
    "METABOLIZED_BY",
    "COVERS",
    "FIRST_LINE_FOR",
}

KIND_REQUIRED_FIELDS = {
    "FiveSecondSummary": ("text",),
    "BoardExamPearl": ("text",),
    "Mnemonic": ("mnemonic", "expansion"),
    "CommonMistake": ("mistake", "correction"),
    "Flashcard": ("front", "back"),
}


class EducationValidator(BaseValidator):
    level = ValidationLevel.EDUCATIONAL
    name = "education_validator"

    def validate_education_entity(self, entity: dict) -> ValidationResult:
        issues: list[ValidationIssue] = []

        if entity.get("content_layer") != ContentLayer.EDUCATION:
            issues.append(
                ValidationIssue(
                    constraint_id="FG-C029",
                    level=self.level,
                    severity=ValidationSeverity.ERROR,
                    message="Education entities must have content_layer=education",
                    entity_id=str(entity.get("id")),
                )
            )

        kind = entity.get("kind")
        if kind not in KIND_REQUIRED_FIELDS:
            issues.append(
                ValidationIssue(
                    constraint_id="FG-C030",
                    level=self.level,
                    severity=ValidationSeverity.ERROR,
                    message="Education entities must use a supported kind",
                    entity_id=str(entity.get("id")),
                )
            )
        else:
            for field in KIND_REQUIRED_FIELDS[kind]:
                if not _has_text(entity.get(field)):
                    issues.append(
                        ValidationIssue(
                            constraint_id="FG-C031",
                            level=self.level,
                            severity=ValidationSeverity.ERROR,
                            message=f"{kind} education requires non-empty `{field}`",
                            entity_id=str(entity.get("id")),
                            field=field,
                        )
                    )

        outgoing = entity.get("outgoing_relationships", [])
        for rel in outgoing:
            if rel.get("type") in CLINICAL_RELATIONSHIP_TYPES:
                issues.append(
                    ValidationIssue(
                        constraint_id="FG-C013",
                        level=self.level,
                        severity=ValidationSeverity.ERROR,
                        message=f"Education node cannot have clinical relationship: {rel.get('type')}",
                        entity_id=str(entity.get("id")),
                        relationship_type=rel.get("type"),
                    )
                )

        allowed_outgoing = {"ILLUSTRATES", "COMPARES", "HAS_EDUCATION"}
        for rel in outgoing:
            if rel.get("type") not in allowed_outgoing and rel.get("direction") == "outgoing":
                issues.append(
                    ValidationIssue(
                        constraint_id="FG-C014",
                        level=self.level,
                        severity=ValidationSeverity.ERROR,
                        message=f"Education node forbidden outgoing relationship: {rel.get('type')}",
                        entity_id=str(entity.get("id")),
                    )
                )

        return ValidationResult(valid=len(issues) == 0, issues=issues)

    def validate(self, data: object) -> ValidationResult:
        if isinstance(data, dict) and (
            data.get("content_layer") == ContentLayer.EDUCATION
            or data.get("entity_type") == "EducationResource"
            or data.get("kind")
        ):
            return self.validate_education_entity(data)
        return ValidationResult(valid=True, issues=[])


def _has_text(value: object) -> bool:
    return isinstance(value, str) and bool(value.strip())
