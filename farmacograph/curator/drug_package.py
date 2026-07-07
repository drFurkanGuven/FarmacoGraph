"""Load and validate curator drug publish packages."""

from __future__ import annotations

import json
from pathlib import Path
from typing import Any

import yaml
from pydantic import BaseModel, Field

from farmacograph.curator.publish_validator import validate_publish_package
from farmacograph.validators.base import ValidationResult

PROJECT_ROOT = Path(__file__).resolve().parents[2]
CV_CURRICULUM_PATH = PROJECT_ROOT / "staging" / "cardiovascular" / "curriculum.yaml"
CV_TEMPLATE_PATH = PROJECT_ROOT / "staging" / "cardiovascular" / "drug-entry.template.json"


class DrugPublishPackage(BaseModel):
    """Curator publish body — matches POST /curator/workflows/{id}/publish."""

    entity_payload: dict[str, Any]
    related_entities: list[dict[str, Any]] = Field(default_factory=list)
    relationships: list[dict[str, Any]] = Field(default_factory=list)
    dataset_version: str = "2026.1.0"
    module: str | None = None
    create_snapshot: bool = False


def load_package(path: str | Path) -> DrugPublishPackage:
    data = json.loads(Path(path).read_text(encoding="utf-8"))
    return DrugPublishPackage.model_validate(data)


def validate_package_file(path: str | Path) -> ValidationResult:
    package = load_package(path)
    return validate_publish_package(
        package.entity_payload,
        related_entities=package.related_entities,
        relationships=package.relationships,
    )


def load_curriculum(path: str | Path | None = None) -> dict[str, Any]:
    curriculum_path = Path(path) if path else CV_CURRICULUM_PATH
    return yaml.safe_load(curriculum_path.read_text(encoding="utf-8"))


def curriculum_stats(curriculum: dict[str, Any]) -> dict[str, Any]:
    total = 0
    by_status: dict[str, int] = {}
    categories: list[dict[str, Any]] = []

    for cat in curriculum.get("categories", []):
        drugs = cat.get("drugs", [])
        cat_pending = sum(1 for d in drugs if d.get("status") == "pending")
        cat_published = sum(1 for d in drugs if d.get("status") == "published")
        total += len(drugs)
        categories.append(
            {
                "slug": cat.get("slug"),
                "name": cat.get("name"),
                "total": len(drugs),
                "pending": cat_pending,
                "published": cat_published,
            }
        )
        for drug in drugs:
            status = drug.get("status", "pending")
            by_status[status] = by_status.get(status, 0) + 1

    return {
        "module": curriculum.get("module"),
        "dataset_version": curriculum.get("dataset_version"),
        "target_count": curriculum.get("target_count", total),
        "total_slugs": total,
        "by_status": by_status,
        "categories": categories,
    }
