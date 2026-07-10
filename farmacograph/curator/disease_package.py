"""Disease curator packages — shared nodes index + optional on-disk drafts."""

from __future__ import annotations

import json
import os
import re
import uuid
from datetime import UTC, date, datetime
from pathlib import Path
from typing import Any

from pydantic import BaseModel, Field

from farmacograph.curator.drug_package import load_nodes_index
from farmacograph.curator.publish_validator import validate_publish_package
from farmacograph.validators.base import ValidationResult

PROJECT_ROOT = Path(__file__).resolve().parents[2]
CV_DISEASES_DIR = PROJECT_ROOT / "staging" / "cardiovascular" / "diseases"
DEFAULT_DISEASE_RUNTIME_PATH = (
    PROJECT_ROOT / "staging" / "cardiovascular" / "shared" / "diseases.runtime.json"
)
DISEASE_ENTITY_NAMESPACE = uuid.UUID("d1000001-0000-4000-8010-000000000000")
_SLUG_RE = re.compile(r"^[a-z0-9]+(?:-[a-z0-9]+)*$")


class DiseasePublishPackage(BaseModel):
    entity_payload: dict[str, Any]
    related_entities: list[dict[str, Any]] = Field(default_factory=list)
    relationships: list[dict[str, Any]] = Field(default_factory=list)
    dataset_version: str = "2026.1.0"
    module: str | None = "cardiovascular"
    create_snapshot: bool = False


def disease_runtime_path() -> Path:
    override = os.environ.get("FG_DISEASE_CATALOG_PATH", "").strip()
    return Path(override) if override else DEFAULT_DISEASE_RUNTIME_PATH


def allocate_disease_entity_id(slug: str) -> str:
    """Deterministic Disease UUID (uuid5) — stable across register/open/publish."""
    return str(uuid.uuid5(DISEASE_ENTITY_NAMESPACE, slug))


def normalize_disease_slug(raw: str) -> str:
    slug = raw.strip().lower().replace("_", "-").replace(" ", "-")
    slug = re.sub(r"-+", "-", slug).strip("-")
    return slug


def validate_disease_slug(slug: str) -> str:
    normalized = normalize_disease_slug(slug)
    if not normalized or not _SLUG_RE.match(normalized):
        raise ValueError("Disease slug must be lowercase kebab-case (e.g. heart-failure).")
    return normalized


def _load_runtime_diseases(path: Path | None = None) -> list[dict[str, Any]]:
    runtime_path = path or disease_runtime_path()
    if not runtime_path.is_file():
        return []
    try:
        data = json.loads(runtime_path.read_text(encoding="utf-8"))
    except (OSError, json.JSONDecodeError):
        return []
    entities = data.get("entities", []) if isinstance(data, dict) else []
    return [
        entity
        for entity in entities
        if isinstance(entity, dict) and entity.get("entity_type") == "Disease"
    ]


def _save_runtime_diseases(entities: list[dict[str, Any]], path: Path | None = None) -> None:
    runtime_path = path or disease_runtime_path()
    runtime_path.parent.mkdir(parents=True, exist_ok=True)
    payload = {
        "version": "1.0.0",
        "updated_at": datetime.now(UTC).isoformat(),
        "entities": entities,
    }
    runtime_path.write_text(
        json.dumps(payload, indent=2, ensure_ascii=False) + "\n", encoding="utf-8"
    )


def _diseases_from_index(index: dict[str, Any] | None = None) -> list[dict[str, Any]]:
    data = index or load_nodes_index()
    base = [entity for entity in data.get("entities", []) if entity.get("entity_type") == "Disease"]
    by_slug = {entity["slug"]: entity for entity in base if entity.get("slug")}
    for entity in _load_runtime_diseases():
        slug = entity.get("slug")
        if isinstance(slug, str) and slug:
            by_slug[slug] = entity
    return list(by_slug.values())


def _diseases_by_slug(index: dict[str, Any] | None = None) -> dict[str, dict[str, Any]]:
    return {entity["slug"]: entity for entity in _diseases_from_index(index)}


def find_disease_in_index(slug: str, index: dict[str, Any] | None = None) -> dict[str, Any] | None:
    return _diseases_by_slug(index).get(slug)


def known_disease_ids(index: dict[str, Any] | None = None) -> set[str]:
    """Canonical Disease entity IDs from bootstrap index + runtime catalog."""
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
                "status": entity.get("status", "draft"),
            }
        )
    rows.sort(key=lambda row: row["slug"])
    total = len(rows)
    return rows[offset : offset + limit], total


def register_disease(
    *,
    slug: str,
    label: str,
    description: str | None = None,
    icd10: str | None = None,
    mesh: str | None = None,
) -> dict[str, Any]:
    """Register a Disease in the runtime catalog (merged with nodes.index.json)."""
    normalized = validate_disease_slug(slug)
    clean_label = label.strip()
    if not clean_label:
        raise ValueError("Disease label is required.")

    existing = find_disease_in_index(normalized)
    if existing is not None:
        raise ValueError(f"Disease slug already exists: {normalized}")

    entity = {
        "id": allocate_disease_entity_id(normalized),
        "entity_type": "Disease",
        "slug": normalized,
        "label": clean_label,
        "description": (description or "").strip() or None,
        "icd10": (icd10 or "").strip() or None,
        "mesh": (mesh or "").strip() or None,
        "status": "draft",
        "source": "curator_runtime",
    }
    runtime = _load_runtime_diseases()
    runtime.append(entity)
    _save_runtime_diseases(runtime)
    return entity


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
    external_ids = (
        disease.get("external_ids") if isinstance(disease.get("external_ids"), dict) else {}
    )

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
                "icd10": disease.get("icd10") or external_ids.get("icd10"),
                "mesh": disease.get("mesh") or external_ids.get("mesh"),
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
