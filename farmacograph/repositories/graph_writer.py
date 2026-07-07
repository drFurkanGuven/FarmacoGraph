"""Graph writer — publishes validated entities to Neo4j."""

from __future__ import annotations

from typing import Any

from farmacograph.db.neo4j.driver import Neo4jDriver


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
        # Dynamic label merge — label is validated by caller (service layer)
        query = f"""
        MERGE (n:{label} {{id: $id}})
        SET n += $props
        SET n:BiomedicalEntity
        RETURN n {{.*}} AS node
        """
        props = {k: v for k, v in properties.items() if v is not None}
        results = await self._driver.run_query(
            query, {"id": str(entity_id), "props": props}
        )
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
        query = f"""
        MATCH (a:{source_label} {{id: $source_id}})
        MATCH (b:{target_label} {{id: $target_id}})
        MERGE (a)-[r:{rel_type}]->(b)
        SET r += $props
        RETURN r IS NOT NULL AS created
        """
        results = await self._driver.run_query(
            query,
            {
                "source_id": source_id,
                "target_id": target_id,
                "props": properties or {},
            },
        )
        return bool(results[0]["created"]) if results else False
