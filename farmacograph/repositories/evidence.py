"""Evidence repository — Neo4j read/write for Evidence nodes and SUPPORTED_BY links."""

from __future__ import annotations

import re
from typing import Any
from uuid import UUID

from farmacograph.db.neo4j.driver import Neo4jDriver
from farmacograph.repositories.graph_writer import GraphWriter


class EvidenceRepository:
    """Evidence-specific graph access."""

    def __init__(self, driver: Neo4jDriver, writer: GraphWriter) -> None:
        self._driver = driver
        self._writer = writer

    @property
    def is_available(self) -> bool:
        return self._driver.is_connected

    @property
    def writer(self) -> GraphWriter:
        return self._writer

    async def list_evidence(
        self,
        *,
        limit: int = 50,
        offset: int = 0,
        evidence_type: str | None = None,
        search: str | None = None,
        dataset_version: str | None = None,
    ) -> tuple[list[dict[str, Any]], int]:
        if not self.is_available:
            return [], 0
        search_q = search.strip().lower() if search else None
        params = {
            "limit": limit,
            "offset": offset,
            "evidence_type": evidence_type,
            "search": search_q,
            "dataset_version": dataset_version,
        }
        rows = await self._driver.run_query(
            """
            MATCH (e:Evidence)
            WHERE ($evidence_type IS NULL OR e.evidence_type = $evidence_type)
              AND ($dataset_version IS NULL OR e.dataset_version = $dataset_version)
              AND (
                $search IS NULL
                OR toLower(e.title) CONTAINS $search
                OR toLower(e.slug) CONTAINS $search
              )
            RETURN e {.*} AS evidence
            ORDER BY e.title
            SKIP $offset LIMIT $limit
            """,
            params,
        )
        count_rows = await self._driver.run_query(
            """
            MATCH (e:Evidence)
            WHERE ($evidence_type IS NULL OR e.evidence_type = $evidence_type)
              AND ($dataset_version IS NULL OR e.dataset_version = $dataset_version)
              AND (
                $search IS NULL
                OR toLower(e.title) CONTAINS $search
                OR toLower(e.slug) CONTAINS $search
              )
            RETURN count(e) AS total
            """,
            params,
        )
        total = int(count_rows[0]["total"]) if count_rows else 0
        return [row["evidence"] for row in rows], total

    async def get_evidence_by_id(self, evidence_id: UUID) -> dict[str, Any] | None:
        if not self.is_available:
            return None
        rows = await self._driver.run_query(
            """
            MATCH (e:Evidence {id: $id})
            OPTIONAL MATCH (source)-[r:SUPPORTED_BY]->(e)
            RETURN e {.*} AS evidence,
                   collect(DISTINCT {
                     source_id: source.id,
                     source_type: head([lbl IN labels(source) WHERE lbl <> 'BiomedicalEntity']),
                     assertion_relationship: r.assertion_relationship,
                     assertion_target_id: r.assertion_target_id,
                     assertion_target_type: r.assertion_target_type
                   }) AS attachments
            """,
            {"id": str(evidence_id)},
        )
        if not rows:
            return None
        row = rows[0]
        attachments = [a for a in row.get("attachments", []) if a.get("source_id")]
        evidence = row["evidence"]
        evidence["attachments"] = attachments
        return evidence

    async def get_entity_by_id(self, entity_id: UUID, label: str) -> dict[str, Any] | None:
        if not self.is_available:
            return None
        rows = await self._driver.run_query(
            f"MATCH (n:{label} {{id: $id}}) RETURN n {{.*}} AS node",
            {"id": str(entity_id)},
        )
        return rows[0]["node"] if rows else None

    async def clinical_assertion_exists(
        self,
        *,
        source_id: str,
        source_type: str,
        relationship_type: str,
        target_id: str,
        target_type: str,
    ) -> bool:
        if not self.is_available:
            return False
        rows = await self._driver.run_query(
            f"""
            MATCH (a:{source_type} {{id: $source_id}})-[r:{relationship_type}]->(b:{target_type} {{id: $target_id}})
            RETURN count(r) AS count
            """,
            {
                "source_id": source_id,
                "target_id": target_id,
            },
        )
        return bool(rows and rows[0]["count"] > 0)

    async def list_drug_evidence(self, drug_id: str) -> list[dict[str, Any]]:
        if not self.is_available:
            return []
        rows = await self._driver.run_query(
            """
            MATCH (d:Drug {id: $drug_id})-[r:SUPPORTED_BY]->(e:Evidence)
            RETURN e {.*} AS evidence,
                   r.assertion_relationship AS assertion_relationship,
                   r.assertion_target_id AS assertion_target_id,
                   r.assertion_target_type AS assertion_target_type
            ORDER BY e.title
            """,
            {"drug_id": drug_id},
        )
        results: list[dict[str, Any]] = []
        for row in rows:
            evidence = row.get("evidence") or {}
            assertion = None
            if row.get("assertion_relationship"):
                assertion = {
                    "relationship_type": row.get("assertion_relationship"),
                    "target_id": row.get("assertion_target_id"),
                    "target_type": row.get("assertion_target_type"),
                }
            results.append(
                {
                    "evidence_id": evidence.get("id"),
                    "evidence": evidence,
                    "assertion": assertion,
                }
            )
        return results

    async def merge_evidence(self, properties: dict[str, Any]) -> dict[str, Any]:
        return await self._writer.merge_entity("Evidence", properties)

    async def attach_to_entity(
        self,
        *,
        source_id: str,
        source_type: str,
        evidence_id: str,
        assertion: dict[str, str] | None = None,
    ) -> bool:
        props = assertion or {}
        return await self._writer.merge_relationship(
            "SUPPORTED_BY",
            source_id,
            evidence_id,
            source_type,
            "Evidence",
            props or None,
        )

    async def detach_from_entity(
        self,
        *,
        source_id: str,
        source_type: str,
        evidence_id: str,
        assertion: dict[str, str] | None = None,
    ) -> bool:
        if assertion is not None:
            return await self._writer.delete_relationship(
                "SUPPORTED_BY",
                source_id,
                evidence_id,
                source_type,
                "Evidence",
                properties=assertion,
                require_properties=True,
            )
        if not self.is_available:
            return False
        rows = await self._driver.run_query(
            f"""
            MATCH (a:{source_type} {{id: $source_id}})-[r:SUPPORTED_BY]->(e:Evidence {{id: $evidence_id}})
            WHERE r.assertion_relationship IS NULL
              AND r.assertion_target_id IS NULL
              AND r.assertion_target_type IS NULL
            DELETE r
            RETURN count(r) AS deleted
            """,
            {"source_id": source_id, "evidence_id": evidence_id},
        )
        return bool(rows[0]["deleted"]) if rows else False

    @staticmethod
    def slugify_title(title: str) -> str:
        slug = re.sub(r"[^a-z0-9]+", "-", title.strip().lower())
        return slug.strip("-") or "evidence-stub"
