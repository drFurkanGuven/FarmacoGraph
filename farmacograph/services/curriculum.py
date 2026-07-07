"""Curriculum tracking — curation queue progress (no pharmacology content)."""

from __future__ import annotations

from typing import Any

from farmacograph.curator.drug_package import curriculum_stats, load_curriculum
from farmacograph.repositories.graph import GraphRepository


class CurriculumService:
    def __init__(self, graph_repo: GraphRepository) -> None:
        self._graph = graph_repo

    async def get_module_curriculum(self, module: str) -> dict[str, Any]:
        if module != "cardiovascular":
            return {"module": module, "error": "curriculum_not_defined"}

        curriculum = load_curriculum()
        stats = curriculum_stats(curriculum)
        published_in_graph = await self._graph.count_drugs(module=module)

        return {
            "curriculum": curriculum,
            "stats": stats,
            "published_in_graph": published_in_graph,
            "completion_pct": round(
                (published_in_graph / stats["total_slugs"] * 100) if stats["total_slugs"] else 0,
                1,
            ),
        }
