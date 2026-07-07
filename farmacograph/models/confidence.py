"""Confidence scoring metadata for biomedical relationships."""

from __future__ import annotations

from pydantic import BaseModel, Field

from farmacograph.models.enums import ConsensusStatus, EvidenceLevel, QualityGrade


class ConfidenceMetadata(BaseModel):
    """Confidence envelope attached to every published clinical relationship."""

    confidence_score: float = Field(ge=0.0, le=1.0)
    evidence_level: EvidenceLevel
    supporting_source_count: int = Field(ge=0, default=0)
    quality_grade: QualityGrade = QualityGrade.MODERATE
    consensus_status: ConsensusStatus = ConsensusStatus.UNKNOWN


class ExplainabilityMetadata(BaseModel):
    """Explainability envelope — powers /explain and AI citation builder."""

    explanation: str = Field(description="Why this relationship exists")
    clinical_significance: str | None = None
    mechanism_summary: str | None = None
    conditions: str | None = Field(
        default=None,
        description="Population, dose, or co-morbidity qualifiers",
    )


class RelationshipMetadata(BaseModel):
    """Complete metadata for a graph relationship edge."""

    explainability: ExplainabilityMetadata
    confidence: ConfidenceMetadata
    evidence_ids: list[str] = Field(
        default_factory=list,
        description="Evidence node IDs linked via SUPPORTED_BY",
    )
