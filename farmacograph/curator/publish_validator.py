"""Pre-publish validation for curator packages."""

from __future__ import annotations

from typing import Any

from farmacograph.core.exceptions import ValidationError
from farmacograph.models.clinical import Disease
from farmacograph.models.pharmacologic import Drug
from farmacograph.validators.base import ValidationLevel, ValidationResult
from farmacograph.validators.education_validator import EducationValidator
from farmacograph.validators.evidence_validator import EvidenceValidator
from farmacograph.validators.ontology_validator import OntologyValidator
from farmacograph.validators.registry import ValidatorRegistry, get_default_registry
from farmacograph.validators.schema_validator import SchemaValidator


def _registry_with_entity_schemas() -> ValidatorRegistry:
    registry = get_default_registry()
    registry.register_schema_validator(SchemaValidator(Drug))
    registry.register_schema_validator(SchemaValidator(Disease))
    return registry


def validate_publish_package(
    entity_payload: dict[str, Any],
    *,
    related_entities: list[dict[str, Any]] | None = None,
    relationships: list[dict[str, Any]] | None = None,
    education: list[dict[str, Any]] | None = None,
) -> ValidationResult:
    """Run schema, biomedical, education, evidence, and per-edge ontology validation."""
    registry = _registry_with_entity_schemas()
    ontology = OntologyValidator()
    education_validator = EducationValidator()
    evidence = EvidenceValidator()
    result = ValidationResult(valid=True, issues=[])

    entity_type = entity_payload.get("entity_type")
    if entity_type in ("Drug", "Disease"):
        result = result.merge(
            registry.validate_all(
                entity_payload,
                levels=[ValidationLevel.SCHEMA, ValidationLevel.BIOMEDICAL],
            )
        )
        if entity_type == "Drug":
            result = result.merge(
                evidence.validate_package(
                    entity_payload,
                    relationships=relationships,
                )
            )

    for item in education or []:
        result = result.merge(education_validator.validate(item))

    for rel in relationships or []:
        result = result.merge(ontology.validate(rel))

    return result


def require_valid_publish_package(
    entity_payload: dict[str, Any],
    *,
    related_entities: list[dict[str, Any]] | None = None,
    relationships: list[dict[str, Any]] | None = None,
    education: list[dict[str, Any]] | None = None,
) -> None:
    result = validate_publish_package(
        entity_payload,
        related_entities=related_entities,
        relationships=relationships,
        education=education,
    )
    if not result.valid:
        messages = "; ".join(
            f"{i.constraint_id or i.level}: {i.message}" for i in result.errors[:5]
        )
        raise ValidationError(f"Publish validation failed: {messages}")
