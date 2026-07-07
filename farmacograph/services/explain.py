"""Explain service — Explain API product (service contract)."""

from __future__ import annotations

from typing import Any, Protocol, runtime_checkable

from farmacograph.api.schemas.responses import ExplainResponse, ResponseMeta
from farmacograph.core.exceptions import NoPathError
from farmacograph.models.enums import ContentLayer
from farmacograph.repositories.graph import GraphRepository


@runtime_checkable
class ExplainServiceProtocol(Protocol):
    async def explain(
        self,
        drug: str,
        effect: str | None = None,
        question_type: str = "mechanism",
    ) -> tuple[ExplainResponse, ResponseMeta]: ...


class ExplainService:
    """Traverses knowledge graph for structured reasoning chains."""

    def __init__(self, graph_repo: GraphRepository) -> None:
        self._graph = graph_repo

    async def explain(
        self,
        drug: str,
        effect: str | None = None,
        question_type: str = "mechanism",
    ) -> tuple[ExplainResponse, ResponseMeta]:
        paths = await self._graph.find_explain_path(drug, effect)
        if not paths:
            raise NoPathError(f"No validated path for drug={drug} effect={effect}")

        question = f"Why does {drug} cause {effect}?" if effect else f"Explain {drug} {question_type}"
        response = ExplainResponse(
            question=question,
            answer_summary=None,
            reasoning_chain=[],
            confidence=None,
            evidence_level=None,
            content_layers=[ContentLayer.BIOMEDICAL],
        )
        meta = ResponseMeta(
            dataset_version="unpublished",
            ontology_version="1.0.0",
            content_layers=[ContentLayer.BIOMEDICAL],
        )
        return response, meta
