"""Pharmacologic entity models."""

from __future__ import annotations

from uuid import UUID

from pydantic import Field

from farmacograph.models.base import BiomedicalEntity, EducationResource
from farmacograph.models.enums import (
    ContraindicationType,
    EntityType,
    InteractionSeverity,
    SideEffectFrequency,
    SideEffectSeverity,
)


class Drug(BiomedicalEntity):
    """Graph entry point for a pharmacologic agent. No duplicated relational knowledge."""

    entity_type: EntityType = EntityType.DRUG
    generic_name: str
    pronunciation: str | None = None
    routes: list[str] = Field(default_factory=list)
    # PK summary scalars (drug-intrinsic only)
    bioavailability: str | None = None
    protein_binding: str | None = None
    half_life: str | None = None
    volume_of_distribution: str | None = None
    clearance: str | None = None
    absorption: str | None = None
    elimination: str | None = None
    onset: str | None = None
    peak_effect: str | None = None
    duration: str | None = None
    has_black_box_warning: bool = False
    black_box_text: str | None = None
    is_high_alert: bool = False
    module: str | None = Field(default=None, description="Curriculum module slug, e.g. cardiovascular")


class DrugClass(BiomedicalEntity):
    entity_type: EntityType = EntityType.DRUG_CLASS
    atc_prefix: str | None = None
    parent_class_id: UUID | None = None
    level: int = 0
    organ_system: str | None = None


class TradeName(BiomedicalEntity):
    entity_type: EntityType = EntityType.TRADE_NAME
    manufacturer: str | None = None
    region: str | None = None


class Dose(BiomedicalEntity):
    entity_type: EntityType = EntityType.DOSE
    amount: str
    route: str
    frequency: str
    population: str = "adult"
    indication_context: str | None = None
    max_dose: str | None = None
    titration: str | None = None
    renal_adjustment: str | None = None
    hepatic_adjustment: str | None = None
    egfr_threshold: str | None = None


class PregnancyRisk(BiomedicalEntity):
    entity_type: EntityType = EntityType.PREGNANCY_RISK
    fda_category: str | None = None
    pllr_narrative: str | None = None
    pregnancy_recommendation: str | None = None
    lactation_safety: str | None = None
    lactation_notes: str | None = None
    teratogenicity_risk: str | None = None


class MonitoringPlan(BiomedicalEntity):
    entity_type: EntityType = EntityType.MONITORING_PLAN
    parameter: str
    frequency: str
    rationale: str
    threshold_action: str | None = None
    baseline_required: bool = False


class SideEffect(BiomedicalEntity):
    entity_type: EntityType = EntityType.SIDE_EFFECT
    frequency: SideEffectFrequency = SideEffectFrequency.UNKNOWN
    severity: SideEffectSeverity = SideEffectSeverity.MILD
    organ_system: str | None = None
    meddra_code: str | None = None


class Contraindication(BiomedicalEntity):
    entity_type: EntityType = EntityType.CONTRAINDICATION
    contraindication_type: ContraindicationType
    rationale: str
    condition_type: str | None = None


class Interaction(BiomedicalEntity):
    entity_type: EntityType = EntityType.INTERACTION
    severity: InteractionSeverity
    interaction_type: str = "pharmacodynamic"
    mechanism: str
    clinical_effect: str
    management: str | None = None
    onset: str | None = None


class Microorganism(BiomedicalEntity):
    entity_type: EntityType = EntityType.MICROORGANISM
    gram_stain: str | None = None
    species: str | None = None
    resistance_notes: str | None = None


# --- Education subtypes ---


class FiveSecondSummary(EducationResource):
    text: str = Field(max_length=280)


class ThirtySecondSummary(EducationResource):
    text: str = Field(max_length=800)


class FiveMinuteExplanation(EducationResource):
    sections: list[dict[str, str]] = Field(default_factory=list)


class BoardExamPearl(EducationResource):
    text: str
    exam_tags: list[str] = Field(default_factory=list)


class HighYieldReview(EducationResource):
    text: str
    tags: list[str] = Field(default_factory=list)


class CommonMistake(EducationResource):
    mistake: str
    correction: str
    why_wrong: str | None = None


class Mnemonic(EducationResource):
    mnemonic: str
    expansion: str


class Flashcard(EducationResource):
    front: str
    back: str
    hint: str | None = None


class ComparisonTable(EducationResource):
    title: str
    columns: list[str] = Field(default_factory=list)
    rows: list[dict[str, str]] = Field(default_factory=list)
    drug_ids: list[UUID] = Field(default_factory=list)


class ClinicalCase(EducationResource):
    stem: str
    vitals: dict[str, str] = Field(default_factory=dict)
    labs: dict[str, str] = Field(default_factory=dict)
    questions: list[str] = Field(default_factory=list)
    answers: list[str] = Field(default_factory=list)
    teaching_points: list[str] = Field(default_factory=list)


class LearningObjective(EducationResource):
    objective: str
    bloom_level: str = "understand"


class RevisionChecklist(EducationResource):
    items: list[str] = Field(default_factory=list)


class FAQ(EducationResource):
    question: str
    answer: str


class VisualExplanation(EducationResource):
    format: str = "mermaid"
    spec: dict[str, object] = Field(default_factory=dict)
    caption: str | None = None
