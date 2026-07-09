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
        self, dataset_version: str | None = None, query_time_ms: int | None = None
    ) -> ResponseMeta:
        return ResponseMeta(
            dataset_version=dataset_version
            or self._settings.current_dataset_version
            or "unpublished",
            ontology_version=self._settings.ontology_version,
            query_time_ms=query_time_ms,
            content_layers=[ContentLayer.BIOMEDICAL],
        )

    def _education_meta(
        self, dataset_version: str | None = None, query_time_ms: int | None = None
    ) -> ResponseMeta:
        return ResponseMeta(
            dataset_version=dataset_version
            or self._settings.current_dataset_version
            or "unpublished",
            ontology_version=self._settings.ontology_version,
            query_time_ms=query_time_ms,
            content_layers=[ContentLayer.EDUCATION],
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
        return summaries, self._meta(dataset_version, elapsed)

    async def get_drug(
        self,
        drug_id: UUID,
        dataset_version: str | None = None,
    ) -> tuple[dict[str, Any], ResponseMeta]:
        import time

        start = time.perf_counter()
        drug = await self._graph.get_drug_by_id(drug_id, dataset_version)
        if drug is None:
            raise NotFoundError(f"Drug not found: {drug_id}")
        elapsed = int((time.perf_counter() - start) * 1000)
        return drug, self._meta(dataset_version, elapsed)

    async def get_drug_education(
        self,
        drug_id: UUID,
        dataset_version: str | None = None,
    ) -> tuple[list[dict[str, Any]], ResponseMeta]:
        import time

        start = time.perf_counter()
        rows = await self._graph.get_drug_education(drug_id, dataset_version)
        elapsed = int((time.perf_counter() - start) * 1000)
        education = [row.get("education", row) for row in rows]
        return education, self._education_meta(dataset_version, elapsed)

    async def get_drug_flashcards(
        self,
        drug_id: UUID,
        dataset_version: str | None = None,
    ) -> tuple[list[dict[str, Any]], ResponseMeta]:
        education, meta = await self.get_drug_education(drug_id, dataset_version)
        return [item for item in education if item.get("kind") == "Flashcard"], meta
