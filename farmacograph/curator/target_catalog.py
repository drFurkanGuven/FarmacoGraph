"""Target, Receptor, and Enzyme catalog and registry for biomedical knowledge curation."""

from __future__ import annotations

import json
import re
from pathlib import Path
from typing import Any
import uuid

import os
from farmacograph.curator.drug_package import CV_NODES_INDEX_PATH

PROJECT_ROOT = Path(__file__).resolve().parents[2]
DEFAULT_TARGET_RUNTIME_PATH = (
    PROJECT_ROOT / "staging" / "cardiovascular" / ".runtime_targets.json"
)

VALID_MOLECULAR_TYPES = {"TargetProtein", "Receptor", "Enzyme"}
TARGET_ENTITY_NAMESPACE = uuid.UUID("7b89f542-411a-4c20-a6e5-22d7d8e20001")


def target_runtime_path() -> Path:
    override = os.environ.get("FG_TARGET_CATALOG_PATH", "").strip()
    return Path(override) if override else DEFAULT_TARGET_RUNTIME_PATH


def validate_target_slug(slug: str) -> str:
    cleaned = slug.strip()
    if not re.match(r"^[a-z0-9]+(?:-[a-z0-9]+)*$", cleaned):
        raise ValueError(
            f"Invalid target slug '{slug}'. Must be lowercase kebab-case (e.g. adrb1, cyp2d6)."
        )
    return cleaned


def allocate_target_entity_id(slug: str) -> str:
    return str(uuid.uuid5(TARGET_ENTITY_NAMESPACE, slug))


def _load_runtime_targets() -> list[dict[str, Any]]:
    path = target_runtime_path()
    if not path.is_file():
        return []
    try:
        data = json.loads(path.read_text(encoding="utf-8"))
        return data if isinstance(data, list) else []
    except (json.JSONDecodeError, OSError):
        return []


def _save_runtime_targets(entities: list[dict[str, Any]]) -> None:
    path = target_runtime_path()
    path.parent.mkdir(parents=True, exist_ok=True)
    path.write_text(
        json.dumps(entities, indent=2, ensure_ascii=False) + "\n",
        encoding="utf-8",
    )


def list_target_catalog(
    *,
    search: str = "",
    entity_type: str | None = None,
    limit: int = 50,
    offset: int = 0,
    index_path: str | Path | None = None,
) -> tuple[list[dict[str, Any]], int]:
    """List targets, receptors, and enzymes from shared nodes index + runtime catalog."""
    path = Path(index_path) if index_path else CV_NODES_INDEX_PATH
    shared_entities: list[dict[str, Any]] = []
    if path.is_file():
        try:
            data = json.loads(path.read_text(encoding="utf-8"))
            shared_entities = data.get("entities", [])
        except (json.JSONDecodeError, OSError):
            shared_entities = []

    runtime_entities = _load_runtime_targets()
    merged_by_slug: dict[str, dict[str, Any]] = {}

    for e in shared_entities:
        etype = e.get("entity_type")
        if etype in VALID_MOLECULAR_TYPES:
            slug = e.get("slug")
            if slug:
                merged_by_slug[slug] = e

    for e in runtime_entities:
        etype = e.get("entity_type")
        if etype in VALID_MOLECULAR_TYPES:
            slug = e.get("slug")
            if slug:
                merged_by_slug[slug] = e

    rows: list[dict[str, Any]] = []
    q = search.strip().lower()

    for slug, ent in merged_by_slug.items():
        etype = ent.get("entity_type", "TargetProtein")
        if entity_type and etype != entity_type:
            continue
        label = ent.get("label") or slug
        desc = ent.get("description") or ""
        gene = ent.get("gene_symbol") or ""
        if q and q not in slug and q not in label.lower() and q not in desc.lower() and q not in gene.lower():
            continue
        rows.append(
            {
                "id": str(ent.get("id") or allocate_target_entity_id(slug)),
                "entity_type": etype,
                "slug": slug,
                "label": label,
                "description": desc or None,
                "gene_symbol": gene or None,
                "status": ent.get("status", "published"),
                "properties": ent,
            }
        )

    rows.sort(key=lambda r: r["slug"])
    total = len(rows)
    return rows[offset : offset + limit], total


def register_target(
    *,
    entity_type: str,
    slug: str,
    label: str,
    description: str | None = None,
    gene_symbol: str | None = None,
    is_cyp: bool = False,
    cyp_family: str | None = None,
    family: str | None = None,
) -> dict[str, Any]:
    """Register a new TargetProtein, Receptor, or Enzyme in the curator runtime."""
    if entity_type not in VALID_MOLECULAR_TYPES:
        raise ValueError(
            f"Invalid molecular entity_type '{entity_type}'. Must be one of: {', '.join(sorted(VALID_MOLECULAR_TYPES))}."
        )

    normalized_slug = validate_target_slug(slug)
    clean_label = label.strip()
    if not clean_label:
        raise ValueError("Target label is required.")

    # Check for duplicate
    existing, _ = list_target_catalog(search=normalized_slug, limit=10)
    for e in existing:
        if e["slug"] == normalized_slug:
            raise ValueError(f"Molecular target with slug '{normalized_slug}' already exists.")

    entity_id = allocate_target_entity_id(normalized_slug)
    entity: dict[str, Any] = {
        "id": entity_id,
        "entity_type": entity_type,
        "slug": normalized_slug,
        "label": clean_label,
        "description": (description or "").strip() or None,
        "gene_symbol": (gene_symbol or "").strip() or None,
        "status": "draft",
        "source": "curator_runtime",
    }

    if entity_type == "Enzyme":
        entity["is_cyp"] = is_cyp
        if cyp_family:
            entity["cyp_family"] = cyp_family.strip()
    elif entity_type == "Receptor":
        if family:
            entity["family"] = family.strip()

    runtime = _load_runtime_targets()
    runtime.append(entity)
    _save_runtime_targets(runtime)
    return entity
