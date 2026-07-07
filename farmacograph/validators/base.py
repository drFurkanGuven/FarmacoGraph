"""Validator framework — four validation levels."""

from __future__ import annotations

from enum import Enum
from typing import Any

from pydantic import BaseModel, Field

try:
    from enum import StrEnum
except ImportError:

    class StrEnum(str, Enum):
        """Compatibility shim for Python < 3.11."""


class ValidationSeverity(StrEnum):
    ERROR = "error"
    WARNING = "warning"
    INFO = "info"


class ValidationLevel(StrEnum):
    SCHEMA = "schema"
    ONTOLOGY = "ontology"
    BIOMEDICAL = "biomedical"
    EDUCATIONAL = "educational"


class ValidationIssue(BaseModel):
    constraint_id: str | None = None
    level: ValidationLevel
    severity: ValidationSeverity
    message: str
    field: str | None = None
    entity_id: str | None = None
    relationship_type: str | None = None


class ValidationResult(BaseModel):
    valid: bool
    issues: list[ValidationIssue] = Field(default_factory=list)

    @property
    def errors(self) -> list[ValidationIssue]:
        return [i for i in self.issues if i.severity == ValidationSeverity.ERROR]

    def merge(self, other: ValidationResult) -> ValidationResult:
        combined = self.issues + other.issues
        return ValidationResult(valid=not any(i.severity == ValidationSeverity.ERROR for i in combined), issues=combined)


class BaseValidator:
    """Base class for all validators."""

    level: ValidationLevel
    name: str

    def validate(self, data: Any) -> ValidationResult:
        raise NotImplementedError
