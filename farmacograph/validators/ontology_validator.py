"""Ontology-level validation — relationship semantics and constraints."""

from __future__ import annotations

from farmacograph.ontology.registry import load_ontology_registry
from farmacograph.validators.base import (
    BaseValidator,
    ValidationIssue,
    ValidationLevel,
    ValidationResult,
    ValidationSeverity,
)


class OntologyValidator(BaseValidator):
    level = ValidationLevel.ONTOLOGY
    name = "ontology_validator"

    def validate_relationship(
        self,
        rel_type: str,
        source_type: str,
        target_type: str,
        *,
        same_node: bool = False,
    ) -> ValidationResult:
        registry = load_ontology_registry()
        issues: list[ValidationIssue] = []
        rel_def = registry.get_relationship(rel_type)

        if rel_def is None:
            issues.append(
                ValidationIssue(
                    constraint_id=None,
                    level=self.level,
                    severity=ValidationSeverity.ERROR,
                    message=f"Unknown relationship type: {rel_type}",
                    relationship_type=rel_type,
                )
            )
            return ValidationResult(valid=False, issues=issues)

        if same_node and rel_type in ("INTERACTS_WITH", "AVOID_WITH"):
            issues.append(
                ValidationIssue(
                    constraint_id="FG-C005",
                    level=self.level,
                    severity=ValidationSeverity.ERROR,
                    message="Drug must not interact with itself",
                    relationship_type=rel_type,
                )
            )

        if not registry.is_allowed(rel_type, source_type, target_type):
            constraint_id = "FG-C001" if rel_type == "TARGETS" and target_type == "Disease" else None
            issues.append(
                ValidationIssue(
                    constraint_id=constraint_id,
                    level=self.level,
                    severity=ValidationSeverity.ERROR,
                    message=f"Forbidden: {source_type} -[{rel_type}]-> {target_type}",
                    relationship_type=rel_type,
                )
            )

        return ValidationResult(valid=len(issues) == 0, issues=issues)

    def validate(self, data: object) -> ValidationResult:
        if not isinstance(data, dict):
            return ValidationResult(valid=False, issues=[
                ValidationIssue(
                    level=self.level,
                    severity=ValidationSeverity.ERROR,
                    message="Expected dict with relationship fields",
                )
            ])
        return self.validate_relationship(
            data.get("relationship_type", ""),
            data.get("source_type", ""),
            data.get("target_type", ""),
            same_node=data.get("source_id") == data.get("target_id"),
        )
