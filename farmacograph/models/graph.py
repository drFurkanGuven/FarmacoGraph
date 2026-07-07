"""Graph node and edge schemas for Neo4j projection."""

from __future__ import annotations

from typing import Any
from uuid import UUID

from pydantic import BaseModel, Field

from farmacograph.models.confidence import RelationshipMetadata
from farmacograph.models.enums import EntityType, RelationshipType
from farmacograph.models.provenance import ProvenanceMetadata, VersioningMetadata


class GraphNode(BaseModel):
    """Neo4j node projection."""

    id: UUID
    labels: list[str]
    entity_type: EntityType
    properties: dict[str, Any] = Field(default_factory=dict)
    provenance: ProvenanceMetadata
    versioning: VersioningMetadata


class GraphEdge(BaseModel):
    """Neo4j relationship projection."""

    id: str
    relationship_type: RelationshipType
    source_id: UUID
    target_id: UUID
    source_entity_type: EntityType
    target_entity_type: EntityType
    metadata: RelationshipMetadata | None = None
    provenance: ProvenanceMetadata
    versioning: VersioningMetadata


class GraphSubgraph(BaseModel):
    """Subgraph for API visualization and explain endpoints."""

    nodes: list[GraphNode]
    edges: list[GraphEdge]
    root_id: UUID | None = None
    layout_hint: str = "dagre"
    dataset_version: str
    depth: int = 2


class MechanismDAG(BaseModel):
    """Mechanism directed acyclic graph projection."""

    drug_id: UUID
    root_fragment_id: UUID
    nodes: list[GraphNode]
    edges: list[GraphEdge]
    clinical_outcomes: list[UUID] = Field(default_factory=list)
    is_acyclic: bool = True


class LearningGraph(BaseModel):
    """Prerequisite knowledge graph for AI tutors."""

    entity_id: UUID
    prerequisites: list[GraphNode]
    edges: list[GraphEdge]
    missing_topics: list[UUID] = Field(default_factory=list)
