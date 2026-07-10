"""Normalize education package content into graph publish rows."""

from __future__ import annotations

from copy import deepcopy
from typing import Any


def normalize_education_graph(package: dict[str, Any]) -> dict[str, Any]:
    """Return a package with education nodes and HAS_EDUCATION edges synchronized."""
    normalized = deepcopy(package)
    entity_payload = normalized.get("entity_payload") or {}
    drug_entity_id = str(entity_payload.get("id") or "").strip()
    if not drug_entity_id:
        return normalized

    education = [
        item
        for item in normalized.get("education") or []
        if isinstance(item, dict) and str(item.get("id") or "").strip()
    ]
    if not education:
        return normalized

    normalized["related_entities"] = _sync_related_entities(
        normalized.get("related_entities") or [],
        education,
        drug_entity_id,
    )
    normalized["relationships"] = _sync_relationships(
        normalized.get("relationships") or [],
        education,
        drug_entity_id,
        str(entity_payload.get("entity_type") or "Drug"),
    )
    return normalized


def _sync_related_entities(
    related_entities: list[dict[str, Any]],
    education: list[dict[str, Any]],
    drug_entity_id: str,
) -> list[dict[str, Any]]:
    education_ids = {str(item["id"]) for item in education}
    preserved = [
        item
        for item in related_entities
        if not (
            isinstance(item, dict)
            and item.get("entity_type") == "EducationResource"
            and str(item.get("id")) in education_ids
        )
    ]
    return [
        *preserved,
        *[_education_related_entity(item, drug_entity_id) for item in education],
    ]


def _education_related_entity(item: dict[str, Any], drug_entity_id: str) -> dict[str, Any]:
    entity = deepcopy(item)
    entity.setdefault("entity_type", "EducationResource")
    linked = entity.get("linked_entity_ids")
    if not isinstance(linked, list):
        linked = []
    entity["linked_entity_ids"] = [*dict.fromkeys([*map(str, linked), drug_entity_id])]
    return entity


def _sync_relationships(
    relationships: list[dict[str, Any]],
    education: list[dict[str, Any]],
    drug_entity_id: str,
    source_type: str,
) -> list[dict[str, Any]]:
    education_ids = {str(item["id"]) for item in education}
    preserved = [
        row
        for row in relationships
        if not (
            isinstance(row, dict)
            and row.get("relationship_type") == "HAS_EDUCATION"
            and str(row.get("source_id")) == drug_entity_id
            and str(row.get("target_id")) in education_ids
        )
    ]
    return [
        *preserved,
        *[
            {
                "relationship_type": "HAS_EDUCATION",
                "source_type": source_type,
                "target_type": "EducationResource",
                "source_id": drug_entity_id,
                "target_id": str(item["id"]),
                "properties": {"kind": str(item.get("kind") or "EducationResource")},
            }
            for item in education
        ],
    ]
