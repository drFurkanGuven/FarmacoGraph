"""Runtime drug catalog — curator-created drugs outside curriculum.yaml (writable path)."""

from __future__ import annotations

import json
import os
import re
import uuid
from datetime import UTC, date, datetime
from pathlib import Path
from typing import Any

from farmacograph.curator.drug_package import (
    CATEGORY_SHARED_NODE_SLUGS,
    DRUG_ENTITY_NAMESPACE,
    drug_entity_id,
    find_drug_in_curriculum,
    load_curriculum,
    load_nodes_index,
)

PROJECT_ROOT = Path(__file__).resolve().parents[2]
DEFAULT_DRUG_RUNTIME_PATH = (
    PROJECT_ROOT / "staging" / "cardiovascular" / "shared" / "drugs.runtime.json"
)
_SLUG_RE = re.compile(r"^[a-z0-9]+(?:-[a-z0-9]+)*$")


def drug_runtime_path() -> Path:
    override = os.environ.get("FG_DRUG_CATALOG_PATH", "").strip()
    return Path(override) if override else DEFAULT_DRUG_RUNTIME_PATH


def normalize_drug_slug(raw: str) -> str:
    slug = raw.strip().lower().replace("_", "-").replace(" ", "-")
    slug = re.sub(r"-+", "-", slug).strip("-")
    return slug


def validate_drug_slug(slug: str) -> str:
    normalized = normalize_drug_slug(slug)
    if not normalized or not _SLUG_RE.match(normalized):
        raise ValueError("Drug slug must be lowercase kebab-case (e.g. ramipril).")
    return normalized


def _load_runtime_drugs(path: Path | None = None) -> list[dict[str, Any]]:
    runtime_path = path or drug_runtime_path()
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
        if isinstance(entity, dict) and entity.get("entity_type") == "Drug"
    ]


def _save_runtime_drugs(entities: list[dict[str, Any]], path: Path | None = None) -> None:
    runtime_path = path or drug_runtime_path()
    try:
        runtime_path.parent.mkdir(parents=True, exist_ok=True)
        payload = {
            "version": "1.0.0",
            "updated_at": datetime.now(UTC).isoformat(),
            "entities": entities,
        }
        runtime_path.write_text(
            json.dumps(payload, indent=2, ensure_ascii=False) + "\n", encoding="utf-8"
        )
    except OSError as exc:
        raise OSError(
            "Cannot write drug runtime catalog "
            f"({runtime_path}). Set FG_DRUG_CATALOG_PATH to a writable path "
            "(Docker: /app/data/catalog/drugs.runtime.json on the catalogdata volume)."
        ) from exc


def find_runtime_drug(slug: str) -> dict[str, Any] | None:
    normalized = normalize_drug_slug(slug)
    for entity in _load_runtime_drugs():
        if entity.get("slug") == normalized:
            return entity
    return None


def list_drug_classes() -> list[dict[str, Any]]:
    """DrugClass rows from nodes index + curriculum category names."""
    curriculum = load_curriculum()
    category_names = {
        cat.get("slug"): cat.get("name")
        for cat in curriculum.get("categories", [])
        if cat.get("slug")
    }
    index = load_nodes_index()
    rows: list[dict[str, Any]] = []
    for entity in index.get("entities", []):
        if entity.get("entity_type") != "DrugClass":
            continue
        slug = entity["slug"]
        rows.append(
            {
                "id": entity["id"],
                "slug": slug,
                "label": entity.get("label") or category_names.get(slug) or slug,
                "entity_type": "DrugClass",
                "organ_system": entity.get("organ_system", "cardiovascular"),
            }
        )
    rows.sort(key=lambda row: row["label"].lower())
    return rows


def _category_slug_for_class(drug_class_slug: str) -> str:
    """Map DrugClass slug to curriculum category key used by CATEGORY_SHARED_NODE_SLUGS."""
    if drug_class_slug in CATEGORY_SHARED_NODE_SLUGS:
        return drug_class_slug
    # nodes index uses loop-diuretics; curriculum category is diuretics
    if drug_class_slug == "loop-diuretics":
        return "diuretics"
    return drug_class_slug


def build_drug_package_for_class(
    *,
    slug: str,
    label: str,
    drug_class_slug: str,
) -> dict[str, Any]:
    """Build a draft publish package with BELONGS_TO the selected DrugClass (+ optional seeds)."""
    normalized = validate_drug_slug(slug)
    clean_label = label.strip()
    if not clean_label:
        raise ValueError("Drug label is required.")

    index = {entity["slug"]: entity for entity in load_nodes_index().get("entities", [])}
    class_node = index.get(drug_class_slug)
    if class_node is None or class_node.get("entity_type") != "DrugClass":
        raise ValueError(f"Unknown drug class slug: {drug_class_slug}")

    category_slug = _category_slug_for_class(drug_class_slug)
    shared_slugs = list(CATEGORY_SHARED_NODE_SLUGS.get(category_slug, [drug_class_slug]))
    if drug_class_slug not in shared_slugs:
        shared_slugs.insert(0, drug_class_slug)

    drug_id = drug_entity_id(normalized)
    related_entities: list[dict[str, Any]] = []
    rel_map: dict[str, list[str]] = {
        "BELONGS_TO": [],
        "TREATS": [],
        "HAS_MECHANISM_ROOT": [],
    }
    relationships: list[dict[str, Any]] = []
    seen_ids: set[str] = set()

    for node_slug in shared_slugs:
        node = index.get(node_slug)
        if node is None or node["id"] in seen_ids:
            continue
        seen_ids.add(node["id"])
        entity = {
            "id": node["id"],
            "entity_type": node["entity_type"],
            "slug": node["slug"],
            "label": node["label"],
            "description": node.get("description", ""),
            "status": "published",
            "dataset_version": "2026.1.0",
            "provenance": {
                "created_at": datetime.now(UTC).isoformat(),
                "updated_at": datetime.now(UTC).isoformat(),
                "created_by": "curator-system",
                "source": "manual",
            },
            "versioning": {
                "dataset_version": "2026.1.0",
                "valid_from": date.today().isoformat(),
                "status": "published",
            },
        }
        if node["entity_type"] == "DrugClass":
            entity["organ_system"] = node.get("organ_system", "cardiovascular")
            rel_map["BELONGS_TO"].append(node["id"])
            relationships.append(
                {
                    "relationship_type": "BELONGS_TO",
                    "source_type": "Drug",
                    "target_type": "DrugClass",
                    "source_id": drug_id,
                    "target_id": node["id"],
                }
            )
        elif node["entity_type"] == "Disease":
            rel_map["TREATS"].append(node["id"])
            relationships.append(
                {
                    "relationship_type": "TREATS",
                    "source_type": "Drug",
                    "target_type": "Disease",
                    "source_id": drug_id,
                    "target_id": node["id"],
                    "properties": {
                        "explanation": "Seed indication from drug class template.",
                        "confidence_score": 0.85,
                        "evidence_level": "expert_consensus",
                    },
                }
            )
        elif node["entity_type"] == "MechanismFragment":
            rel_map["HAS_MECHANISM_ROOT"].append(node["id"])
            relationships.append(
                {
                    "relationship_type": "HAS_MECHANISM_ROOT",
                    "source_type": "Drug",
                    "target_type": "MechanismFragment",
                    "source_id": drug_id,
                    "target_id": node["id"],
                    "properties": {
                        "explanation": "Seed mechanism root from drug class template.",
                        "confidence_score": 0.85,
                        "evidence_level": "expert_consensus",
                    },
                }
            )
        related_entities.append(entity)

    return {
        "module": "cardiovascular",
        "dataset_version": "2026.1.0",
        "create_snapshot": False,
        "entity_payload": {
            "id": drug_id,
            "entity_type": "Drug",
            "slug": normalized,
            "label": clean_label,
            "generic_name": clean_label,
            "module": "cardiovascular",
            "routes": [],
            "half_life": None,
            "protein_binding": None,
            "bioavailability": None,
            "onset": None,
            "duration": None,
            "has_black_box_warning": False,
            "is_high_alert": False,
            "status": "draft",
            "dataset_version": "2026.1.0",
            "external_ids": {},
            "provenance": {
                "created_at": datetime.now(UTC).isoformat(),
                "updated_at": datetime.now(UTC).isoformat(),
                "created_by": "curator-system",
                "source": "manual",
                "curator_attestation": False,
            },
            "versioning": {
                "dataset_version": "2026.1.0",
                "ontology_version": "1.0.0",
                "valid_from": date.today().isoformat(),
                "status": "draft",
                "validation_state": "pending",
            },
            "relationships": rel_map,
        },
        "related_entities": related_entities,
        "relationships": relationships,
    }


def register_drug(
    *,
    slug: str,
    label: str,
    drug_class_slug: str,
    description: str | None = None,
) -> dict[str, Any]:
    """Register a Drug in the runtime catalog and return entity + starter package fields."""
    normalized = validate_drug_slug(slug)
    clean_label = label.strip()
    if not clean_label:
        raise ValueError("Drug label is required.")

    if find_drug_in_curriculum(normalized) is not None:
        raise ValueError(f"Drug slug already exists in curriculum: {normalized}")
    if find_runtime_drug(normalized) is not None:
        raise ValueError(f"Drug slug already exists: {normalized}")

    classes = {row["slug"]: row for row in list_drug_classes()}
    if drug_class_slug not in classes:
        raise ValueError(f"Unknown drug class slug: {drug_class_slug}")

    entity = {
        "id": drug_entity_id(normalized),
        "entity_type": "Drug",
        "slug": normalized,
        "label": clean_label,
        "description": (description or "").strip() or None,
        "drug_class_slug": drug_class_slug,
        "category_slug": _category_slug_for_class(drug_class_slug),
        "status": "draft",
        "source": "curator_runtime",
        "module": "cardiovascular",
    }
    runtime = _load_runtime_drugs()
    runtime.append(entity)
    try:
        _save_runtime_drugs(runtime)
    except OSError as exc:
        raise ValueError(str(exc)) from exc
    return entity


def list_runtime_drug_entries() -> list[dict[str, Any]]:
    return _load_runtime_drugs()


# Keep uuid import used for namespace clarity in callers
assert isinstance(DRUG_ENTITY_NAMESPACE, uuid.UUID)
