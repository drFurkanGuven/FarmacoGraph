"""Biomedical-level validation — clinical and mechanistic rules."""

from __future__ import annotations

from farmacograph.models.enums import EntityStatus
from farmacograph.validators.base import (
    BaseValidator,
    ValidationIssue,
    ValidationLevel,
    ValidationResult,
    ValidationSeverity,
)


class BiomedicalValidator(BaseValidator):
    level = ValidationLevel.BIOMEDICAL
    name = "biomedical_validator"

    def validate_published_drug(self, drug: dict) -> ValidationResult:
        issues: list[ValidationIssue] = []
        status = drug.get("versioning", {}).get("status", drug.get("status"))

        if status != EntityStatus.PUBLISHED:
            return ValidationResult(valid=True, issues=[])

        relationships = drug.get("relationships", {})

        if not relationships.get("IS_A") and not relationships.get("BELONGS_TO"):
            issues.append(
                ValidationIssue(
                    constraint_id="FG-C008",
                    level=self.level,
                    severity=ValidationSeverity.ERROR,
                    message="Published drug must belong to at least one DrugClass",
                    entity_id=str(drug.get("id")),
                )
            )

        if not relationships.get("TREATS") and not relationships.get("PREVENTS"):
            issues.append(
                ValidationIssue(
                    constraint_id="FG-C009",
                    level=self.level,
                    severity=ValidationSeverity.ERROR,
                    message="Published drug must have at least one indication",
                    entity_id=str(drug.get("id")),
                )
            )

        if not relationships.get("HAS_MECHANISM_ROOT"):
            issues.append(
                ValidationIssue(
                    constraint_id="FG-C015",
                    level=self.level,
                    severity=ValidationSeverity.ERROR,
                    message="Published drug must have mechanism DAG root",
                    entity_id=str(drug.get("id")),
                )
            )

        provenance = drug.get("provenance", {})
        if not provenance.get("created_by") or not provenance.get("source"):
            issues.append(
                ValidationIssue(
                    constraint_id="FG-C018",
                    level=self.level,
                    severity=ValidationSeverity.ERROR,
                    message="Provenance metadata is required",
                    entity_id=str(drug.get("id")),
                )
            )

        if provenance.get("source") == "ai_assisted_draft" and not provenance.get("curator_attestation"):
            issues.append(
                ValidationIssue(
                    constraint_id="FG-C028",
                    level=self.level,
                    severity=ValidationSeverity.ERROR,
                    message="AI-assisted drafts require curator attestation before publish",
                    entity_id=str(drug.get("id")),
                )
            )

        return ValidationResult(valid=len(issues) == 0, issues=issues)

    def validate(self, data: object) -> ValidationResult:
        if isinstance(data, dict) and data.get("entity_type") == "Drug":
            return self.validate_published_drug(data)
        return ValidationResult(valid=True, issues=[])
