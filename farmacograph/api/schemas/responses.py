"""API response DTOs — the public contract. Clients never access Neo4j directly."""

from __future__ import annotations

from enum import Enum
from typing import Any, Generic, Literal, TypeVar
from uuid import UUID

from pydantic import BaseModel, Field, model_validator

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
    total: int | None = Field(
        default=None,
        description="Total number of matches for list endpoints, ignoring limit/offset.",
    )
    provenance: str | None = Field(
        default=None,
        description="Data origin marker, e.g. staging-fallback when served from curator staging files instead of the graph.",
    )


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
    curation_status: str | None = Field(
        default=None,
        description=(
            "'curated' for curator-authored content, 'external' for imported "
            "datasets (e.g. PrimeKG) that carry no curator review. Clients must "
            "not present external entities as reviewed product content."
        ),
    )
    source: str | None = Field(
        default=None, description="Ingestion source, e.g. 'primekg'."
    )


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


class InteractionSeverity(str, Enum):
    CONTRAINDICATED = "contraindicated"
    MAJOR = "major"
    MODERATE = "moderate"
    MINOR = "minor"
    BENEFICIAL_SYNERGY = "beneficial_synergy"


class DrugInteractionItem(BaseModel):
    drug_a_id: UUID
    drug_b_id: UUID
    severity: InteractionSeverity
    title: str
    mechanism_explanation: str
    clinical_action: str
    pathway_overlap: list[str] = Field(default_factory=list)
    source: Literal["curator", "rules", "external"] = Field(
        default="rules",
        description=(
            "Provenance of this interaction: 'curator' for a curator-entered edge, "
            "'external' for imported reference data (e.g. FDA DailyMed) that has no "
            "curator review, 'rules' for a rule-engine heuristic."
        ),
    )
    evidence_ids: list[str] = Field(default_factory=list)


class InteractionResponse(BaseModel):
    interactions: list[DrugInteractionItem] = Field(default_factory=list)
    checked_drugs: list[EntitySummary] = Field(default_factory=list)


class InteractionRequest(BaseModel):
    drug_ids: list[UUID] = Field(default_factory=list)
    slugs: list[str] = Field(default_factory=list)
    drugs: list[str | UUID] = Field(default_factory=list)

    @model_validator(mode="before")
    @classmethod
    def parse_input(cls, data: Any) -> Any:
        if isinstance(data, list):
            return {"drugs": data}
        return data

