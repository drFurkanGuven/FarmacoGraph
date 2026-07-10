"""Explain service — Explain API product (service contract)."""

from __future__ import annotations

from typing import Any, Protocol, runtime_checkable
from uuid import UUID

from farmacograph.api.schemas.responses import (
    EntitySummary,
    ExplainResponse,
    ExplainStep,
    ResponseMeta,
)
from farmacograph.core.exceptions import NoPathError
from farmacograph.models.enums import ContentLayer, EntityType
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
        if question_type == "mechanism" and effect is None:
            response = await self._explain_mechanism(drug)
            meta = ResponseMeta(
                dataset_version="unpublished",
                ontology_version="1.0.0",
                content_layers=[ContentLayer.BIOMEDICAL],
            )
            return response, meta

        paths = await self._graph.find_explain_path(drug, effect)
        if not paths:
            raise NoPathError(f"No validated path for drug={drug} effect={effect}")

        question = (
            f"Why does {drug} cause {effect}?" if effect else f"Explain {drug} {question_type}"
        )
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

    async def _explain_mechanism(self, drug_ref: str) -> ExplainResponse:
        drug_node = await self._resolve_drug(drug_ref)
        if not drug_node:
            raise NoPathError(f"No validated mechanism path for drug={drug_ref}")

        drug_id = UUID(str(drug_node["id"]))
        mechanism = await self._graph.get_drug_mechanism_dag(drug_id)
        nodes = mechanism.get("nodes") or []
        edges = mechanism.get("edges") or []
        root_id = mechanism.get("root_fragment_id")
        if not root_id:
            raise NoPathError(f"No validated mechanism path for drug={drug_ref}")

        node_by_id = {str(node.get("id")): node for node in nodes if node.get("id")}
        root_node = node_by_id.get(str(root_id)) or {
            "id": root_id,
            "entity_type": "MechanismFragment",
            "label": "Mechanism root",
            "slug": None,
            "properties": {},
        }

        root_edge = next(
            (
                edge
                for edge in edges
                if edge.get("relationship_type") == "HAS_MECHANISM_ROOT"
                and str(edge.get("target_id")) == str(root_id)
            ),
            {},
        )
        explanation = _edge_explanation(
            root_edge,
            fallback=f"{_node_label(drug_node)} is linked to the mechanism fragment {_node_label(root_node)}.",
        )
        step = ExplainStep(
            step=1,
            from_entity=_entity_summary(drug_node, EntityType.DRUG),
            relationship="HAS_MECHANISM_ROOT",
            to_entity=_entity_summary(root_node, EntityType.MECHANISM_FRAGMENT),
            explanation=explanation,
            evidence_ids=_edge_evidence_ids(root_edge),
        )
        return ExplainResponse(
            question=f"Explain {drug_ref} mechanism",
            answer_summary=f"{_node_label(drug_node)} mechanism starts at {_node_label(root_node)}.",
            reasoning_chain=[step],
            confidence=_edge_confidence(root_edge),
            evidence_level=_edge_evidence_level(root_edge),
            content_layers=[ContentLayer.BIOMEDICAL],
        )

    async def _resolve_drug(self, drug_ref: str) -> dict[str, Any] | None:
        try:
            row = await self._graph.get_drug_by_id(UUID(drug_ref))
        except ValueError:
            row = await self._graph.get_drug_by_slug(drug_ref)
        if not row:
            return None
        if "d" in row and isinstance(row["d"], dict):
            return row["d"]
        return row


def _node_label(node: dict[str, Any]) -> str:
    return str(node.get("label") or node.get("generic_name") or node.get("slug") or node.get("id"))


def _node_slug(node: dict[str, Any]) -> str:
    return str(node.get("slug") or node.get("id"))


def _entity_summary(node: dict[str, Any], fallback_type: EntityType) -> EntitySummary:
    entity_type = _entity_type(node.get("entity_type"), fallback_type)
    return EntitySummary(
        id=UUID(str(node["id"])),
        type=entity_type,
        slug=_node_slug(node),
        label=_node_label(node),
        status=str(node.get("status") or node.get("properties", {}).get("status") or "published"),
        content_layer=ContentLayer.BIOMEDICAL,
    )


def _entity_type(value: object, fallback: EntityType) -> EntityType:
    try:
        return EntityType(str(value))
    except ValueError:
        return fallback


def _edge_properties(edge: dict[str, Any]) -> dict[str, Any]:
    props = edge.get("properties")
    return props if isinstance(props, dict) else {}


def _edge_explanation(edge: dict[str, Any], *, fallback: str) -> str:
    props = _edge_properties(edge)
    return str(props.get("explanation") or fallback)


def _edge_evidence_ids(edge: dict[str, Any]) -> list[str]:
    ids = _edge_properties(edge).get("evidence_ids")
    return [str(item) for item in ids] if isinstance(ids, list) else []


def _edge_confidence(edge: dict[str, Any]) -> float | None:
    value = _edge_properties(edge).get("confidence_score")
    return float(value) if isinstance(value, (int, float)) else None


def _edge_evidence_level(edge: dict[str, Any]) -> str | None:
    value = _edge_properties(edge).get("evidence_level")
    return str(value) if value is not None else None
