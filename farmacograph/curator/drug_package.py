"""Load and validate curator drug publish packages."""

from __future__ import annotations

import json
import uuid
from datetime import UTC, date, datetime
from pathlib import Path
from typing import Any

import yaml
from pydantic import BaseModel, Field

from farmacograph.curator.publish_validator import validate_publish_package
from farmacograph.validators.base import ValidationResult

PROJECT_ROOT = Path(__file__).resolve().parents[2]
CV_CURRICULUM_PATH = PROJECT_ROOT / "staging" / "cardiovascular" / "curriculum.yaml"
CV_TEMPLATE_PATH = PROJECT_ROOT / "staging" / "cardiovascular" / "drug-entry.template.json"
CV_DRUGS_DIR = PROJECT_ROOT / "staging" / "cardiovascular" / "drugs"
CV_NODES_INDEX_PATH = PROJECT_ROOT / "staging" / "cardiovascular" / "shared" / "nodes.index.json"
DRUG_ENTITY_NAMESPACE = uuid.UUID("a1000001-0000-4000-8000-000000000000")

# Shared nodes to wire when initializing a drug entry per curriculum category.
CATEGORY_SHARED_NODE_SLUGS: dict[str, list[str]] = {
    "beta-blockers": [
        "beta-blockers",
        "hypertension",
        "angina-pectoris",
        "beta-adrenergic-blockade",
    ],
    "ace-inhibitors": ["ace-inhibitors", "hypertension", "ace-inhibition"],
    "arbs": ["arbs", "hypertension"],
    "calcium-channel-blockers": ["calcium-channel-blockers", "hypertension", "angina-pectoris"],
    "diuretics": ["loop-diuretics", "hypertension"],
    "antiarrhythmics": ["antiarrhythmics"],
    "anticoagulants": ["anticoagulants"],
    "antiplatelets": ["antiplatelets"],
    "statins": ["statins"],
    "nitrates": ["nitrates", "angina-pectoris"],
    "inotropes-vasodilators": ["inotropes-vasodilators"],
    "other-cardiovascular": ["other-cardiovascular"],
}


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


def drug_entity_id(slug: str) -> str:
    return str(uuid.uuid5(DRUG_ENTITY_NAMESPACE, slug))


def find_drug_in_curriculum(
    slug: str, curriculum: dict[str, Any] | None = None
) -> tuple[dict[str, Any], dict[str, Any]] | None:
    """Return (drug_entry, category) for slug, or None."""
    data = curriculum or load_curriculum()
    for category in data.get("categories", []):
        for drug in category.get("drugs", []):
            if drug.get("slug") == slug:
                return drug, category
    return None


def list_pending_drugs(
    *,
    limit: int | None = None,
    curriculum: dict[str, Any] | None = None,
) -> list[dict[str, Any]]:
    pending: list[dict[str, Any]] = []
    data = curriculum or load_curriculum()
    for category in data.get("categories", []):
        for drug in category.get("drugs", []):
            if drug.get("status", "pending") == "pending":
                pending.append(
                    {
                        "slug": drug["slug"],
                        "category": category.get("slug"),
                        "category_name": category.get("name"),
                        "package_path": str(CV_DRUGS_DIR / f"{drug['slug']}.json"),
                        "package_exists": (CV_DRUGS_DIR / f"{drug['slug']}.json").is_file(),
                    }
                )
                if limit and len(pending) >= limit:
                    return pending
    return pending


def load_nodes_index(path: str | Path | None = None) -> dict[str, Any]:
    index_path = Path(path) if path else CV_NODES_INDEX_PATH
    return json.loads(index_path.read_text(encoding="utf-8"))


def _nodes_by_slug(index: dict[str, Any]) -> dict[str, dict[str, Any]]:
    return {entity["slug"]: entity for entity in index.get("entities", [])}


def mark_curriculum_published(
    slug: str,
    *,
    curriculum_path: str | Path | None = None,
) -> bool:
    """Set slug status to published in curriculum.yaml. Returns True if updated."""
    path = Path(curriculum_path) if curriculum_path else CV_CURRICULUM_PATH
    curriculum = yaml.safe_load(path.read_text(encoding="utf-8"))
    found = find_drug_in_curriculum(slug, curriculum)
    if found is None:
        return False
    drug, _ = found
    if drug.get("status") == "published":
        return False
    drug["status"] = "published"
    path.write_text(
        yaml.safe_dump(curriculum, sort_keys=False, allow_unicode=True), encoding="utf-8"
    )
    return True


def build_drug_entry_package(
    slug: str, *, curriculum: dict[str, Any] | None = None
) -> dict[str, Any]:
    """Build in-memory publish package skeleton for a curriculum slug."""
    located = find_drug_in_curriculum(slug, curriculum)
    if located is None:
        raise ValueError(f"Slug not in curriculum: {slug}")

    _, category = located
    category_slug = category.get("slug", "")
    index = _nodes_by_slug(load_nodes_index())
    shared_slugs = CATEGORY_SHARED_NODE_SLUGS.get(category_slug, [])
    related_entities: list[dict[str, Any]] = []
    rel_map: dict[str, list[str]] = {
        "BELONGS_TO": [],
        "TREATS": [],
        "HAS_MECHANISM_ROOT": [],
    }
    relationships: list[dict[str, Any]] = []
    drug_id = drug_entity_id(slug)
    label = slug.replace("-", " ").title()

    for node_slug in shared_slugs:
        node = index.get(node_slug)
        if node is None:
            continue
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
            "slug": slug,
            "label": label,
            "generic_name": label,
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


def init_drug_entry(slug: str, *, overwrite: bool = False) -> Path:
    """Create drugs/{slug}.json skeleton from curriculum + shared nodes index."""
    located = find_drug_in_curriculum(slug)
    if located is None:
        raise ValueError(f"Slug not in curriculum: {slug}")

    out_path = CV_DRUGS_DIR / f"{slug}.json"
    if out_path.exists() and not overwrite:
        raise FileExistsError(f"Already exists: {out_path}")

    package = build_drug_entry_package(slug)
    CV_DRUGS_DIR.mkdir(parents=True, exist_ok=True)
    out_path.write_text(json.dumps(package, indent=2, ensure_ascii=False) + "\n", encoding="utf-8")
    return out_path
