"""Schema-level validation using Pydantic models."""

from __future__ import annotations

from typing import Any

from pydantic import BaseModel, ValidationError

from farmacograph.validators.base import (
    BaseValidator,
    ValidationIssue,
    ValidationLevel,
    ValidationResult,
    ValidationSeverity,
)


class SchemaValidator(BaseValidator):
    level = ValidationLevel.SCHEMA
    name = "schema_validator"

    def __init__(self, model: type[BaseModel]) -> None:
        self.model = model

    def validate(self, data: Any) -> ValidationResult:
        issues: list[ValidationIssue] = []
        try:
            self.model.model_validate(data)
        except ValidationError as exc:
            for error in exc.errors():
                issues.append(
                    ValidationIssue(
                        level=self.level,
                        severity=ValidationSeverity.ERROR,
                        message=error["msg"],
                        field=".".join(str(p) for p in error["loc"]),
                    )
                )
        return ValidationResult(valid=len(issues) == 0, issues=issues)
