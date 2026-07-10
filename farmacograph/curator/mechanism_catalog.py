"""Mechanism fragment catalog — shared nodes index reads for curator pickers."""

from __future__ import annotations

from typing import Any

from farmacograph.curator.drug_package import load_nodes_index


def _fragments_from_index(index: dict[str, Any] | None = None) -> list[dict[str, Any]]:
    data = index or load_nodes_index()
    return [
        entity
        for entity in data.get("entities", [])
        if entity.get("entity_type") == "MechanismFragment"
    ]


def list_mechanism_fragment_catalog(
    *, search: str = "", limit: int = 50, offset: int = 0
) -> tuple[list[dict[str, Any]], int]:
    needle = search.strip().lower()
    rows: list[dict[str, Any]] = []
    for entity in _fragments_from_index():
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
