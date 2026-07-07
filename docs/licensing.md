# FarmacoGraph Licensing Strategy

> **Version:** 1.0.0-draft

---

## 1. Overview

FarmacoGraph uses a tiered licensing approach that keeps the **platform open** while respecting **third-party data restrictions**.

| Artifact | License | Rationale |
|----------|---------|-----------|
| Source code | **Apache 2.0** | Permissive; compatible with commercial and academic use |
| Documentation | **CC BY 4.0** | Attribution-based sharing of docs and architecture |
| Curated original content | **CC BY 4.0** | FarmacoGraph-authored educational content |
| Generated datasets | **Per-source** | Depends on upstream source compatibility |

---

## 2. Code — Apache 2.0

All FarmacoGraph application code, ontology definitions, validators, API, and CLI:

- Commercial use allowed
- Modification allowed
- Distribution allowed
- Patent grant included
- Requires attribution and change notice

**File:** `LICENSE` (Apache 2.0) at repository root.

---

## 3. Documentation — CC BY 4.0

All files in `docs/`, architecture diagrams, and README:

- Share and adapt with attribution
- No additional restrictions
- Suitable for academic citation

**File:** `docs/LICENSE` (CC BY 4.0)

---

## 4. Dataset Licensing

Generated datasets are **not uniformly licensed** because they aggregate from sources with different terms.

### 4.1 Dataset composition tiers

| Tier | Contents | License approach |
|------|----------|-----------------|
| **Tier A — Open** | Entities with open IDs only (RxNorm, PubChem, ICD-10, LOINC, MeSH) | CC BY 4.0 |
| **Tier B — Attribution** | Data derived from sources requiring attribution (FDA labels, PubMed abstracts, WHO) | CC BY 4.0 + source attribution file |
| **Tier C — Restricted** | Data from licensed sources (DrugBank commercial, SNOMED CT, MedDRA) | Separate distribution; not in default open release |

### 4.2 Default open release

The default `farmacograph-open` dataset export includes:

- Tier A and Tier B content only
- Full attribution manifest (`ATTRIBUTION.md`)
- External IDs as references (not proprietary text dumps)

### 4.3 Restricted source handling

| Source | Strategy |
|--------|----------|
| **DrugBank** | Store `drugbank:DB00xxx` IDs; do not redistribute DrugBank text; users with own license can enrich |
| **SNOMED CT** | Optional plugin; requires user's SNOMED license |
| **MedDRA** | Optional plugin; store generic side effect names; MedDRA codes behind plugin |
| **BNF** | Attribute; link to NICE BNF; do not reproduce full BNF text |
| **NICE** | Attribute; link to guidelines; excerpt under fair use with evidence nodes |

### 4.4 Attribution manifest

Every dataset export includes:

```yaml
attribution:
  dataset_version: 2026.1.0
  generated_at: datetime
  sources:
    - name: FDA DailyMed
      url: https://dailymed.nlm.nih.gov
      license: Public domain (US government)
      entities_sourced: 45
    - name: PubChem
      url: https://pubchem.ncbi.nlm.nih.gov
      license: Public domain
      entities_sourced: 120
```

---

## 5. Integration Compatibility

License choices are designed to avoid blocking future integrations:

| Integration | Compatible? |
|------------|-------------|
| Commercial medical education apps | Yes (Apache 2.0 code) |
| Academic research | Yes |
| Anki deck generators | Yes (with attribution) |
| Clinical decision support (future) | Yes — separate liability disclaimer required |
| DrugBank enrichment | Yes — via ID linking, not redistribution |
| SNOMED CT plugin | Yes — user brings license |

---

## 6. Contributor Agreement

Contributors retain copyright; contributions accepted under:

- Code: Apache 2.0
- Documentation and curated content: CC BY 4.0

Contributors must not submit proprietary or licensed third-party content without explicit permission.

---

## 7. AI-Generated Content

AI-assisted drafts:

- Licensed as CC BY 4.0 only after human curator attestation
- Must not reproduce copyrighted source text verbatim
- Evidence extracts must comply with source fair use / licensing

---

## 8. Ecosystem Modules

Future *Graph modules (AnatoGraph, PhysioGraph, etc.) share the same licensing framework:

- Module code: Apache 2.0
- Module docs: CC BY 4.0
- Module datasets: Per-source tiered strategy

---

## 9. Recommended NOTICES File

```
FarmacoGraph
Copyright 2026 FarmacoGraph Contributors

Licensed under the Apache License, Version 2.0.

This product includes data from:
- RxNorm (NLM, public domain)
- PubChem (NIH, public domain)
- FDA Drug Labels (US government, public domain)
- [additional sources per release]

DrugBank identifiers are used for cross-referencing only.
DrugBank content is not redistributed in open releases.
```
