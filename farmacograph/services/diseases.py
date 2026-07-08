"""Disease service — catalog reads from shared nodes index."""

from __future__ import annotations

from typing import Any
from uuid import UUID

from farmacograph.api.schemas.responses import EntitySummary, ResponseMeta
from farmacograph.core.config import Settings
from farmacograph.core.exceptions import NotFoundError
from farmacograph.curator.disease_package import list_disease_catalog
from farmacograph.models.enums import ContentLayer, EntityType


class DiseaseService:
    def __init__(self, settings: Settings) -> None:
        self._settings = settings

    def _meta(self, query_time_ms: int | None = None) -> ResponseMeta:
        return ResponseMeta(
            dataset_version=self._settings.current_dataset_version or "2026.1.0",
            ontology_version=self._settings.ontology_version,
            query_time_ms=query_time_ms,
            content_layers=[ContentLayer.BIOMEDICAL],
        )

    async def list_diseases(
        self,
        *,
        search: str = "",
        limit: int = 50,
        offset: int = 0,
    ) -> tuple[list[EntitySummary], ResponseMeta, int]:
        import time

        start = time.perf_counter()
        rows, total = list_disease_catalog(search=search, limit=limit, offset=offset)
        elapsed = int((time.perf_counter() - start) * 1000)
        summaries = [
            EntitySummary(
                id=UUID(row["id"]),
                type=EntityType.DISEASE,
                slug=row["slug"],
                label=row["label"],
                status=row.get("status", "published"),
                content_layer=ContentLayer.BIOMEDICAL,
            )
            for row in rows
        ]
        return summaries, self._meta(elapsed), total

    async def get_disease(self, disease_id: UUID) -> tuple[dict[str, Any], ResponseMeta]:
        import time

        start = time.perf_counter()
        rows, _ = list_disease_catalog(limit=10_000, offset=0)
        match = next((row for row in rows if row["id"] == str(disease_id)), None)
        if match is None:
            raise NotFoundError(f"Disease not found: {disease_id}")
        elapsed = int((time.perf_counter() - start) * 1000)
        return match, self._meta(elapsed)
