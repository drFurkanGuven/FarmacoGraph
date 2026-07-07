# Entity-Relationship Matrix

> **Version:** 1.0.0 | Source: `ontology/relationships.json`

## Legend

- ✓ = Allowed
- ✗ = Forbidden
- ○ = Not applicable

## Clinical Relationships

| Source ↓ / Target → | Drug | DrugClass | Disease | SideEffect | Enzyme | Receptor | Pathway | LabTest | Microbe | Evidence | Education |
|---------------------|:----:|:---------:|:-------:|:----------:|:------:|:--------:|:-------:|:-------:|:-------:|:--------:|:---------:|
| **Drug** TREATS | ○ | ○ | ✓ | ○ | ○ | ○ | ○ | ○ | ○ | ○ | ○ |
| **Drug** TARGETS | ○ | ○ | ✗ | ○ | ✓ | ✓ | ✓ | ○ | ○ | ○ | ○ |
| **Drug** CAUSES | ○ | ○ | ○ | ✓ | ○ | ○ | ○ | ○ | ○ | ○ | ○ |
| **Drug** INHIBITS | ○ | ○ | ✗ | ○ | ✓ | ✓ | ✓ | ○ | ○ | ○ | ○ |
| **Drug** INTERACTS_WITH | ✓ | ○ | ○ | ○ | ○ | ○ | ○ | ○ | ○ | ○ | ○ |
| **Drug** COVERS | ○ | ○ | ○ | ○ | ○ | ○ | ○ | ○ | ✓ | ○ | ○ |
| **Drug** MONITOR_WITH | ○ | ○ | ○ | ○ | ○ | ○ | ○ | ✓ | ○ | ○ | ○ |
| **Drug** IS_A | ○ | ✓ | ✗ | ○ | ○ | ○ | ○ | ○ | ○ | ○ | ○ |
| **Drug** HAS_EDUCATION | ○ | ○ | ○ | ○ | ○ | ○ | ○ | ○ | ○ | ○ | ✓ |
| **Drug** REQUIRES | ○ | ○ | ○ | ○ | ○ | ○ | ○ | ○ | ○ | ○ | ○ |
| **Evidence** TREATS | ○ | ○ | ✗ | ○ | ○ | ○ | ○ | ○ | ○ | ○ | ○ |
| **Education** TREATS | ○ | ○ | ✗ | ○ | ○ | ○ | ○ | ○ | ○ | ○ | ○ |
| **Education** ILLUSTRATES | ✓ | ✓ | ✓ | ✓ | ✓ | ✓ | ✓ | ✓ | ✓ | ○ | ○ |

## Mechanism DAG Relationships

| Relationship | Source | Target | DAG | Reusable |
|-------------|--------|--------|:---:|:--------:|
| HAS_MECHANISM_ROOT | Drug | MechanismFragment | | |
| PRECEDES | MechanismFragment | MechanismFragment | ✓ | ✓ |
| BRANCHES_TO | MechanismFragment | MechanismFragment | ✓ | ✓ |
| MERGES_INTO | MechanismFragment | MechanismFragment | ✓ | ✓ |
| MODULATES | MechanismFragment | PhysiologicalProcess | ✓ | ✓ |
| RESULTS_IN | MechanismFragment | ClinicalOutcome / SideEffect | ✓ | |
| RESULTS_FROM | SideEffect | MechanismFragment | | |

## Learning Graph Relationships

| Relationship | Source | Target | Example |
|-------------|--------|--------|---------|
| REQUIRES | Drug | KnowledgeTopic | Ramipril → RAAS Physiology |
| REQUIRES | KnowledgeTopic | KnowledgeTopic | RAAS → Kidney Physiology |
| REQUIRES | KnowledgeTopic | KnowledgeTopic | Kidney → Nephron Anatomy |

## Evidence Chain (Required Pattern)

```text
Clinical Edge ──SUPPORTED_BY──▶ Evidence ──CITES──▶ Reference
                                    │
                                    └──DERIVED_FROM──▶ Guideline

FORBIDDEN: Clinical Edge ──▶ Reference (FG-C011)
```

## Cardinality Summary (Published Drug)

| Relationship | Min | Max |
|-------------|:---:|:---:|
| IS_A / BELONGS_TO DrugClass | 1 | ∞ |
| TREATS / PREVENTS Disease | 1 | ∞ |
| HAS_MECHANISM_ROOT | 1 | 3 |
| SUPPORTED_BY Evidence (per clinical edge) | 1 | ∞ |
| HAS_EDUCATION | 0 | ∞ |
