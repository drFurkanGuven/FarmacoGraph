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

DISEASE_RELATIONSHIP_TYPES = (
    "TREATS",
    "PREVENTS",
    "CONTRAINDICATED_IN",
    "FIRST_LINE_FOR",
)


class BiomedicalValidator(BaseValidator):
    level = ValidationLevel.BIOMEDICAL
    name = "biomedical_validator"

    def validate_drug_relationship_targets(self, drug: dict) -> ValidationResult:
        from farmacograph.curator.disease_package import is_known_disease_id

        issues: list[ValidationIssue] = []
        relationships = drug.get("relationships", {})
        if not isinstance(relationships, dict):
            return ValidationResult(valid=True, issues=[])

        for rel_type in DISEASE_RELATIONSHIP_TYPES:
            targets = relationships.get(rel_type) or []
            if not isinstance(targets, list):
                continue
            for target_id in targets:
                target = str(target_id)
                if not is_known_disease_id(target):
                    issues.append(
                        ValidationIssue(
                            constraint_id="FG-C027",
                            level=self.level,
                            severity=ValidationSeverity.ERROR,
                            message=(
                                f"Unknown Disease reference in {rel_type}: {target}. "
                                "Use a disease from the curator catalog."
                            ),
                            field=f"relationships.{rel_type}",
                            entity_id=str(drug.get("id")),
                            relationship_type=rel_type,
                        )
                    )

        return ValidationResult(valid=len(issues) == 0, issues=issues)

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

        if provenance.get("source") == "ai_assisted_draft" and not provenance.get(
            "curator_attestation"
        ):
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
        if not isinstance(data, dict) or data.get("entity_type") != "Drug":
            return ValidationResult(valid=True, issues=[])

        result = self.validate_drug_relationship_targets(data)
        status = data.get("versioning", {}).get("status", data.get("status"))
        if status == EntityStatus.PUBLISHED:
            result = result.merge(self.validate_published_drug(data))
        return result
