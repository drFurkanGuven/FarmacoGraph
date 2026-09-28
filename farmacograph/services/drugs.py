"""Drug service — Core API product."""

from __future__ import annotations

from typing import Any
from uuid import UUID

from farmacograph.api.schemas.responses import EntitySummary, ResponseMeta
from farmacograph.core.config import Settings
from farmacograph.core.exceptions import NotFoundError
from farmacograph.models.enums import ContentLayer, EntityType
from farmacograph.repositories.graph import GraphRepository


class DrugService:
    def __init__(self, graph_repo: GraphRepository, settings: Settings) -> None:
        self._graph = graph_repo
        self._settings = settings

    def _meta(
        self,
        dataset_version: str | None = None,
        query_time_ms: int | None = None,
        provenance: str | None = None,
    ) -> ResponseMeta:
        return ResponseMeta(
            dataset_version=dataset_version
            or self._settings.current_dataset_version
            or "unpublished",
            ontology_version=self._settings.ontology_version,
            query_time_ms=query_time_ms,
            content_layers=[ContentLayer.BIOMEDICAL],
            provenance=provenance,
        )

    def _education_meta(
        self,
        dataset_version: str | None = None,
        query_time_ms: int | None = None,
        provenance: str | None = None,
    ) -> ResponseMeta:
        return ResponseMeta(
            dataset_version=dataset_version
            or self._settings.current_dataset_version
            or "unpublished",
            ontology_version=self._settings.ontology_version,
            query_time_ms=query_time_ms,
            content_layers=[ContentLayer.EDUCATION],
            provenance=provenance,
        )

    def _graph_meta(
        self,
        dataset_version: str | None = None,
        query_time_ms: int | None = None,
        provenance: str | None = None,
    ) -> ResponseMeta:
        return ResponseMeta(
            dataset_version=dataset_version
            or self._settings.current_dataset_version
            or "unpublished",
            ontology_version=self._settings.ontology_version,
            query_time_ms=query_time_ms,
            content_layers=[ContentLayer.BIOMEDICAL],
            provenance=provenance,
        )

    async def list_drugs(
        self,
        *,
        module: str | None = None,
        limit: int = 50,
        offset: int = 0,
        dataset_version: str | None = None,
    ) -> tuple[list[EntitySummary], ResponseMeta]:
        import time

        start = time.perf_counter()
        rows = await self._graph.list_drugs(
            module=module, limit=limit, offset=offset, dataset_version=dataset_version
        )
        provenance: str | None = None
        if not rows:
            from farmacograph.curator.drug_package import CV_DRUGS_DIR, load_package

            if CV_DRUGS_DIR.exists():
                filled = False
                for p in sorted(CV_DRUGS_DIR.glob("*.json")):
                    try:
                        pkg = load_package(p)
                        payload = pkg.entity_payload
                        if module and payload.get("module") != module:
                            continue
                        rows.append(
                            {
                                "id": payload.get("id"),
                                "slug": payload.get("slug"),
                                "label": payload.get("label"),
                                "status": payload.get("status", "published"),
                            }
                        )
                        filled = True
                    except Exception:
                        continue
                if filled:
                    provenance = "staging-fallback"
                if offset:
                    rows = rows[offset:]
                if limit:
                    rows = rows[:limit]
        elapsed = int((time.perf_counter() - start) * 1000)
        summaries = [
            EntitySummary(
                id=UUID(row["id"]) if isinstance(row["id"], str) else row["id"],
                type=EntityType.DRUG,
                slug=row.get("slug", ""),
                label=row.get("label", ""),
                status=row.get("status", "published"),
                content_layer=ContentLayer.BIOMEDICAL,
            )
            for row in rows
        ]
        return summaries, self._meta(dataset_version, elapsed, provenance)

    async def get_drug(
        self,
        drug_id: UUID,
        dataset_version: str | None = None,
    ) -> tuple[dict[str, Any], ResponseMeta]:
        import time

        start = time.perf_counter()
        drug = await self._graph.get_drug_by_id(drug_id, dataset_version)
        provenance: str | None = None
        if drug is None:
            from farmacograph.curator.drug_package import find_package_by_ref

            pkg = find_package_by_ref(drug_id)
            if pkg:
                drug = pkg.entity_payload
                provenance = "staging-fallback"
            else:
                raise NotFoundError(f"Drug not found: {drug_id}")
        elapsed = int((time.perf_counter() - start) * 1000)
        return drug, self._meta(dataset_version, elapsed, provenance)

    async def get_drug_education(
        self,
        drug_id: UUID,
        dataset_version: str | None = None,
    ) -> tuple[list[dict[str, Any]], ResponseMeta]:
        import time

        start = time.perf_counter()
        rows = await self._graph.get_drug_education(drug_id, dataset_version)
        provenance: str | None = None
        if not rows:
            # Staging fallback: curator staging packages carry education items
            # readable without Neo4j. Flagged so readers never mistake staging
            # content for published graph data.
            from farmacograph.curator.drug_package import find_package_by_ref

            pkg = find_package_by_ref(drug_id)
            if pkg is not None:
                staged = list(pkg.education or []) + [
                    e
                    for e in (pkg.related_entities or [])
                    if e.get("entity_type") == "EducationResource"
                ]
                seen: set[str] = set()
                rows = []
                for e in staged:
                    if not isinstance(e, dict):
                        continue
                    key = str(e.get("id") or e.get("slug") or len(rows))
                    if key in seen:
                        continue
                    seen.add(key)
                    rows.append({"education": e})
                if rows:
                    provenance = "staging-fallback"
        elapsed = int((time.perf_counter() - start) * 1000)
        education = [row.get("education", row) for row in rows]
        return education, self._education_meta(dataset_version, elapsed, provenance)

    async def get_drug_flashcards(
        self,
        drug_id: UUID,
        dataset_version: str | None = None,
    ) -> tuple[list[dict[str, Any]], ResponseMeta]:
        education, meta = await self.get_drug_education(drug_id, dataset_version)
        return [item for item in education if item.get("kind") == "Flashcard"], meta

    async def get_drug_graph(
        self,
        drug_id: UUID,
        *,
        depth: int = 2,
        dataset_version: str | None = None,
    ) -> tuple[dict[str, Any], ResponseMeta]:
        import time

        start = time.perf_counter()
        graph = await self._graph.get_drug_graph_projection(
            drug_id,
            depth=depth,
            dataset_version=dataset_version,
        )
        if not graph.get("nodes"):
            from farmacograph.curator.drug_package import extract_drug_graph_projection, find_package_by_ref

            pkg = find_package_by_ref(drug_id)
            if pkg:
                graph = extract_drug_graph_projection(pkg, depth=depth)
                graph["provenance"] = "staging-fallback"
        elapsed = int((time.perf_counter() - start) * 1000)
        provenance = graph.pop("provenance", None)
        return graph, self._graph_meta(dataset_version, elapsed, provenance)

    async def get_drug_mechanism(
        self,
        drug_id: UUID,
        *,
        dataset_version: str | None = None,
    ) -> tuple[dict[str, Any], ResponseMeta]:
        import time

        start = time.perf_counter()
        mechanism = await self._graph.get_drug_mechanism_dag(
            drug_id,
            dataset_version=dataset_version,
        )
        if not mechanism.get("nodes"):
            from farmacograph.curator.drug_package import extract_mechanism_dag, find_package_by_ref

            pkg = find_package_by_ref(drug_id)
            if pkg:
                mechanism = extract_mechanism_dag(pkg)
                mechanism["provenance"] = "staging-fallback"
        elapsed = int((time.perf_counter() - start) * 1000)
        provenance = mechanism.pop("provenance", None)
        return mechanism, self._graph_meta(dataset_version, elapsed, provenance)
