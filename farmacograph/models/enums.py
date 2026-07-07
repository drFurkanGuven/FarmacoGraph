"""Controlled vocabularies for the FarmacoGraph ontology."""

try:
    from enum import StrEnum
except ImportError:
    from enum import Enum

    class StrEnum(str, Enum):
        """Compatibility shim for Python < 3.11."""


class EntityStatus(StrEnum):
    DRAFT = "draft"
    REVIEW = "review"
    APPROVED = "approved"
    PUBLISHED = "published"
    DEPRECATED = "deprecated"


class ValidationState(StrEnum):
    PENDING = "pending"
    PASSED = "passed"
    FAILED = "failed"
    NEEDS_REVIEW = "needs_review"


class EvidenceLevel(StrEnum):
    A = "A"  # RCT / meta-analysis
    B = "B"  # Cohort / guideline
    C = "C"  # Case series / review
    D = "D"  # Expert opinion
    EXPERT_CONSENSUS = "expert_consensus"


class EvidenceType(StrEnum):
    PUBMED_ARTICLE = "pubmed_article"
    FDA_LABEL = "fda_label"
    EMA_SMPC = "ema_smpc"
    WHO_GUIDELINE = "who_guideline"
    NICE_GUIDELINE = "nice_guideline"
    RCT = "rct"
    META_ANALYSIS = "meta_analysis"
    SYSTEMATIC_REVIEW = "systematic_review"
    REVIEW_ARTICLE = "review_article"
    CLINICAL_GUIDELINE = "clinical_guideline"
    EXPERT_CONSENSUS = "expert_consensus"
    TEXTBOOK = "textbook"


class ContentLayer(StrEnum):
    BIOMEDICAL = "biomedical"
    EDUCATION = "education"
    LEARNING = "learning"


class RelationshipStrength(StrEnum):
    STRONG = "strong"
    MODERATE = "moderate"
    WEAK = "weak"
    UNKNOWN = "unknown"


class InteractionSeverity(StrEnum):
    MINOR = "minor"
    MODERATE = "moderate"
    MAJOR = "major"
    CONTRAINDICATED = "contraindicated"


class ContraindicationType(StrEnum):
    ABSOLUTE = "absolute"
    RELATIVE = "relative"


class SideEffectFrequency(StrEnum):
    VERY_COMMON = "very_common"
    COMMON = "common"
    UNCOMMON = "uncommon"
    RARE = "rare"
    VERY_RARE = "very_rare"
    UNKNOWN = "unknown"


class SideEffectSeverity(StrEnum):
    MILD = "mild"
    MODERATE = "moderate"
    SEVERE = "severe"
    LIFE_THREATENING = "life_threatening"


class DifficultyLevel(StrEnum):
    BEGINNER = "beginner"
    INTERMEDIATE = "intermediate"
    ADVANCED = "advanced"


class Audience(StrEnum):
    MBBS = "MBBS"
    USMLE = "USMLE"
    TUS = "TUS"
    RESIDENT = "resident"


class ConsensusStatus(StrEnum):
    STRONG = "strong"
    MODERATE = "moderate"
    WEAK = "weak"
    CONFLICTING = "conflicting"
    UNKNOWN = "unknown"


class QualityGrade(StrEnum):
    HIGH = "high"
    MODERATE = "moderate"
    LOW = "low"
    VERY_LOW = "very_low"


class VerificationMethod(StrEnum):
    MANUAL_CURATOR = "manual_curator"
    PEER_REVIEW = "peer_review"
    GUIDELINE_CROSSCHECK = "guideline_crosscheck"
    AUTOMATED_SOURCE = "automated_source"
    EXPERT_PANEL = "expert_panel"


class EntityType(StrEnum):
    """Neo4j node labels — mirrors ontology entity-hierarchy.json."""

    BIOMEDICAL_ENTITY = "BiomedicalEntity"
    DRUG = "Drug"
    DRUG_CLASS = "DrugClass"
    TRADE_NAME = "TradeName"
    DOSE = "Dose"
    PREGNANCY_RISK = "PregnancyRisk"
    MONITORING_PLAN = "MonitoringPlan"
    TARGET_PROTEIN = "TargetProtein"
    GENE = "Gene"
    RECEPTOR = "Receptor"
    ENZYME = "Enzyme"
    TRANSPORTER = "Transporter"
    PATHWAY = "Pathway"
    PHYSIOLOGICAL_PROCESS = "PhysiologicalProcess"
    ORGAN = "Organ"
    CELL_TYPE = "CellType"
    DISEASE = "Disease"
    SIDE_EFFECT = "SideEffect"
    CONTRAINDICATION = "Contraindication"
    INTERACTION = "Interaction"
    LABORATORY_TEST = "LaboratoryTest"
    MICROORGANISM = "Microorganism"
    CLINICAL_OUTCOME = "ClinicalOutcome"
    CLINICAL_SCENARIO = "ClinicalScenario"
    MECHANISM_FRAGMENT = "MechanismFragment"
    MECHANISM_STEP = "MechanismStep"
    EVIDENCE = "Evidence"
    REFERENCE = "Reference"
    GUIDELINE = "Guideline"
    KNOWLEDGE_TOPIC = "KnowledgeTopic"
    PREREQUISITE = "Prerequisite"
  # Education subtypes use EducationResource as base label in graph
    EDUCATION_RESOURCE = "EducationResource"


class RelationshipType(StrEnum):
    """Canonical relationship types from ontology/relationships.json."""

    IS_A = "IS_A"
    BELONGS_TO = "BELONGS_TO"
    PART_OF = "PART_OF"
    TARGETS = "TARGETS"
    BINDS_TO = "BINDS_TO"
    INHIBITS = "INHIBITS"
    ACTIVATES = "ACTIVATES"
    INDUCES = "INDUCES"
    AFFECTS = "AFFECTS"
    REGULATES = "REGULATES"
    METABOLIZED_BY = "METABOLIZED_BY"
    TRANSPORTED_BY = "TRANSPORTED_BY"
    ENCODES = "ENCODES"
    PARTICIPATES_IN = "PARTICIPATES_IN"
    TREATS = "TREATS"
    PREVENTS = "PREVENTS"
    CAUSES = "CAUSES"
    CONTRAINDICATED_IN = "CONTRAINDICATED_IN"
    INTERACTS_WITH = "INTERACTS_WITH"
    AVOID_WITH = "AVOID_WITH"
    MONITOR_WITH = "MONITOR_WITH"
    COVERS = "COVERS"
    FIRST_LINE_FOR = "FIRST_LINE_FOR"
    SECOND_LINE_FOR = "SECOND_LINE_FOR"
    ALTERNATIVE_TO = "ALTERNATIVE_TO"
    HAS_MECHANISM_ROOT = "HAS_MECHANISM_ROOT"
    PRECEDES = "PRECEDES"
    BRANCHES_TO = "BRANCHES_TO"
    MERGES_INTO = "MERGES_INTO"
    MODULATES = "MODULATES"
    RESULTS_IN = "RESULTS_IN"
    RESULTS_FROM = "RESULTS_FROM"
    SUPPORTED_BY = "SUPPORTED_BY"
    CITES = "CITES"
    RECOMMENDED_BY = "RECOMMENDED_BY"
    HAS_EDUCATION = "HAS_EDUCATION"
    ILLUSTRATES = "ILLUSTRATES"
    REQUIRES = "REQUIRES"
    HAS_DOSE = "HAS_DOSE"
    HAS_TRADE_NAME = "HAS_TRADE_NAME"
    HAS_PREGNANCY_PROFILE = "HAS_PREGNANCY_PROFILE"
    REQUIRES_MONITORING = "REQUIRES_MONITORING"
    AFFECTS_ORGAN = "AFFECTS_ORGAN"
    COMPARES = "COMPARES"
