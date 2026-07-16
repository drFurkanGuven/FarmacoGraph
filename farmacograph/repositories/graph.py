"""Graph repository — Neo4j access. Only layer that queries the knowledge graph."""

from __future__ import annotations

from typing import Any
from uuid import UUID

from farmacograph.db.neo4j.driver import Neo4jDriver


class GraphRepository:
    """Read-only graph queries. Returns empty results when Neo4j is disabled."""

    def __init__(self, driver: Neo4jDriver) -> None:
        self._driver = driver

    @property
    def is_available(self) -> bool:
        return self._driver.is_connected

    async def list_drugs(
        self,
        *,
        module: str | None = None,
        limit: int = 50,
        offset: int = 0,
        dataset_version: str | None = None,
    ) -> list[dict[str, Any]]:
        if not self.is_available:
            return []
        query = """
        MATCH (d:Drug)
        WHERE ($module IS NULL OR d.module = $module)
          AND ($dataset_version IS NULL OR d.dataset_version = $dataset_version)
          AND d.status = 'published'
        RETURN d.id AS id, d.slug AS slug, d.generic_name AS label,
               d.status AS status, d.dataset_version AS dataset_version
        ORDER BY d.generic_name
        SKIP $offset LIMIT $limit
        """
        return await self._driver.run_query(
            query,
            {
                "module": module,
                "limit": limit,
                "offset": offset,
                "dataset_version": dataset_version,
            },
        )

    async def get_drug_by_id(
        self, drug_id: UUID, dataset_version: str | None = None
    ) -> dict[str, Any] | None:
        if not self.is_available:
            return None
        results = await self._driver.run_query(
            "MATCH (d:Drug {id: $id}) WHERE ($dv IS NULL OR d.dataset_version = $dv) RETURN d",
            {"id": str(drug_id), "dv": dataset_version},
        )
        return results[0] if results else None

    async def get_drug_education(
        self, drug_id: UUID, dataset_version: str | None = None
    ) -> list[dict[str, Any]]:
        if not self.is_available:
            return []
        return await self._driver.run_query(
            """
            MATCH (d:Drug {id: $id})-[:HAS_EDUCATION]->(e:EducationResource)
            WHERE ($dv IS NULL OR d.dataset_version = $dv)
            RETURN e {.*} AS education
            ORDER BY coalesce(e.kind, e.entity_type), coalesce(e.label, e.id)
            """,
            {"id": str(drug_id), "dv": dataset_version},
        )

    async def get_drug_by_slug(
        self, slug: str, dataset_version: str | None = None
    ) -> dict[str, Any] | None:
        if not self.is_available:
            return None
        results = await self._driver.run_query(
            "MATCH (d:Drug {slug: $slug}) WHERE ($dv IS NULL OR d.dataset_version = $dv) RETURN d",
            {"slug": slug, "dv": dataset_version},
        )
        return results[0] if results else None

    async def get_drug_summary_by_id(self, entity_id: str) -> dict[str, Any] | None:
        if not self.is_available:
            return None
        results = await self._driver.run_query(
            """
            MATCH (d:Drug {id: $id})
            RETURN d.id AS id, d.slug AS slug,
                   coalesce(d.generic_name, d.label) AS label, d.module AS module
            """,
            {"id": entity_id},
        )
        return results[0] if results else None

    async def search_drugs(self, query: str, *, limit: int = 20) -> list[dict[str, Any]]:
        if not self.is_available:
            return []
        q = query.strip().lower()
        if len(q) < 2:
            return []
        return await self._driver.run_query(
            """
            MATCH (d:Drug)
            WHERE d.status = 'published'
              AND (
                toLower(d.slug) CONTAINS $q
                OR toLower(d.generic_name) CONTAINS $q
                OR toLower(d.label) CONTAINS $q
              )
            RETURN d.id AS id, d.slug AS slug, d.generic_name AS label,
                   d.module AS module, d.status AS status, 'Drug' AS type
            ORDER BY d.generic_name
            LIMIT $limit
            """,
            {"q": q, "limit": limit},
        )

    async def count_entities(self) -> dict[str, int]:
        if not self.is_available:
            return {"entities": 0, "relationships": 0}
        entity_result = await self._driver.run_query(
            "MATCH (n:BiomedicalEntity) RETURN count(n) AS count"
        )
        rel_result = await self._driver.run_query("MATCH ()-[r]->() RETURN count(r) AS count")
        return {
            "entities": entity_result[0]["count"] if entity_result else 0,
            "relationships": rel_result[0]["count"] if rel_result else 0,
        }

    async def count_drugs(self, *, module: str | None = None) -> int:
        if not self.is_available:
            return 0
        results = await self._driver.run_query(
            """
            MATCH (d:Drug)
            WHERE d.status = 'published'
              AND ($module IS NULL OR d.module = $module)
            RETURN count(d) AS count
            """,
            {"module": module},
        )
        return int(results[0]["count"]) if results else 0

    async def get_published_drug_graph_stats(self, entity_id: str) -> dict[str, Any] | None:
        if not self.is_available:
            return None
        results = await self._driver.run_query(
            """
            MATCH (d:Drug {id: $id})
            OPTIONAL MATCH (d)-[r]->()
            RETURN d.slug AS slug, count(r) AS rel_count
            """,
            {"id": entity_id},
        )
        return results[0] if results else None

    async def get_drug_graph_projection(
        self,
        drug_id: UUID,
        *,
        depth: int = 2,
        dataset_version: str | None = None,
    ) -> dict[str, Any]:
        if not self.is_available:
            return {
                "nodes": [],
                "edges": [],
                "layout_hint": "dagre",
                "depth": depth,
                "neo4j_available": False,
                "drug_in_graph": False,
            }
        bounded_depth = max(1, min(depth, 3))
        results = await self._driver.run_query(
            f"""
            MATCH (d:Drug {{id: $id}})
            WHERE ($dv IS NULL OR d.dataset_version = $dv)
            OPTIONAL MATCH path = (d)-[*1..{bounded_depth}]-(n)
            WITH d, [pathItem IN collect(path) WHERE pathItem IS NOT NULL] AS paths
            WITH collect(DISTINCT d) +
                 reduce(acc = [], pathItem IN paths | acc + nodes(pathItem)) AS raw_nodes,
                 reduce(acc = [], pathItem IN paths | acc + relationships(pathItem)) AS rels
            UNWIND raw_nodes AS node
            WITH collect(DISTINCT node) AS nodes, rels
            UNWIND CASE WHEN size(rels) = 0 THEN [null] ELSE rels END AS rel
            RETURN
              [node IN nodes WHERE node IS NOT NULL | {{
                id: node.id,
                labels: labels(node),
                entity_type: coalesce(node.entity_type, head(labels(node))),
                label: coalesce(node.label, node.generic_name, node.slug, node.id),
                slug: node.slug,
                properties: node {{.*}}
              }}] AS nodes,
              [edge IN collect(DISTINCT CASE WHEN rel IS NULL THEN null ELSE {{
                id: elementId(rel),
                relationship_type: type(rel),
                source_id: startNode(rel).id,
                target_id: endNode(rel).id,
                source_type: coalesce(startNode(rel).entity_type, head(labels(startNode(rel)))),
                target_type: coalesce(endNode(rel).entity_type, head(labels(endNode(rel)))),
                properties: rel {{.*}}
              }} END) WHERE edge IS NOT NULL] AS edges
            """,
            {"id": str(drug_id), "dv": dataset_version},
        )
        if not results:
            return {
                "nodes": [],
                "edges": [],
                "layout_hint": "dagre",
                "depth": bounded_depth,
                "neo4j_available": True,
                "drug_in_graph": False,
            }
        row = results[0]
        edges = [edge for edge in row.get("edges", []) if edge.get("id")]
        nodes = row.get("nodes", [])
        return {
            "nodes": nodes,
            "edges": edges,
            "layout_hint": "dagre",
            "depth": bounded_depth,
            "neo4j_available": True,
            "drug_in_graph": len(nodes) > 0,
        }

    async def get_drug_mechanism_dag(
        self,
        drug_id: UUID,
        *,
        dataset_version: str | None = None,
    ) -> dict[str, Any]:
        if not self.is_available:
            return {
                "drug_id": str(drug_id),
                "root_fragment_id": None,
                "nodes": [],
                "edges": [],
                "clinical_outcomes": [],
                "is_acyclic": True,
            }
        results = await self._driver.run_query(
            """
            MATCH (d:Drug {id: $id})
            WHERE ($dv IS NULL OR d.dataset_version = $dv)
            OPTIONAL MATCH (d)-[rootRel:HAS_MECHANISM_ROOT]->(root:MechanismFragment)
            OPTIONAL MATCH path = (root)-[:PRECEDES|BRANCHES_TO|MERGES_INTO|RESULTS_IN*0..8]->(n)
            WITH d, root, rootRel, [pathItem IN collect(path) WHERE pathItem IS NOT NULL] AS paths
            WITH d, root, rootRel,
                 collect(DISTINCT root) +
                 reduce(acc = [], pathItem IN paths | acc + nodes(pathItem)) AS raw_nodes,
                 reduce(acc = [], pathItem IN paths | acc + relationships(pathItem)) AS rels
            UNWIND raw_nodes AS node
            WITH d, root, rootRel, collect(DISTINCT node) AS nodes, rels
            UNWIND CASE WHEN size(rels) = 0 THEN [null] ELSE rels END AS rel
            RETURN
              root.id AS root_fragment_id,
              [node IN nodes WHERE node IS NOT NULL | {
                id: node.id,
                labels: labels(node),
                entity_type: coalesce(node.entity_type, head(labels(node))),
                label: coalesce(node.label, node.slug, node.id),
                slug: node.slug,
                properties: node {.*}
              }] AS nodes,
              CASE WHEN rootRel IS NULL THEN [] ELSE [{
                id: elementId(rootRel),
                relationship_type: type(rootRel),
                source_id: d.id,
                target_id: root.id,
                source_type: coalesce(d.entity_type, "Drug"),
                target_type: coalesce(root.entity_type, "MechanismFragment"),
                properties: rootRel {.*}
              }] END +
              [edge IN collect(DISTINCT CASE WHEN rel IS NULL THEN null ELSE {
                id: elementId(rel),
                relationship_type: type(rel),
                source_id: startNode(rel).id,
                target_id: endNode(rel).id,
                source_type: coalesce(startNode(rel).entity_type, head(labels(startNode(rel)))),
                target_type: coalesce(endNode(rel).entity_type, head(labels(endNode(rel)))),
                properties: rel {.*}
              } END) WHERE edge IS NOT NULL] AS edges
            """,
            {"id": str(drug_id), "dv": dataset_version},
        )
        if not results:
            return {
                "drug_id": str(drug_id),
                "root_fragment_id": None,
                "nodes": [],
                "edges": [],
                "clinical_outcomes": [],
                "is_acyclic": True,
            }
        row = results[0]
        edges = [edge for edge in row.get("edges", []) if edge.get("id")]
        return {
            "drug_id": str(drug_id),
            "root_fragment_id": row.get("root_fragment_id"),
            "nodes": row.get("nodes", []),
            "edges": edges,
            "clinical_outcomes": [
                node["id"]
                for node in row.get("nodes", [])
                if node.get("entity_type") in {"ClinicalOutcome", "SideEffect"}
            ],
            "is_acyclic": True,
        }

    async def find_explain_path(
        self,
        drug_slug: str,
        effect_slug: str | None = None,
    ) -> list[dict[str, Any]]:
        """Traverse mechanism path. Returns empty when no data or Neo4j disabled."""
        if not self.is_available:
            return []
        if effect_slug:
            query = """
            MATCH (d:Drug {slug: $drug_slug})-[:HAS_MECHANISM_ROOT]->(root)
            MATCH path = (root)-[:PRECEDES|BRANCHES_TO|MERGES_INTO|RESULTS_IN*1..10]->(se:SideEffect {slug: $effect_slug})
            RETURN path LIMIT 1
            """
            return await self._driver.run_query(
                query, {"drug_slug": drug_slug, "effect_slug": effect_slug}
            )
        return []

    async def get_prerequisites(self, drug_slug: str) -> list[dict[str, Any]]:
        if not self.is_available:
            return []
        return await self._driver.run_query(
            """
            MATCH (d:Drug {slug: $slug})-[:REQUIRES*1..5]->(topic:KnowledgeTopic)
            RETURN topic.id AS id, topic.label AS label, topic.slug AS slug
            """,
            {"slug": drug_slug},
        )
