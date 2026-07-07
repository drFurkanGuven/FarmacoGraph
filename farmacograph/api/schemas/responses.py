"""API response DTOs — the public contract. Clients never access Neo4j directly."""

from __future__ import annotations

from typing import Any, Generic, TypeVar
from uuid import UUID

from pydantic import BaseModel, Field

from farmacograph.models.confidence import RelationshipMetadata
from farmacograph.models.enums import ContentLayer, EntityType
from farmacograph.models.graph import GraphSubgraph

T = TypeVar("T")


class ResponseMeta(BaseModel):
    dataset_version: str
    ontology_version: str = "1.0.0"
    query_time_ms: int | None = None
    content_layers: list[ContentLayer] = Field(default_factory=lambda: [ContentLayer.BIOMEDICAL])
    language: str = "en"
    api_version: str = "v1"


class APIResponse(BaseModel, Generic[T]):
    data: T
    meta: ResponseMeta


class EntitySummary(BaseModel):
    id: UUID
    type: EntityType
    slug: str
    label: str
    status: str
    confidence_score: float | None = None
    external_ids: dict[str, Any] = Field(default_factory=dict)
    content_layer: ContentLayer = ContentLayer.BIOMEDICAL


class RelationshipDTO(BaseModel):
    type: str
    from_entity: EntitySummary
    to_entity: EntitySummary
    metadata: RelationshipMetadata | None = None
    evidence_ids: list[str] = Field(default_factory=list)


class ExplainStep(BaseModel):
    step: int
    from_entity: EntitySummary
    relationship: str
    to_entity: EntitySummary
    explanation: str
    evidence_ids: list[str] = Field(default_factory=list)


class ExplainResponse(BaseModel):
    question: str
    answer_summary: str | None = None
    reasoning_chain: list[ExplainStep] = Field(default_factory=list)
    confidence: float | None = None
    evidence_level: str | None = None
    content_layers: list[ContentLayer] = Field(default_factory=lambda: [ContentLayer.BIOMEDICAL])


class CompareRequest(BaseModel):
    drug_ids: list[UUID] = Field(min_length=2, max_length=10)
    dimensions: list[str] = Field(default_factory=lambda: ["mechanism", "indications", "side_effects"])
    include_education: bool = False
    response_mode: str = "summary"  # summary | full | graph


class ContentFilter(BaseModel):
    """Client request for content layer filtering."""

    biomedical: bool = True
    education: bool = False
    learning: bool = False
    response_mode: str = "summary"  # minimal | summary | full | graph


class GraphResponse(BaseModel):
    subgraph: GraphSubgraph
    evidence_refs: list[str] = Field(default_factory=list)
