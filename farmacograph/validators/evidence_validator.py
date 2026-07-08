"""Evidence validation — FG-C012, FG-C019, FG-C020 for publish packages."""

from __future__ import annotations

from typing import Any

from farmacograph.ontology.registry import load_ontology_registry
from farmacograph.validators.base import (
    BaseValidator,
    ValidationIssue,
    ValidationLevel,
    ValidationResult,
    ValidationSeverity,
)

RELATIONSHIP_TARGET_TYPES: dict[str, str] = {
    "BELONGS_TO": "DrugClass",
    "IS_A": "DrugClass",
    "TREATS": "Disease",
    "PREVENTS": "Disease",
    "HAS_MECHANISM_ROOT": "MechanismFragment",
    "TARGETS": "Target",
    "INHIBITS": "Target",
    "CAUSES": "SideEffect",
    "CONTRAINDICATED_IN": "Disease",
    "INTERACTS_WITH": "Drug",
    "AVOID_WITH": "Drug",
    "METABOLIZED_BY": "Enzyme",
    "COVERS": "Pathogen",
    "FIRST_LINE_FOR": "Disease",
}


def _edge_key(
    source_id: str,
    relationship_type: str,
    target_id: str,
) -> tuple[str, str, str]:
    return (source_id, relationship_type, target_id)


def _normalize_relationships(
    entity_payload: dict[str, Any],
    relationships: list[dict[str, Any]] | None,
) -> list[dict[str, Any]]:
    """Merge explicit relationship rows with entity_payload.relationships UUID lists."""
    rows: list[dict[str, Any]] = []
    seen: set[tuple[str, str, str]] = set()

    for rel in relationships or []:
        source_id = str(rel.get("source_id", ""))
        target_id = str(rel.get("target_id", ""))
        rel_type = str(rel.get("relationship_type", ""))
        if not source_id or not target_id or not rel_type:
            continue
        key = _edge_key(source_id, rel_type, target_id)
        if key not in seen:
            seen.add(key)
            rows.append(rel)

    drug_id = str(entity_payload.get("id", ""))
    rel_map = entity_payload.get("relationships") or {}
    if not drug_id or not isinstance(rel_map, dict):
        return rows

    for rel_type, targets in rel_map.items():
        if not isinstance(targets, list):
            continue
        for target_id in targets:
            key = _edge_key(drug_id, rel_type, str(target_id))
            if key in seen:
                continue
            seen.add(key)
            rows.append(
                {
                    "relationship_type": rel_type,
                    "source_id": drug_id,
                    "source_type": "Drug",
                    "target_id": str(target_id),
                    "target_type": RELATIONSHIP_TARGET_TYPES.get(rel_type, "BiomedicalEntity"),
                    "properties": None,
                }
            )

    return rows


def _index_supported_by(relationships: list[dict[str, Any]]) -> set[tuple[str, str, str]]:
    """Assertion keys covered by SUPPORTED_BY edges (source drug, rel type, target)."""
    covered: set[tuple[str, str, str]] = set()
    for rel in relationships:
        if rel.get("relationship_type") != "SUPPORTED_BY":
            continue
        props = rel.get("properties") or {}
        assertion_rel = props.get("assertion_relationship")
        assertion_target = props.get("assertion_target_id")
        source_id = str(rel.get("source_id", ""))
        if assertion_rel and assertion_target and source_id:
            covered.add(_edge_key(source_id, str(assertion_rel), str(assertion_target)))
            continue
        # Drug-level SUPPORTED_BY without assertion metadata does not satisfy clinical edges.
    return covered


def _has_expert_consensus_escape(
    properties: dict[str, Any] | None,
    entity_payload: dict[str, Any],
) -> bool:
    props = properties or {}
    evidence_level = props.get("evidence_level")
    if evidence_level != "expert_consensus":
        return False
    provenance = entity_payload.get("provenance") or {}
    return provenance.get("curator_attestation") is True


class EvidenceValidator(BaseValidator):
    level = ValidationLevel.ONTOLOGY
    name = "evidence_validator"

    def validate_package(
        self,
        entity_payload: dict[str, Any],
        *,
        relationships: list[dict[str, Any]] | None = None,
    ) -> ValidationResult:
        registry = load_ontology_registry()
        issues: list[ValidationIssue] = []
        all_rels = _normalize_relationships(entity_payload, relationships)
        supported = _index_supported_by(all_rels)

        for rel in all_rels:
            rel_type = str(rel.get("relationship_type", ""))
            if rel_type == "SUPPORTED_BY":
                continue

            rel_def = registry.get_relationship(rel_type)
            if rel_def is None:
                continue

            source_id = str(rel.get("source_id", ""))
            target_id = str(rel.get("target_id", ""))
            properties = rel.get("properties") or {}
            edge_key = _edge_key(source_id, rel_type, target_id)

            if rel_def.requires_evidence_on_publish:
                evidence_ids = (
                    properties.get("evidence_ids") if isinstance(properties, dict) else None
                )
                has_evidence_ids = isinstance(evidence_ids, list) and len(evidence_ids) > 0
                has_supported_by = edge_key in supported
                expert_escape = _has_expert_consensus_escape(properties, entity_payload)

                if not has_evidence_ids and not has_supported_by and not expert_escape:
                    issues.append(
                        ValidationIssue(
                            constraint_id="FG-C012",
                            level=self.level,
                            severity=ValidationSeverity.ERROR,
                            message=(
                                f"Clinical assertion {rel_type} requires supporting evidence "
                                f"(SUPPORTED_BY link or evidence_ids)."
                            ),
                            field=f"relationships.{rel_type}",
                            entity_id=source_id,
                            relationship_type=rel_type,
                        )
                    )

            if rel_def.requires_explanation_on_publish:
                explanation = (
                    properties.get("explanation") if isinstance(properties, dict) else None
                )
                if not explanation:
                    issues.append(
                        ValidationIssue(
                            constraint_id="FG-C020",
                            level=self.level,
                            severity=ValidationSeverity.ERROR,
                            message=f"Published edge {rel_type} requires an explanation.",
                            field=f"relationships.{rel_type}.explanation",
                            entity_id=source_id,
                            relationship_type=rel_type,
                        )
                    )

            if rel_def.requires_evidence_on_publish:
                confidence = (
                    properties.get("confidence_score") if isinstance(properties, dict) else None
                )
                evidence_level = (
                    properties.get("evidence_level") if isinstance(properties, dict) else None
                )
                if confidence is None or evidence_level is None:
                    issues.append(
                        ValidationIssue(
                            constraint_id="FG-C019",
                            level=self.level,
                            severity=ValidationSeverity.ERROR,
                            message=(
                                f"Published edge {rel_type} requires confidence_score and evidence_level."
                            ),
                            field=f"relationships.{rel_type}.confidence_score",
                            entity_id=source_id,
                            relationship_type=rel_type,
                        )
                    )

        return ValidationResult(
            valid=len([i for i in issues if i.severity == ValidationSeverity.ERROR]) == 0,
            issues=issues,
        )

    def validate(self, data: object) -> ValidationResult:
        if not isinstance(data, dict):
            return ValidationResult(valid=False, issues=[])
        entity = data.get("entity_payload") or data
        relationships = data.get("relationships")
        if not isinstance(entity, dict):
            return ValidationResult(valid=False, issues=[])
        return self.validate_package(
            entity, relationships=relationships if isinstance(relationships, list) else None
        )
