"""Validator registry — orchestrates four validation levels."""

from __future__ import annotations

from typing import Any

from farmacograph.validators.base import BaseValidator, ValidationLevel, ValidationResult
from farmacograph.validators.biomedical_validator import BiomedicalValidator
from farmacograph.validators.education_validator import EducationValidator
from farmacograph.validators.ontology_validator import OntologyValidator
from farmacograph.validators.schema_validator import SchemaValidator


class ValidatorRegistry:
    def __init__(self) -> None:
        self._validators: dict[ValidationLevel, list[BaseValidator]] = {
            ValidationLevel.ONTOLOGY: [OntologyValidator()],
            ValidationLevel.BIOMEDICAL: [BiomedicalValidator()],
            ValidationLevel.EDUCATIONAL: [EducationValidator()],
        }

    def register_schema_validator(self, validator: SchemaValidator) -> None:
        self._validators.setdefault(ValidationLevel.SCHEMA, []).append(validator)

    def validate_all(self, data: Any, *, levels: list[ValidationLevel] | None = None) -> ValidationResult:
        target_levels = levels or list(ValidationLevel)
        result = ValidationResult(valid=True, issues=[])

        for level in target_levels:
            for validator in self._validators.get(level, []):
                partial = validator.validate(data)
                result = result.merge(partial)

        return result


def get_default_registry() -> ValidatorRegistry:
    return ValidatorRegistry()
