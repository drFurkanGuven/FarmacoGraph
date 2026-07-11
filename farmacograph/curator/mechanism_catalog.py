"""Mechanism fragment catalog — shared nodes index + optional runtime registrations."""

from __future__ import annotations

import json
import os
import re
import uuid
from datetime import UTC, datetime
from pathlib import Path
from typing import Any

from farmacograph.curator.drug_package import load_nodes_index

PROJECT_ROOT = Path(__file__).resolve().parents[2]
DEFAULT_MECHANISM_RUNTIME_PATH = (
    PROJECT_ROOT / "staging" / "cardiovascular" / "shared" / "mechanisms.runtime.json"
)
MECHANISM_ENTITY_NAMESPACE = uuid.UUID("c1000001-0000-4000-8010-000000000000")
_SLUG_RE = re.compile(r"^[a-z0-9]+(?:-[a-z0-9]+)*$")


def mechanism_runtime_path() -> Path:
    override = os.environ.get("FG_MECHANISM_CATALOG_PATH", "").strip()
    return Path(override) if override else DEFAULT_MECHANISM_RUNTIME_PATH


def allocate_mechanism_entity_id(slug: str) -> str:
    return str(uuid.uuid5(MECHANISM_ENTITY_NAMESPACE, slug))


def normalize_mechanism_slug(raw: str) -> str:
    slug = raw.strip().lower().replace("_", "-").replace(" ", "-")
    slug = re.sub(r"-+", "-", slug).strip("-")
    return slug


def validate_mechanism_slug(slug: str) -> str:
    normalized = normalize_mechanism_slug(slug)
    if not normalized or not _SLUG_RE.match(normalized):
        raise ValueError(
            "Mechanism fragment slug must be lowercase kebab-case (e.g. ace-inhibition)."
        )
    return normalized


def _load_runtime_fragments(path: Path | None = None) -> list[dict[str, Any]]:
    runtime_path = path or mechanism_runtime_path()
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
        if isinstance(entity, dict) and entity.get("entity_type") == "MechanismFragment"
    ]


def _save_runtime_fragments(entities: list[dict[str, Any]], path: Path | None = None) -> None:
    runtime_path = path or mechanism_runtime_path()
    runtime_path.parent.mkdir(parents=True, exist_ok=True)
    payload = {
        "version": "1.0.0",
        "updated_at": datetime.now(UTC).isoformat(),
        "entities": entities,
    }
    runtime_path.write_text(
        json.dumps(payload, indent=2, ensure_ascii=False) + "\n", encoding="utf-8"
    )


def _fragments_from_index(index: dict[str, Any] | None = None) -> list[dict[str, Any]]:
    data = index or load_nodes_index()
    return [
        entity
        for entity in data.get("entities", [])
        if entity.get("entity_type") == "MechanismFragment"
    ]


def find_mechanism_in_index(
    slug: str, index: dict[str, Any] | None = None
) -> dict[str, Any] | None:
    normalized = normalize_mechanism_slug(slug)
    for entity in [*_fragments_from_index(index), *_load_runtime_fragments()]:
        if entity.get("slug") == normalized:
            return entity
    return None


def list_mechanism_fragment_catalog(
    *, search: str = "", limit: int = 50, offset: int = 0
) -> tuple[list[dict[str, Any]], int]:
    needle = search.strip().lower()
    by_slug: dict[str, dict[str, Any]] = {}
    for entity in [*_fragments_from_index(), *_load_runtime_fragments()]:
        slug = entity["slug"]
        by_slug[slug] = entity

    rows: list[dict[str, Any]] = []
    for entity in by_slug.values():
        slug = entity["slug"]
        label = entity.get("label", slug.replace("-", " ").title())
        if needle and needle not in slug.lower() and needle not in label.lower():
            continue
        rows.append(
            {
                "id": entity["id"],
                "slug": slug,
                "label": label,
                "entity_type": "MechanismFragment",
                "description": entity.get("description"),
                "status": entity.get("status", "published"),
            }
        )
    rows.sort(key=lambda row: row["slug"])
    total = len(rows)
    return rows[offset : offset + limit], total


def register_mechanism_fragment(
    *,
    slug: str,
    label: str,
    description: str | None = None,
) -> dict[str, Any]:
    """Register a MechanismFragment in the runtime catalog (merged with nodes.index.json)."""
    normalized = validate_mechanism_slug(slug)
    clean_label = label.strip()
    if not clean_label:
        raise ValueError("Mechanism fragment label is required.")

    existing = find_mechanism_in_index(normalized)
    if existing is not None:
        raise ValueError(f"Mechanism fragment slug already exists: {normalized}")

    entity = {
        "id": allocate_mechanism_entity_id(normalized),
        "entity_type": "MechanismFragment",
        "slug": normalized,
        "label": clean_label,
        "description": (description or "").strip() or None,
        "status": "draft",
        "source": "curator_runtime",
    }
    runtime = _load_runtime_fragments()
    runtime.append(entity)
    _save_runtime_fragments(runtime)
    return entity
