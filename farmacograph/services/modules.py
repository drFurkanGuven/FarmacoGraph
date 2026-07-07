"""Module service — curriculum module metadata."""

from __future__ import annotations

from typing import Any

from farmacograph.api.schemas.responses import ResponseMeta
from farmacograph.models.enums import ContentLayer

# Static module registry — no drug data, only module definitions
MODULE_REGISTRY: list[dict[str, Any]] = [
    {"slug": "cardiovascular", "name": "Cardiovascular", "status": "planned", "drug_count": 0},
    {"slug": "endocrinology", "name": "Endocrinology", "status": "planned", "drug_count": 0},
    {"slug": "infectious-diseases", "name": "Infectious Diseases", "status": "planned", "drug_count": 0},
    {"slug": "neurology", "name": "Neurology", "status": "planned", "drug_count": 0},
    {"slug": "psychiatry", "name": "Psychiatry", "status": "planned", "drug_count": 0},
]


class ModuleService:
    async def list_modules(self) -> tuple[list[dict[str, Any]], ResponseMeta]:
        meta = ResponseMeta(
            dataset_version="unpublished",
            ontology_version="1.0.0",
            content_layers=[ContentLayer.BIOMEDICAL],
        )
        return MODULE_REGISTRY, meta
