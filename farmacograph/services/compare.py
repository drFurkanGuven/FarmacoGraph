"""Compare service — Comparison API product (service contract)."""

from __future__ import annotations

from typing import Any, Protocol, runtime_checkable
from uuid import UUID

from farmacograph.api.schemas.responses import ResponseMeta
from farmacograph.models.enums import ContentLayer
from farmacograph.repositories.graph import GraphRepository


@runtime_checkable
class CompareServiceProtocol(Protocol):
    async def compare(
        self,
        drug_ids: list[UUID],
        dimensions: list[str],
        include_education: bool = False,
    ) -> tuple[dict[str, Any], ResponseMeta]: ...


class CompareService:
    def __init__(self, graph_repo: GraphRepository) -> None:
        self._graph = graph_repo

    async def compare(
        self,
        drug_ids: list[UUID],
        dimensions: list[str],
        include_education: bool = False,
    ) -> tuple[dict[str, Any], ResponseMeta]:
        layers = [ContentLayer.BIOMEDICAL]
        if include_education or "education" in dimensions:
            layers.append(ContentLayer.EDUCATION)

        profiles: list[dict[str, Any]] = []
        if hasattr(self._graph, "get_drugs_full_profiles"):
            try:
                profiles = await self._graph.get_drugs_full_profiles(drug_ids)
            except Exception:
                profiles = []

        # Staging fallback (mirrors InteractionService): curator staging packages
        # fill profiles the graph cannot serve without Neo4j. Flagged in meta so
        # readers never mistake staging content for published graph data.
        used_staging_fallback = False
        found_ids = {str(p.get("id")).lower() for p in profiles if p.get("id")}
        for did in drug_ids:
            if str(did).lower() in found_ids:
                continue
            from farmacograph.curator.drug_package import find_package_by_ref

            pkg = find_package_by_ref(did)
            if pkg is None:
                continue
            used_staging_fallback = True
            payload = pkg.entity_payload
            related = pkg.related_entities or []

            def _related(entity_type: str) -> list[dict[str, Any]]:
                return [
                    {
                        "id": str(e.get("id", "")),
                        "slug": e.get("slug", ""),
                        "label": e.get("label") or e.get("slug", ""),
                    }
                    for e in related
                    if e.get("entity_type") == entity_type
                ]

            profiles.append(
                {
                    "id": payload.get("id"),
                    "slug": payload.get("slug"),
                    "label": payload.get("label") or payload.get("generic_name"),
                    "generic_name": payload.get("generic_name") or payload.get("label"),
                    "status": payload.get("status", "published"),
                    "classes": _related("DrugClass"),
                    "indications": _related("Disease"),
                    "mechanism_roots": _related("MechanismFragment"),
                    "half_life": payload.get("half_life"),
                    "bioavailability": payload.get("bioavailability"),
                    "protein_binding": payload.get("protein_binding"),
                    "onset": payload.get("onset"),
                    "duration": payload.get("duration"),
                    "routes": payload.get("routes", []),
                    "has_black_box_warning": payload.get("has_black_box_warning", False),
                    "black_box_text": payload.get("black_box_text"),
                    "is_high_alert": payload.get("is_high_alert", False),
                }
            )

        profiles_by_id: dict[str, dict[str, Any]] = {
            str(p.get("id")): p for p in profiles if p.get("id") is not None
        }

        comparison: dict[str, Any] = {}
        nodes: list[dict[str, Any]] = []
        edges: list[dict[str, Any]] = []
        seen_node_ids: set[str] = set()

        if not profiles_by_id:
            for dim in dimensions:
                comparison[dim] = {"status": "no_data"}
        else:
            for dim in dimensions:
                dim_lower = dim.lower().strip()
                if dim_lower in ("classes", "class", "drug_classes"):
                    by_drug: dict[str, list[dict[str, Any]]] = {}
                    class_sets: list[set[str]] = []
                    for did in drug_ids:
                        d_str = str(did)
                        p = profiles_by_id.get(d_str, {})
                        cls_list = [
                            {
                                "id": str(c.get("id", "")),
                                "slug": c.get("slug", ""),
                                "label": c.get("label") or c.get("slug", ""),
                            }
                            if isinstance(c, dict)
                            else {"label": str(c), "slug": str(c), "id": str(c)}
                            for c in p.get("classes", [])
                        ]
                        by_drug[d_str] = cls_list
                        class_sets.append({c["label"] for c in cls_list if c.get("label")})

                    shared = list(set.intersection(*class_sets)) if class_sets else []
                    comparison[dim] = {
                        "status": "available",
                        "by_drug": by_drug,
                        "shared": shared,
                    }

                elif dim_lower in ("indications", "indication", "diseases"):
                    by_drug_ind: dict[str, list[dict[str, Any]]] = {}
                    indication_sets: list[set[str]] = []
                    for did in drug_ids:
                        d_str = str(did)
                        p = profiles_by_id.get(d_str, {})
                        ind_list = [
                            {
                                "id": str(i.get("id", "")),
                                "slug": i.get("slug", ""),
                                "label": i.get("label") or i.get("slug", ""),
                            }
                            if isinstance(i, dict)
                            else {"label": str(i), "slug": str(i), "id": str(i)}
                            for i in p.get("indications", [])
                        ]
                        by_drug_ind[d_str] = ind_list
                        indication_sets.append({i["label"] for i in ind_list if i.get("label")})

                    shared = list(set.intersection(*indication_sets)) if indication_sets else []
                    comparison[dim] = {
                        "status": "available",
                        "by_drug": by_drug_ind,
                        "shared": shared,
                    }

                elif dim_lower in ("pharmacokinetics", "pk", "pharmacokinetic"):
                    by_drug_pk: dict[str, dict[str, Any]] = {}
                    for did in drug_ids:
                        d_str = str(did)
                        p = profiles_by_id.get(d_str, {})
                        by_drug_pk[d_str] = {
                            "half_life": p.get("half_life"),
                            "bioavailability": p.get("bioavailability"),
                            "protein_binding": p.get("protein_binding"),
                            "onset": p.get("onset"),
                            "duration": p.get("duration"),
                            "routes": p.get("routes", []),
                        }
                    comparison[dim] = {
                        "status": "available",
                        "by_drug": by_drug_pk,
                    }

                elif dim_lower in ("warnings", "black_box_warnings", "warning", "safety"):
                    by_drug_warn: dict[str, dict[str, Any]] = {}
                    for did in drug_ids:
                        d_str = str(did)
                        p = profiles_by_id.get(d_str, {})
                        by_drug_warn[d_str] = {
                            "has_black_box_warning": bool(p.get("has_black_box_warning", False)),
                            "black_box_text": p.get("black_box_text"),
                            "is_high_alert": bool(p.get("is_high_alert", False)),
                        }
                    comparison[dim] = {
                        "status": "available",
                        "by_drug": by_drug_warn,
                    }

                elif dim_lower in ("mechanisms", "mechanism", "mechanism_roots"):
                    by_drug_mech: dict[str, list[dict[str, Any]]] = {}
                    mech_sets: list[set[str]] = []
                    for did in drug_ids:
                        d_str = str(did)
                        p = profiles_by_id.get(d_str, {})
                        mech_list = [
                            {
                                "id": str(m.get("id", "")),
                                "slug": m.get("slug", ""),
                                "label": m.get("label") or m.get("slug", ""),
                            }
                            if isinstance(m, dict)
                            else {"label": str(m), "slug": str(m), "id": str(m)}
                            for m in p.get("mechanism_roots", [])
                        ]
                        by_drug_mech[d_str] = mech_list
                        mech_sets.append({m["label"] for m in mech_list if m.get("label")})

                    shared = list(set.intersection(*mech_sets)) if mech_sets else []
                    comparison[dim] = {
                        "status": "available",
                        "by_drug": by_drug_mech,
                        "shared": shared,
                    }

                elif dim_lower == "education":
                    edu_data: dict[str, list[Any]] = {}
                    for did in drug_ids:
                        d_str = str(did)
                        if hasattr(self._graph, "get_drug_education"):
                            edu_data[d_str] = [
                                row.get("education", row)
                                for row in await self._graph.get_drug_education(did)
                            ]
                        else:
                            edu_data[d_str] = []
                    comparison[dim] = {
                        "status": "available",
                        "by_drug": edu_data,
                    }

                else:
                    by_drug_prop: dict[str, Any] = {}
                    for did in drug_ids:
                        d_str = str(did)
                        p = profiles_by_id.get(d_str, {})
                        if dim in p:
                            by_drug_prop[d_str] = p[dim]
                        elif dim_lower in p:
                            by_drug_prop[d_str] = p[dim_lower]
                        else:
                            by_drug_prop[d_str] = None
                    comparison[dim] = {
                        "status": (
                            "available"
                            if any(v is not None for v in by_drug_prop.values())
                            else "no_data"
                        ),
                        "by_drug": by_drug_prop,
                    }

            # Build comparison subgraph
            for did in drug_ids:
                d_str = str(did)
                p = profiles_by_id.get(d_str)
                if not p:
                    continue
                if d_str not in seen_node_ids:
                    nodes.append({
                        "id": d_str,
                        "label": p.get("label") or p.get("generic_name") or p.get("slug", d_str),
                        "entity_type": "Drug",
                        "slug": p.get("slug", ""),
                    })
                    seen_node_ids.add(d_str)

                for c in p.get("classes", []):
                    c_id = (
                        str(c.get("id"))
                        if isinstance(c, dict) and c.get("id")
                        else f"class-{c.get('slug', c)}"
                        if isinstance(c, dict)
                        else f"class-{c}"
                    )
                    if c_id not in seen_node_ids:
                        nodes.append({
                            "id": c_id,
                            "label": (
                                c.get("label") or c.get("slug", c_id)
                                if isinstance(c, dict)
                                else str(c)
                            ),
                            "entity_type": "DrugClass",
                            "slug": c.get("slug", "") if isinstance(c, dict) else str(c),
                        })
                        seen_node_ids.add(c_id)
                    edges.append({
                        "relationship_type": "BELONGS_TO",
                        "source_id": d_str,
                        "target_id": c_id,
                    })

                for ind in p.get("indications", []):
                    ind_id = (
                        str(ind.get("id"))
                        if isinstance(ind, dict) and ind.get("id")
                        else f"ind-{ind.get('slug', ind)}"
                        if isinstance(ind, dict)
                        else f"ind-{ind}"
                    )
                    if ind_id not in seen_node_ids:
                        nodes.append({
                            "id": ind_id,
                            "label": (
                                ind.get("label") or ind.get("slug", ind_id)
                                if isinstance(ind, dict)
                                else str(ind)
                            ),
                            "entity_type": "Indication",
                            "slug": ind.get("slug", "") if isinstance(ind, dict) else str(ind),
                        })
                        seen_node_ids.add(ind_id)
                    edges.append({
                        "relationship_type": "TREATS",
                        "source_id": d_str,
                        "target_id": ind_id,
                    })

                for m in p.get("mechanism_roots", []):
                    m_id = (
                        str(m.get("id"))
                        if isinstance(m, dict) and m.get("id")
                        else f"mech-{m.get('slug', m)}"
                        if isinstance(m, dict)
                        else f"mech-{m}"
                    )
                    if m_id not in seen_node_ids:
                        nodes.append({
                            "id": m_id,
                            "label": (
                                m.get("label") or m.get("slug", m_id)
                                if isinstance(m, dict)
                                else str(m)
                            ),
                            "entity_type": "MechanismFragment",
                            "slug": m.get("slug", "") if isinstance(m, dict) else str(m),
                        })
                        seen_node_ids.add(m_id)
                    edges.append({
                        "relationship_type": "HAS_MECHANISM_ROOT",
                        "source_id": d_str,
                        "target_id": m_id,
                    })

        result: dict[str, Any] = {
            "drug_ids": [str(d) for d in drug_ids],
            "dimensions": dimensions,
            "comparison": comparison,
            "subgraph": {"nodes": nodes, "edges": edges},
        }
        if include_education:
            result["education"] = {
                str(drug_id): [
                    row.get("education", row)
                    for row in await self._graph.get_drug_education(drug_id)
                ]
                if hasattr(self._graph, "get_drug_education")
                else []
                for drug_id in drug_ids
            }
        meta = ResponseMeta(
            dataset_version="unpublished",
            ontology_version="1.0.0",
            content_layers=layers,
            provenance="staging-fallback" if used_staging_fallback else None,
        )
        return result, meta

