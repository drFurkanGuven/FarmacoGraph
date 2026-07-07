"""Reasoning service — Reasoning API product (service contract)."""

from __future__ import annotations

from typing import Any, Protocol, runtime_checkable

from farmacograph.api.schemas.responses import ResponseMeta
from farmacograph.models.enums import ContentLayer
from farmacograph.repositories.graph import GraphRepository
from farmacograph.services.explain import ExplainService


@runtime_checkable
class ReasoningServiceProtocol(Protocol):
    async def reason(self, question: str, context: dict[str, Any] | None = None) -> tuple[dict[str, Any], ResponseMeta]: ...


class ReasoningService:
    """Orchestrates explain + graph traversal for future RAG pipeline."""

    def __init__(self, explain_service: ExplainService, graph_repo: GraphRepository) -> None:
        self._explain = explain_service
        self._graph = graph_repo

    async def reason(
        self,
        question: str,
        context: dict[str, Any] | None = None,
    ) -> tuple[dict[str, Any], ResponseMeta]:
        result: dict[str, Any] = {
            "question": question,
            "status": "not_implemented",
            "message": "Reasoning API available in a future release. Use /explain for structured chains.",
            "context": context or {},
        }
        meta = ResponseMeta(
            dataset_version="unpublished",
            ontology_version="1.0.0",
            content_layers=[ContentLayer.BIOMEDICAL],
        )
        return result, meta
