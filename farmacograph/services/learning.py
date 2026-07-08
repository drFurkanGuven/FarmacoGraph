"""Learning service — Learning API product (service contract)."""

from __future__ import annotations

from typing import Any, Protocol, runtime_checkable

from farmacograph.api.schemas.responses import ResponseMeta
from farmacograph.models.enums import ContentLayer
from farmacograph.repositories.graph import GraphRepository


@runtime_checkable
class LearningServiceProtocol(Protocol):
    async def get_prerequisites(self, drug_slug: str) -> tuple[dict[str, Any], ResponseMeta]: ...


class LearningService:
    def __init__(self, graph_repo: GraphRepository) -> None:
        self._graph = graph_repo

    async def get_prerequisites(self, drug_slug: str) -> tuple[dict[str, Any], ResponseMeta]:
        topics = await self._graph.get_prerequisites(drug_slug)
        result = {
            "entity_slug": drug_slug,
            "prerequisites": topics,
            "missing_topics": [],
        }
        meta = ResponseMeta(
            dataset_version="unpublished",
            ontology_version="1.0.0",
            content_layers=[ContentLayer.LEARNING],
        )
        return result, meta
