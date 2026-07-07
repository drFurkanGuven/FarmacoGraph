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
        if include_education:
            layers.append(ContentLayer.EDUCATION)

        result: dict[str, Any] = {
            "drug_ids": [str(d) for d in drug_ids],
            "dimensions": dimensions,
            "comparison": {dim: {"status": "no_data"} for dim in dimensions},
            "subgraph": {"nodes": [], "edges": []},
        }
        meta = ResponseMeta(
            dataset_version="unpublished",
            ontology_version="1.0.0",
            content_layers=layers,
        )
        return result, meta
