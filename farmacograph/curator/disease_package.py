"""Disease curator packages — shared nodes index + optional on-disk drafts."""

from __future__ import annotations

import json
from datetime import UTC, date, datetime
from pathlib import Path
from typing import Any

from pydantic import BaseModel, Field

from farmacograph.curator.drug_package import load_nodes_index
from farmacograph.curator.publish_validator import validate_publish_package
from farmacograph.validators.base import ValidationResult

PROJECT_ROOT = Path(__file__).resolve().parents[2]
CV_DISEASES_DIR = PROJECT_ROOT / "staging" / "cardiovascular" / "diseases"


class DiseasePublishPackage(BaseModel):
    entity_payload: dict[str, Any]
    related_entities: list[dict[str, Any]] = Field(default_factory=list)
    relationships: list[dict[str, Any]] = Field(default_factory=list)
    dataset_version: str = "2026.1.0"
    module: str | None = "cardiovascular"
    create_snapshot: bool = False


def _diseases_from_index(index: dict[str, Any] | None = None) -> list[dict[str, Any]]:
    data = index or load_nodes_index()
    return [entity for entity in data.get("entities", []) if entity.get("entity_type") == "Disease"]


def _diseases_by_slug(index: dict[str, Any] | None = None) -> dict[str, dict[str, Any]]:
    return {entity["slug"]: entity for entity in _diseases_from_index(index)}


def find_disease_in_index(slug: str, index: dict[str, Any] | None = None) -> dict[str, Any] | None:
    return _diseases_by_slug(index).get(slug)


def known_disease_ids(index: dict[str, Any] | None = None) -> set[str]:
    """Canonical Disease entity IDs from the bootstrap nodes index catalog."""
    return {entity["id"] for entity in _diseases_from_index(index)}


def is_known_disease_id(entity_id: str, index: dict[str, Any] | None = None) -> bool:
    return entity_id in known_disease_ids(index)


def disease_entity_id(slug: str, index: dict[str, Any] | None = None) -> str:
    disease = find_disease_in_index(slug, index)
    if disease is None:
        raise ValueError(f"Disease slug not in nodes index: {slug}")
    return disease["id"]


def list_disease_catalog(
    *, search: str = "", limit: int = 50, offset: int = 0
) -> tuple[list[dict[str, Any]], int]:
    needle = search.strip().lower()
    rows: list[dict[str, Any]] = []
    for entity in _diseases_from_index():
        slug = entity["slug"]
        label = entity.get("label", slug.replace("-", " ").title())
        if needle and needle not in slug.lower() and needle not in label.lower():
            continue
        rows.append(
            {
                "id": entity["id"],
                "slug": slug,
                "label": label,
                "entity_type": "Disease",
                "description": entity.get("description"),
                "status": entity.get("status", "published"),
            }
        )
    rows.sort(key=lambda row: row["slug"])
    total = len(rows)
    return rows[offset : offset + limit], total


def load_disease_package(path: str | Path) -> DiseasePublishPackage:
    data = json.loads(Path(path).read_text(encoding="utf-8"))
    return DiseasePublishPackage.model_validate(data)


def validate_disease_package_file(path: str | Path) -> ValidationResult:
    package = load_disease_package(path)
    return validate_publish_package(
        package.entity_payload,
        related_entities=package.related_entities,
        relationships=package.relationships,
    )


def build_disease_entry_package(
    slug: str, *, index: dict[str, Any] | None = None
) -> dict[str, Any]:
    disease = find_disease_in_index(slug, index)
    if disease is None:
        raise ValueError(f"Disease slug not in nodes index: {slug}")

    entity_id = disease["id"]
    label = disease.get("label", slug.replace("-", " ").title())
    now = datetime.now(UTC).isoformat()
    today = date.today().isoformat()

    return {
        "module": "cardiovascular",
        "dataset_version": "2026.1.0",
        "create_snapshot": False,
        "entity_payload": {
            "id": entity_id,
            "entity_type": "Disease",
            "slug": slug,
            "label": label,
            "description": disease.get("description") or "",
            "prevalence_note": None,
            "status": "draft",
            "dataset_version": "2026.1.0",
            "external_ids": {
                "icd10": disease.get("icd10"),
                "mesh": disease.get("mesh"),
            },
            "provenance": {
                "created_at": now,
                "updated_at": now,
                "created_by": "curator-system",
                "source": "manual",
                "curator_attestation": False,
            },
            "versioning": {
                "dataset_version": "2026.1.0",
                "ontology_version": "1.0.0",
                "valid_from": today,
                "status": "draft",
                "validation_state": "pending",
            },
            "relationships": {},
        },
        "related_entities": [],
        "relationships": [],
    }
