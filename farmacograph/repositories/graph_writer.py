"""Graph writer — publishes validated entities to Neo4j."""

from __future__ import annotations

import json
import re
from typing import Any

from farmacograph.db.neo4j.driver import Neo4jDriver
from farmacograph.models.enums import EntityType, RelationshipType

_IDENTIFIER_PATTERN = re.compile(r"^[A-Za-z][A-Za-z0-9_]*$")

_ALLOWED_LABELS: set[str] = {
    *(e.value for e in EntityType),
    "PharmacologicEntity",
    "MolecularEntity",
    "PhysiologicEntity",
    "ClinicalEntity",
    "MechanisticEntity",
    "EvidenceEntity",
    "LearningEntity",
    "FiveSecondSummary",
    "ThirtySecondSummary",
    "FiveMinuteExplanation",
    "HighYieldReview",
    "BoardExamPearl",
    "CommonMistake",
    "Mnemonic",
    "Flashcard",
    "ComparisonTable",
    "ClinicalCase",
    "LearningObjective",
    "RevisionChecklist",
    "FAQ",
    "VisualExplanation",
}

_ALLOWED_RELATIONSHIPS: set[str] = {r.value for r in RelationshipType}


def _validate_label(label: str) -> str:
    if not isinstance(label, str) or label not in _ALLOWED_LABELS or not _IDENTIFIER_PATTERN.match(label):
        raise ValueError(f"Invalid or disallowed Neo4j entity label: {label!r}")
    return label


def _validate_relationship_type(rel_type: str) -> str:
    if (
        not isinstance(rel_type, str)
        or rel_type not in _ALLOWED_RELATIONSHIPS
        or not _IDENTIFIER_PATTERN.match(rel_type)
    ):
        raise ValueError(f"Invalid or disallowed Neo4j relationship type: {rel_type!r}")
    return rel_type


def _validate_property_key(key: str) -> str:
    if not isinstance(key, str) or not _IDENTIFIER_PATTERN.match(key):
        raise ValueError(f"Invalid Neo4j property key: {key!r}")
    return key


class GraphWriter:
    """Writes biomedical entities to Neo4j. Repository layer only — not exposed via API directly."""

    def __init__(self, driver: Neo4jDriver) -> None:
        self._driver = driver

    @property
    def is_available(self) -> bool:
        return self._driver.is_connected

    async def merge_entity(self, label: str, properties: dict[str, Any]) -> dict[str, Any]:
        """MERGE a biomedical entity node by id. Returns created/updated node props."""
        if not self.is_available:
            raise RuntimeError("Neo4j not connected")
        entity_id = properties.get("id")
        if not entity_id:
            raise ValueError("Entity properties must include 'id'")
        valid_label = _validate_label(label)
        query = f"""
        MERGE (n:{valid_label} {{id: $id}})
        SET n += $props
        SET n:BiomedicalEntity
        RETURN n {{.*}} AS node
        """
        props = {k: _to_neo4j_property(v) for k, v in properties.items() if v is not None}
        results = await self._driver.run_query(query, {"id": str(entity_id), "props": props})
        return results[0]["node"] if results else {}

    async def publish_package(
        self,
        entity_payload: dict[str, Any],
        *,
        related_entities: list[dict[str, Any]] | None = None,
        relationships: list[dict[str, Any]] | None = None,
    ) -> dict[str, Any]:
        """MERGE related entities, primary entity, then relationships."""
        if not self.is_available:
            raise RuntimeError("Neo4j not connected")

        for related in related_entities or []:
            label = related.get("entity_type")
            if not label:
                raise ValueError("related entity must include entity_type")
            await self.merge_entity(label, related)

        label = entity_payload.get("entity_type", "BiomedicalEntity")
        node = await self.merge_entity(label, entity_payload)

        for rel in relationships or []:
            await self.merge_relationship(
                rel["relationship_type"],
                rel["source_id"],
                rel["target_id"],
                rel["source_type"],
                rel["target_type"],
                rel.get("properties"),
            )

        return node

    async def merge_relationship(
        self,
        rel_type: str,
        source_id: str,
        target_id: str,
        source_label: str,
        target_label: str,
        properties: dict[str, Any] | None = None,
    ) -> bool:
        if not self.is_available:
            raise RuntimeError("Neo4j not connected")
        valid_rel = _validate_relationship_type(rel_type)
        valid_source = _validate_label(source_label)
        valid_target = _validate_label(target_label)
        query = f"""
        MATCH (a:{valid_source} {{id: $source_id}})
        MATCH (b:{valid_target} {{id: $target_id}})
        MERGE (a)-[r:{valid_rel}]->(b)
        SET r += $props
        RETURN r IS NOT NULL AS created
        """
        results = await self._driver.run_query(
            query,
            {
                "source_id": source_id,
                "target_id": target_id,
                "props": {
                    key: _to_neo4j_property(value)
                    for key, value in (properties or {}).items()
                    if value is not None
                },
            },
        )
        if not results:
            raise ValueError(
                f"Cannot MERGE {valid_rel}: missing endpoint "
                f"{valid_source}({source_id}) or {valid_target}({target_id})"
            )
        return bool(results[0]["created"])

    async def delete_relationship(
        self,
        rel_type: str,
        source_id: str,
        target_id: str,
        source_label: str,
        target_label: str,
        *,
        properties: dict[str, Any] | None = None,
        require_properties: bool = False,
    ) -> bool:
        """Delete relationship. When require_properties is True, only edges with all props match."""
        if not self.is_available:
            raise RuntimeError("Neo4j not connected")
        valid_rel = _validate_relationship_type(rel_type)
        valid_source = _validate_label(source_label)
        valid_target = _validate_label(target_label)
        props = properties or {}
        for key in props:
            _validate_property_key(key)
        if require_properties:
            where_clause = " AND ".join(f"r.{key} = ${key}" for key in props) or "true"
        else:
            where_clause = " AND ".join(f"r.{key} IS NULL" for key in props) if props else "true"
        query = f"""
        MATCH (a:{valid_source} {{id: $source_id}})-[r:{valid_rel}]->(b:{valid_target} {{id: $target_id}})
        WHERE {where_clause}
        DELETE r
        RETURN count(r) AS deleted
        """
        params: dict[str, Any] = {
            "source_id": source_id,
            "target_id": target_id,
            **props,
        }
        results = await self._driver.run_query(query, params)
        return bool(results[0]["deleted"]) if results else False


def _to_neo4j_property(value: Any) -> Any:
    """Neo4j properties cannot be maps or nested lists; preserve them as JSON strings."""
    if isinstance(value, dict):
        return json.dumps(value, sort_keys=True, separators=(",", ":"), default=str)
    if isinstance(value, list):
        if all(_is_neo4j_scalar(item) for item in value):
            return value
        return json.dumps(value, sort_keys=True, separators=(",", ":"), default=str)
    return value


def _is_neo4j_scalar(value: Any) -> bool:
    return value is None or isinstance(value, (str, int, float, bool))
