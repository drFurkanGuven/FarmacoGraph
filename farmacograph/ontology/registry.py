"""Ontology registry — loads formal relationship and constraint definitions."""

from __future__ import annotations

import json
from functools import lru_cache
from pathlib import Path
from typing import Any

from pydantic import BaseModel, Field

ONTOLOGY_DIR = Path(__file__).resolve().parents[2] / "ontology"


class CardinalityRule(BaseModel):
    source_min: int = 0
    source_max: int | None = None
    target_min: int = 0
    target_max: int | None = None


class ForbiddenPair(BaseModel):
    source: str
    target: str
    reason: str
    same_node: bool = False


class RelationshipDefinition(BaseModel):
    type: str
    uri: str
    category: str
    description: str
    allowed_sources: list[str]
    allowed_targets: list[str]
    forbidden_pairs: list[ForbiddenPair] = Field(default_factory=list)
    cardinality: CardinalityRule
    inverse: str
    symmetric: bool = False
    requires_evidence_on_publish: bool = False
    requires_explanation_on_publish: bool = False
    dag_only: bool = False


class ConstraintDefinition(BaseModel):
    id: str
    name: str
    severity: str
    category: str
    description: str
    applies_to: dict[str, Any]


class OntologyRegistry(BaseModel):
    version: str
    relationships: list[RelationshipDefinition]
    constraints: list[ConstraintDefinition]

    def get_relationship(self, rel_type: str) -> RelationshipDefinition | None:
        for rel in self.relationships:
            if rel.type == rel_type:
                return rel
        return None

    def is_allowed(self, rel_type: str, source_type: str, target_type: str) -> bool:
        rel = self.get_relationship(rel_type)
        if rel is None:
            return False
        if source_type not in rel.allowed_sources:
            return False
        if target_type not in rel.allowed_targets:
            return False
        for forbidden in rel.forbidden_pairs:
            if forbidden.source == source_type and forbidden.target == target_type:
                return False
        return True

    def get_constraint(self, constraint_id: str) -> ConstraintDefinition | None:
        for constraint in self.constraints:
            if constraint.id == constraint_id:
                return constraint
        return None


@lru_cache(maxsize=1)
def load_ontology_registry() -> OntologyRegistry:
    relationships_path = ONTOLOGY_DIR / "relationships.json"
    constraints_path = ONTOLOGY_DIR / "constraints.json"

    with relationships_path.open(encoding="utf-8") as f:
        rel_data = json.load(f)
    with constraints_path.open(encoding="utf-8") as f:
        con_data = json.load(f)

    return OntologyRegistry(
        version=rel_data["version"],
        relationships=[RelationshipDefinition(**r) for r in rel_data["relationships"]],
        constraints=[ConstraintDefinition(**c) for c in con_data["constraints"]],
    )
