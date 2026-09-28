"""Graph repository — Neo4j access. Only layer that queries the knowledge graph."""

from __future__ import annotations

from typing import Any
from uuid import UUID

from farmacograph.db.neo4j.driver import Neo4jDriver


def _unwrap_single_node(rows: list[dict[str, Any]]) -> dict[str, Any] | None:
    """Unwrap ``RETURN d`` rows shaped ``{"d": {...node props...}}``.

    Without this, callers receive the envelope and every property lookup
    (slug, half_life, ...) silently yields None.
    """
    if not rows:
        return None
    node = rows[0].get("d", rows[0])
    return dict(node) if isinstance(node, dict) else None


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
        search: str | None = None,
    ) -> list[dict[str, Any]]:
        if not self.is_available:
            return []
        query = """
        MATCH (d:Drug)
        WHERE ($module IS NULL OR d.module = $module)
          AND ($dataset_version IS NULL OR d.dataset_version = $dataset_version OR d.source = 'primekg')
          AND (d.status = 'published' OR d.status IS NULL)
          AND (
            $search IS NULL
            OR toLower(d.slug) CONTAINS toLower($search)
            OR toLower(coalesce(d.generic_name, d.label, d.name, '')) CONTAINS toLower($search)
          )
        RETURN d.id AS id, d.slug AS slug,
               coalesce(d.generic_name, d.label, d.slug, d.name) AS label,
               coalesce(d.status, 'published') AS status,
               coalesce(d.dataset_version, '2026.1.0') AS dataset_version
        ORDER BY coalesce(d.generic_name, d.label, d.slug)
        SKIP $offset LIMIT $limit
        """
        return await self._driver.run_query(
            query,
            {
                "module": module,
                "limit": limit,
                "offset": offset,
                "dataset_version": dataset_version,
                "search": search.strip() if search else None,
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
        return _unwrap_single_node(results)

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
        return _unwrap_single_node(results)

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
            RETURN
              d {{.*, labels: labels(d)}} AS drug,
              [p IN collect(path) WHERE p IS NOT NULL | {{
                nodes: [x IN nodes(p) | x {{.*, labels: labels(x)}}],
                rels: [r IN relationships(p) | r {{.*,
                  rel_type: type(r),
                  start_id: startNode(r).id,
                  end_id: endNode(r).id,
                  start_labels: labels(startNode(r)),
                  end_labels: labels(endNode(r))}}]
              }}] AS paths
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
        nodes: dict[str, dict[str, Any]] = {}
        edges: dict[str, dict[str, Any]] = {}

        def _shape_node(raw: dict[str, Any]) -> dict[str, Any] | None:
            node_id = raw.get("id")
            if not node_id:
                return None
            labels = raw.get("labels") or []
            props = {k: v for k, v in raw.items() if k != "labels"}
            return {
                "id": node_id,
                "labels": labels,
                "entity_type": props.get("entity_type") or (labels[0] if labels else None),
                "label": props.get("label")
                or props.get("generic_name")
                or props.get("slug")
                or node_id,
                "slug": props.get("slug"),
                "properties": props,
            }

        drug_raw = row.get("drug") or {}
        if drug_raw.get("id"):
            shaped = _shape_node(drug_raw)
            if shaped:
                nodes[str(drug_raw["id"])] = shaped
        for path in row.get("paths", []) or []:
            for raw_node in path.get("nodes", []) or []:
                shaped = _shape_node(raw_node)
                if shaped:
                    nodes.setdefault(str(shaped["id"]), shaped)
            for raw_rel in path.get("rels", []) or []:
                start_id, end_id = raw_rel.get("start_id"), raw_rel.get("end_id")
                if not start_id or not end_id:
                    continue
                rel_type = raw_rel.get("rel_type", "RELATED_TO")
                key = f"{start_id}-{rel_type}->{end_id}"
                if key in edges:
                    continue
                props = {
                    k: v
                    for k, v in raw_rel.items()
                    if k
                    not in ("rel_type", "start_id", "end_id", "start_labels", "end_labels")
                }
                start_labels = raw_rel.get("start_labels") or []
                end_labels = raw_rel.get("end_labels") or []
                edges[key] = {
                    "id": key,
                    "relationship_type": rel_type,
                    "source_id": start_id,
                    "target_id": end_id,
                    "source_type": start_labels[0] if start_labels else None,
                    "target_type": end_labels[0] if end_labels else None,
                    "properties": props,
                }
        node_list = list(nodes.values())
        edge_list = [edge for edge in edges.values() if edge.get("id")]
        return {
            "nodes": node_list,
            "edges": edge_list,
            "layout_hint": "dagre",
            "depth": bounded_depth,
            "neo4j_available": True,
            "drug_in_graph": len(node_list) > 0,
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
            RETURN
              root.id AS root_fragment_id,
              labels(root) AS root_labels,
              root {.*} AS root_node,
              rootRel {.*} AS root_rel,
              d.id AS drug_id,
              coalesce(d.entity_type, "Drug") AS drug_entity_type,
              [p IN collect(path) WHERE p IS NOT NULL | {
                nodes: [x IN nodes(p) | x {.*, labels: labels(x)}],
                rels: [r IN relationships(p) | r {.*,
                  rel_type: type(r),
                  start_id: startNode(r).id,
                  end_id: endNode(r).id,
                  start_labels: labels(startNode(r)),
                  end_labels: labels(endNode(r))}]
              }] AS paths
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
        nodes: dict[str, dict[str, Any]] = {}
        edges: dict[str, dict[str, Any]] = {}

        def _node_shape(raw: dict[str, Any]) -> dict[str, Any] | None:
            node_id = raw.get("id")
            if not node_id:
                return None
            labels = raw.get("labels") or []
            props = {k: v for k, v in raw.items() if k != "labels"}
            return {
                "id": node_id,
                "labels": labels,
                "entity_type": props.get("entity_type")
                or (labels[0] if labels else "MechanismFragment"),
                "label": props.get("label") or props.get("slug") or node_id,
                "slug": props.get("slug"),
                "properties": props,
            }

        root_node = row.get("root_node") or {}
        if root_node.get("id"):
            shaped = _node_shape({**root_node, "labels": row.get("root_labels") or []})
            if shaped:
                nodes[str(root_node["id"])] = shaped
        root_rel = row.get("root_rel") or {}
        if root_rel and row.get("root_fragment_id"):
            edges[f"root->{row['root_fragment_id']}"] = {
                "id": f"{row.get('drug_id')}->HAS_MECHANISM_ROOT->{row['root_fragment_id']}",
                "relationship_type": "HAS_MECHANISM_ROOT",
                "source_id": row.get("drug_id"),
                "target_id": row.get("root_fragment_id"),
                "source_type": row.get("drug_entity_type") or "Drug",
                "target_type": "MechanismFragment",
                "properties": {k: v for k, v in root_rel.items()},
            }
        for path in row.get("paths", []) or []:
            for raw_node in path.get("nodes", []) or []:
                shaped = _node_shape(raw_node)
                if shaped:
                    nodes.setdefault(str(shaped["id"]), shaped)
            for raw_rel in path.get("rels", []) or []:
                start_id, end_id = raw_rel.get("start_id"), raw_rel.get("end_id")
                if not start_id or not end_id:
                    continue
                rel_type = raw_rel.get("rel_type", "PRECEDES")
                key = f"{start_id}-{rel_type}->{end_id}"
                if key in edges:
                    continue
                props = {
                    k: v
                    for k, v in raw_rel.items()
                    if k
                    not in (
                        "rel_type",
                        "start_id",
                        "end_id",
                        "start_labels",
                        "end_labels",
                    )
                }
                start_labels = raw_rel.get("start_labels") or []
                end_labels = raw_rel.get("end_labels") or []
                edges[key] = {
                    "id": key,
                    "relationship_type": rel_type,
                    "source_id": start_id,
                    "target_id": end_id,
                    "source_type": start_labels[0] if start_labels else "MechanismFragment",
                    "target_type": end_labels[0] if end_labels else "MechanismFragment",
                    "properties": props,
                }
        node_list = list(nodes.values())
        edge_list = [edge for edge in edges.values() if edge.get("id")]
        return {
            "drug_id": str(drug_id),
            "root_fragment_id": row.get("root_fragment_id"),
            "nodes": node_list,
            "edges": edge_list,
            "clinical_outcomes": [
                node["id"]
                for node in node_list
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

    async def get_interactions_between(
        self, drug_ids: list[str]
    ) -> list[dict[str, Any]]:
        """Curator-entered and PrimeKG INTERACTS_WITH edges with both endpoints in the set."""
        if not self.is_available or not drug_ids:
            return []
        rows = await self._driver.run_query(
            """
            MATCH (a:Drug)-[r:INTERACTS_WITH]-(b:Drug)
            WHERE a.id IN $ids AND b.id IN $ids AND a.id < b.id
            RETURN a.id AS source_id, b.id AS target_id,
                   coalesce(a.generic_name, a.label, a.slug, a.name) AS drug_a_name,
                   coalesce(b.generic_name, b.label, b.slug, b.name) AS drug_b_name,
                   r {.*} AS properties
            """,
            {"ids": [str(did) for did in drug_ids]},
        )
        return [
            {
                "source_id": row.get("source_id"),
                "target_id": row.get("target_id"),
                "drug_a_name": row.get("drug_a_name"),
                "drug_b_name": row.get("drug_b_name"),
                "properties": row.get("properties") or {},
            }
            for row in rows
        ]

    async def get_mechanism_subgraph(
        self, drug_ref: str
    ) -> dict[str, Any]:
        """Fetch multi-scale biological mechanism subgraph for a drug: Target -> Pathway -> Disease/Adverse."""
        if not self.is_available:
            return {"nodes": [], "edges": []}

        query = """
        MATCH (d:Drug)
        WHERE d.id = $ref OR d.slug = $ref OR toLower(coalesce(d.generic_name, d.label, '')) = toLower($ref)
        WITH collect(d) AS drugs, head(collect(d)) AS main_drug
        UNWIND drugs AS d
        OPTIONAL MATCH (d)-[:TARGETS]->(t:Target)
        OPTIONAL MATCH (t)-[:PART_OF_PATHWAY]->(p:Pathway)
        OPTIONAL MATCH (d)-[:TREATS]->(dis:Disease)
        OPTIONAL MATCH (d)-[:CAUSES_ADVERSE_EFFECT]->(adv:AdverseEffect)
        WITH main_drug,
             collect(DISTINCT t)[0..10] AS targets,
             collect(DISTINCT p)[0..8] AS pathways,
             collect(DISTINCT dis)[0..8] AS diseases,
             collect(DISTINCT adv)[0..8] AS adverse_effects,
             [link IN collect(DISTINCT CASE WHEN t IS NOT NULL AND p IS NOT NULL THEN {target_id: t.id, pathway_id: p.id} END) WHERE link IS NOT NULL][0..20] AS tp_links
        RETURN main_drug, targets, pathways, diseases, adverse_effects, tp_links
        """
        rows = await self._driver.run_query(query, {"ref": drug_ref})
        if not rows or not rows[0].get("main_drug"):
            return {"nodes": [], "edges": []}

        row = rows[0]
        drug_node = dict(row.get("main_drug") or {})
        drug_id = str(drug_node.get("id") or drug_ref)
        drug_name = str(drug_node.get("generic_name") or drug_node.get("label") or drug_node.get("slug") or "Drug")

        nodes: list[dict[str, Any]] = [
            {
                "id": drug_id,
                "label": drug_name,
                "type": "drug",
                "color": "bg-blue-600",
            }
        ]
        edges: list[dict[str, Any]] = []

        # Targets
        target_ids = set()
        for t in row.get("targets", []):
            if not t or not t.get("id"):
                continue
            tid = str(t["id"])
            target_ids.add(tid)
            tname = str(t.get("label") or t.get("name") or t.get("slug") or "Target")
            nodes.append({"id": tid, "label": f"Hedef: {tname}", "type": "target", "color": "bg-indigo-500"})
            edges.append({"id": f"e-{drug_id}-{tid}", "source": drug_id, "target": tid, "label": "TARGETS"})

        # Pathways
        pathway_ids = set()
        for p in row.get("pathways", []):
            if not p or not p.get("id"):
                continue
            pid = str(p["id"])
            pathway_ids.add(pid)
            pname = str(p.get("label") or p.get("name") or p.get("slug") or "Pathway")
            nodes.append({"id": pid, "label": f"Yolak: {pname}", "type": "mechanism", "color": "bg-purple-500"})

        # Target-Pathway actual edges
        for link in row.get("tp_links", []):
            if not link:
                continue
            t_id = str(link.get("target_id"))
            p_id = str(link.get("pathway_id"))
            if t_id in target_ids and p_id in pathway_ids:
                edge_id = f"e-{t_id}-{p_id}"
                if not any(e["id"] == edge_id for e in edges):
                    edges.append({"id": edge_id, "source": t_id, "target": p_id, "label": "PART_OF"})

        # Fallback if no specific target-pathway edge was captured
        for pid in pathway_ids:
            if not any(e["target"] == pid for e in edges) and target_ids:
                fallback_target = next(iter(target_ids))
                edges.append({"id": f"e-{fallback_target}-{pid}", "source": fallback_target, "target": pid, "label": "PART_OF"})

        # Diseases (Indications)
        for dis in row.get("diseases", []):
            if not dis or not dis.get("id"):
                continue
            did = str(dis["id"])
            dname = str(dis.get("label") or dis.get("name") or dis.get("slug") or "Disease")
            nodes.append({"id": did, "label": f"Endikasyon: {dname}", "type": "outcome", "color": "bg-emerald-500"})
            edges.append({"id": f"e-{drug_id}-{did}", "source": drug_id, "target": did, "label": "TREATS"})

        # Adverse effects
        for adv in row.get("adverse_effects", []):
            if not adv or not adv.get("id"):
                continue
            aid = str(adv["id"])
            aname = str(adv.get("label") or adv.get("name") or adv.get("slug") or "Adverse Effect")
            nodes.append({"id": aid, "label": f"Yan Etki: {aname}", "type": "adverse", "color": "bg-red-500"})
            edges.append({"id": f"e-{drug_id}-{aid}", "source": drug_id, "target": aid, "label": "CAUSES"})

        return {"nodes": nodes, "edges": edges}

    async def get_drugs_full_profiles(        self,
        drug_ids: list[UUID] | None = None,
        *,
        slugs: list[str] | None = None,
        dataset_version: str | None = None,
    ) -> list[dict[str, Any]]:
        """Fetch properties, BELONGS_TO classes, TREATS indications, HAS_MECHANISM_ROOT nodes for multiple drugs."""
        if not self.is_available:
            return []
        if not drug_ids and not slugs:
            return []

        id_strs = [str(did) for did in drug_ids] if drug_ids else []
        slug_list = list(slugs) if slugs else []

        query = """
        MATCH (d:Drug)
        WHERE (
            ($id_strs IS NOT NULL AND size($id_strs) > 0 AND d.id IN $id_strs)
            OR ($slug_list IS NOT NULL AND size($slug_list) > 0 AND d.slug IN $slug_list)
        )
        AND ($dv IS NULL OR d.dataset_version = $dv)
        OPTIONAL MATCH (d)-[:BELONGS_TO]->(c:DrugClass)
        OPTIONAL MATCH (d)-[:TREATS]->(i)
        OPTIONAL MATCH (d)-[:HAS_MECHANISM_ROOT]->(m:MechanismFragment)
        WITH d,
             collect(DISTINCT CASE WHEN c IS NOT NULL THEN c {.*} END) AS raw_classes,
             collect(DISTINCT CASE WHEN i IS NOT NULL THEN i {.*} END) AS raw_indications,
             collect(DISTINCT CASE WHEN m IS NOT NULL THEN m {.*} END) AS raw_mechanisms
        RETURN d {.*} AS drug,
               [c IN raw_classes WHERE c IS NOT NULL] AS classes,
               [i IN raw_indications WHERE i IS NOT NULL] AS indications,
               [m IN raw_mechanisms WHERE m IS NOT NULL] AS mechanism_roots
        ORDER BY coalesce(d.generic_name, d.label, d.slug)
        """
        rows = await self._driver.run_query(
            query,
            {"id_strs": id_strs, "slug_list": slug_list, "dv": dataset_version},
        )
        profiles: list[dict[str, Any]] = []
        for row in rows:
            drug_dict = dict(row.get("drug", {}))
            profile = {
                **drug_dict,
                "classes": row.get("classes", []),
                "indications": row.get("indications", []),
                "mechanism_roots": row.get("mechanism_roots", []),
                "drug": drug_dict,
            }
            profiles.append(profile)
        return profiles

