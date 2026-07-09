"""Education layer helpers for curator packages."""

from __future__ import annotations

from typing import Any


def education_items_from_package(package: dict[str, Any] | None) -> list[dict[str, Any]]:
    if not package:
        return []
    education = package.get("education")
    if not isinstance(education, list):
        return []
    return [item for item in education if isinstance(item, dict)]


def education_items_for_entity(
    package: dict[str, Any] | None,
    entity_id: str,
) -> list[dict[str, Any]]:
    items = education_items_from_package(package)
    return [
        item
        for item in items
        if entity_id in [str(value) for value in item.get("linked_entity_ids", [])]
    ]
