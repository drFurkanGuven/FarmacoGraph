"""Normalize drug relationship maps into publishable Neo4j edge rows."""

from __future__ import annotations

from copy import deepcopy
from datetime import UTC, date, datetime
from typing import Any

from farmacograph.curator.drug_package import load_nodes_index
from farmacograph.validators.evidence_validator import RELATIONSHIP_TARGET_TYPES

# Edge types authored via entity_payload.relationships UUID lists on Drug packages.
_DRUG_MAP_REL_TYPES = frozenset({"BELONGS_TO", "TREATS", "HAS_MECHANISM_ROOT"})


def normalize_drug_relationship_graph(package: dict[str, Any]) -> dict[str, Any]:
    """Expand UUID relationship maps into edge rows and hydrate missing related entities.

    Studio classification edits historically updated only
    ``entity_payload.relationships.BELONGS_TO`` without syncing ``relationships[]`` /
    ``related_entities``. Publish writes Neo4j edges exclusively from ``relationships[]``,
    so classification IDs could validate while BELONGS_TO never materialized in the graph.
    """
    normalized = deepcopy(package)
    entity_payload = normalized.get("entity_payload") or {}
    if entity_payload.get("entity_type") != "Drug":
        return normalized

    drug_id = str(entity_payload.get("id") or "").strip()
    if not drug_id:
        return normalized

    rel_map = entity_payload.get("relationships") or {}
    if not isinstance(rel_map, dict):
        rel_map = {}
        entity_payload["relationships"] = rel_map

    relationships = list(normalized.get("relationships") or [])
    relationships = _sync_map_edges(drug_id, rel_map, relationships)
    related_entities = _hydrate_related_entities(
        list(normalized.get("related_entities") or []),
        relationships,
        entity_payload,
    )

    normalized["relationships"] = relationships
    normalized["related_entities"] = related_entities
    return normalized


def _sync_map_edges(
    drug_id: str,
    rel_map: dict[str, Any],
    relationships: list[dict[str, Any]],
) -> list[dict[str, Any]]:
    desired: set[tuple[str, str]] = set()
    for rel_type in _DRUG_MAP_REL_TYPES:
        targets = rel_map.get(rel_type) or []
        if not isinstance(targets, list):
            continue
        for target_id in targets:
            tid = str(target_id).strip()
            if tid:
                desired.add((rel_type, tid))

    preserved: list[dict[str, Any]] = []
    seen: set[tuple[str, str]] = set()
    for row in relationships:
        if not isinstance(row, dict):
            continue
        rel_type = str(row.get("relationship_type") or "")
        source_id = str(row.get("source_id") or "")
        target_id = str(row.get("target_id") or "")
        if not rel_type or not source_id or not target_id:
            continue
        if (
            source_id == drug_id
            and rel_type in _DRUG_MAP_REL_TYPES
            and (rel_type, target_id) not in desired
        ):
            # Drop stale map-backed edges removed from entity_payload.relationships.
            continue
        preserved.append(row)
        if source_id == drug_id and rel_type in _DRUG_MAP_REL_TYPES:
            seen.add((rel_type, target_id))

    for rel_type, target_id in desired:
        if (rel_type, target_id) in seen:
            continue
        preserved.append(
            {
                "relationship_type": rel_type,
                "source_type": "Drug",
                "target_type": RELATIONSHIP_TARGET_TYPES.get(rel_type, "BiomedicalEntity"),
                "source_id": drug_id,
                "target_id": target_id,
            }
        )
        seen.add((rel_type, target_id))

    return preserved


def _hydrate_related_entities(
    related_entities: list[dict[str, Any]],
    relationships: list[dict[str, Any]],
    entity_payload: dict[str, Any],
) -> list[dict[str, Any]]:
    by_id: dict[str, dict[str, Any]] = {}
    for item in related_entities:
        if isinstance(item, dict) and item.get("id"):
            by_id[str(item["id"])] = item

    index_by_id = {
        str(entity["id"]): entity
        for entity in load_nodes_index().get("entities", [])
        if isinstance(entity, dict) and entity.get("id")
    }

    module = str(entity_payload.get("module") or "cardiovascular")
    for row in relationships:
        if not isinstance(row, dict):
            continue
        target_id = str(row.get("target_id") or "").strip()
        if not target_id or target_id in by_id:
            continue
        indexed = index_by_id.get(target_id)
        if indexed is None:
            continue
        by_id[target_id] = _entity_from_index(indexed, module=module)

    return list(by_id.values())


def _entity_from_index(node: dict[str, Any], *, module: str) -> dict[str, Any]:
    now = datetime.now(UTC).isoformat()
    entity: dict[str, Any] = {
        "id": node["id"],
        "entity_type": node["entity_type"],
        "slug": node["slug"],
        "label": node["label"],
        "description": node.get("description", ""),
        "status": "published",
        "dataset_version": "2026.1.0",
        "provenance": {
            "created_at": now,
            "updated_at": now,
            "created_by": "curator-system",
            "source": "manual",
        },
        "versioning": {
            "dataset_version": "2026.1.0",
            "valid_from": date.today().isoformat(),
            "status": "published",
        },
    }
    if node.get("entity_type") == "DrugClass":
        entity["organ_system"] = node.get("organ_system") or module
    return entity
