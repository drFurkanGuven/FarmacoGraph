"""Learning service — Learning API product (service contract)."""

from __future__ import annotations

from typing import Any, Protocol, runtime_checkable
from uuid import UUID

from farmacograph.api.schemas.responses import ResponseMeta
from farmacograph.models.enums import ContentLayer
from farmacograph.repositories.graph import GraphRepository


@runtime_checkable
class LearningServiceProtocol(Protocol):
    async def get_prerequisites(self, drug_slug: str) -> tuple[dict[str, Any], ResponseMeta]: ...
    async def get_study_view(self, drug_ref: str) -> tuple[dict[str, Any], ResponseMeta]: ...


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

    async def get_study_view(self, drug_ref: str) -> tuple[dict[str, Any], ResponseMeta]:
        drug = await self._resolve_drug(drug_ref)
        drug_id = str(drug.get("id") or drug_ref)
        drug_slug = str(drug.get("slug") or drug_ref)
        education: list[dict[str, Any]] = []
        try:
            education = [
                row.get("education", row)
                for row in await self._graph.get_drug_education(UUID(drug_id))
            ]
        except ValueError:
            education = []
        flashcards = [item for item in education if item.get("kind") == "Flashcard"]
        prerequisites = await self._graph.get_prerequisites(drug_slug)

        result = {
            "drug": drug,
            "education": education,
            "flashcards": flashcards,
            "prerequisites": prerequisites,
            "study_plan": _build_study_plan(education, prerequisites),
            "content_layers": [
                ContentLayer.BIOMEDICAL,
                ContentLayer.EDUCATION,
                ContentLayer.LEARNING,
            ],
        }
        meta = ResponseMeta(
            dataset_version=str(drug.get("dataset_version") or "unpublished"),
            ontology_version="1.0.0",
            content_layers=[
                ContentLayer.BIOMEDICAL,
                ContentLayer.EDUCATION,
                ContentLayer.LEARNING,
            ],
        )
        return result, meta

    async def _resolve_drug(self, drug_ref: str) -> dict[str, Any]:
        try:
            drug = await self._graph.get_drug_by_id(UUID(drug_ref))
        except ValueError:
            drug = await self._graph.get_drug_by_slug(drug_ref)
        if not drug:
            return {"id": drug_ref, "slug": drug_ref, "label": drug_ref}
        if "d" in drug and isinstance(drug["d"], dict):
            return drug["d"]
        return drug


def _build_study_plan(
    education: list[dict[str, Any]],
    prerequisites: list[dict[str, Any]],
) -> list[dict[str, Any]]:
    plan: list[dict[str, Any]] = []
    if prerequisites:
        plan.append(
            {
                "step": "prerequisites",
                "title": "Review prerequisites",
                "count": len(prerequisites),
            }
        )
    if any(item.get("kind") == "FiveSecondSummary" for item in education):
        plan.append({"step": "recall", "title": "Read the five-second summary"})
    if any(item.get("kind") == "BoardExamPearl" for item in education):
        plan.append({"step": "exam", "title": "Review the board-exam pearl"})
    if any(item.get("kind") == "CommonMistake" for item in education):
        plan.append({"step": "pitfall", "title": "Check the common mistake"})
    flashcard_count = sum(1 for item in education if item.get("kind") == "Flashcard")
    if flashcard_count:
        plan.append({"step": "practice", "title": "Practice flashcards", "count": flashcard_count})
    return plan
