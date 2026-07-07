"""Clinical, evidence, mechanism, and learning entity models."""

from __future__ import annotations

from uuid import UUID

from pydantic import Field

from farmacograph.models.base import BiomedicalEntity
from farmacograph.models.enums import EntityType, EvidenceType


class Disease(BiomedicalEntity):
    entity_type: EntityType = EntityType.DISEASE
    prevalence_note: str | None = None


class LaboratoryTest(BiomedicalEntity):
    entity_type: EntityType = EntityType.LABORATORY_TEST
    unit: str | None = None
    normal_range: str | None = None
    direction_of_change: str = "unknown"


class ClinicalOutcome(BiomedicalEntity):
    entity_type: EntityType = EntityType.CLINICAL_OUTCOME
    outcome_type: str = "therapeutic"
    measurability: str = "objective"


class ClinicalScenario(BiomedicalEntity):
    entity_type: EntityType = EntityType.CLINICAL_SCENARIO
    stem: str
    learning_objectives: list[str] = Field(default_factory=list)


class MechanismFragment(BiomedicalEntity):
    entity_type: EntityType = EntityType.MECHANISM_FRAGMENT
    is_reusable: bool = True
    fragment_type: str = "molecular"
    direction: str = "unknown"


class MechanismStep(BiomedicalEntity):
    entity_type: EntityType = EntityType.MECHANISM_STEP
    fragment_id: UUID
    drug_id: UUID
    context_note: str | None = None


class Evidence(BiomedicalEntity):
    entity_type: EntityType = EntityType.EVIDENCE
    evidence_type: EvidenceType
    title: str
    authors: list[str] = Field(default_factory=list)
    year: int | None = None
    quality_score: float = Field(ge=0.0, le=1.0, default=0.5)
    extract: str | None = None
    supports_claim: str | None = None
    journal: str | None = None


class Reference(BiomedicalEntity):
    entity_type: EntityType = EntityType.REFERENCE
    pmid: str | None = None
    doi: str | None = None
    url: str | None = None
    authors: list[str] = Field(default_factory=list)
    year: int | None = None
    source_type: str = "pubmed"


class Guideline(BiomedicalEntity):
    entity_type: EntityType = EntityType.GUIDELINE
    source: str
    year: int | None = None
    url: str | None = None
    recommendation_strength: str | None = None
    recommendation_text: str | None = None


class KnowledgeTopic(BiomedicalEntity):
    """Learning graph node — prerequisite knowledge topic."""

    entity_type: EntityType = EntityType.KNOWLEDGE_TOPIC
    topic_domain: str | None = None
    estimated_minutes: int | None = None


class Prerequisite(BiomedicalEntity):
    """Explicit prerequisite in learning graph."""

    entity_type: EntityType = EntityType.PREREQUISITE
    topic_id: UUID
    rationale: str | None = None
