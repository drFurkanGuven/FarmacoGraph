# FarmacoGraph API Specification

> **Version:** 1.0.0-draft  
> REST API for graph queries, explainability, and visualization

---

## 1. Overview

| Property | Value |
|----------|-------|
| Base URL | `/api/v1` |
| Format | JSON |
| Auth | Bearer JWT or API key — see [Getting Started](getting-started.md) |
| Graph backend | Neo4j (read queries) |
| Metadata backend | PostgreSQL (versions, audit) |

OpenAPI documentation auto-generated via FastAPI at `/docs`.

**New to the API?** Read [Getting Started](getting-started.md) — how to access the service, authentication, scopes, and examples.

---

## 2. Response Conventions

### 2.1 Standard envelope

```json
{
  "data": {},
  "meta": {
    "dataset_version": "2026.1.0",
    "query_time_ms": 42,
    "content_layers": ["biomedical"]
  }
}
```

### 2.2 Entity summary (list views)

```json
{
  "id": "drug:uuid",
  "type": "Drug",
  "slug": "ramipril",
  "label": "Ramipril",
  "status": "published",
  "confidence_score": 0.95,
  "external_ids": {"rxnorm": "35296", "atc": "C09AA05"}
}
```

### 2.3 Relationship in responses

```json
{
  "type": "INHIBITS",
  "from": {"id": "drug:...", "label": "Ramipril"},
  "to": {"id": "enzyme:...", "label": "ACE"},
  "metadata": {
    "explanation": "Ramipril inhibits angiotensin-converting enzyme...",
    "clinical_significance": "Reduces angiotensin II, lowering blood pressure",
    "mechanism_summary": "Prevents conversion of angiotensin I to II",
    "conditions": null,
    "confidence_score": 0.94,
    "evidence_level": "A"
  },
  "evidence": [
    {
      "id": "evidence:...",
      "type": "fda_label",
      "title": "Altace Prescribing Information",
      "quality_score": 0.98
    }
  ]
}
```

---

## 3. Drug Endpoints

### `GET /drugs`

List drugs with filtering.

**Query parameters:**

| Param | Type | Description |
|-------|------|-------------|
| `class` | string | DrugClass slug |
| `atc` | string | ATC prefix |
| `indication` | string | Disease slug |
| `module` | string | Organ system module |
| `status` | string | published (default) |
| `limit` | int | Default 50, max 200 |
| `offset` | int | Pagination |

**Response:** `{data: EntitySummary[], meta: {total, limit, offset}}`

---

### `GET /drugs/{id}`

Full drug profile with relationship summaries (not embedded duplicates).

**Response sections:**

```json
{
  "data": {
    "identity": {},
    "classification": {"class": {}, "atc_codes": []},
    "pharmacokinetics": {},
    "relationships": {
      "treats": [],
      "causes": [],
      "targets": [],
      "metabolized_by": [],
      "interacts_with": [],
      "covers": []
    },
    "mechanism_root_id": "fragment:...",
    "education_available": true
  }
}
```

---

### `GET /drugs/{id}/graph`

Subgraph for visualization around a drug.

**Query parameters:**

| Param | Type | Description |
|-------|------|-------------|
| `depth` | int | Traversal depth (1–3, default 2) |
| `include` | string[] | Relationship types to include |
| `exclude` | string[] | Relationship types to exclude |
| `format` | string | `react_flow` \| `cytoscape` \| `native` |

**Response:** Graph projection (see Section 8).

---

### `GET /drugs/{id}/mechanism`

Mechanism DAG projection.

**Response:**

```json
{
  "data": {
    "drug_id": "drug:...",
    "root_fragment_id": "fragment:...",
    "nodes": [
      {"id": "fragment:...", "label": "ACE Inhibition", "type": "MechanismFragment"}
    ],
    "edges": [
      {"type": "PRECEDES", "source": "...", "target": "...", "metadata": {}}
    ],
    "clinical_outcomes": []
  }
}
```

---

### `GET /drugs/{id}/education`

All education layer content for a drug.

**Query parameters:**

| Param | Type | Description |
|-------|------|-------------|
| `types` | string[] | Filter by education type |
| `audience` | string | MBBS, USMLE, TUS |

**Response:** All nodes include `"content_layer": "education"`.

---

## 4. Entity Endpoints

### `GET /entities/{type}/{id}`

Generic entity retrieval for any ontology type.

**Supported types:** `drug`, `disease`, `enzyme`, `receptor`, `pathway`, `side_effect`, `microorganism`, `laboratory_test`, `mechanism_fragment`, `evidence`

---

### `GET /classes`

Drug class taxonomy tree.

### `GET /classes/{id}/drugs`

Drugs belonging to class (including subclasses).

---

### `GET /pathways/{id}`

Pathway with participating proteins and affected drugs.

### `GET /receptors/{id}`

Receptor with binding drugs.

### `GET /enzymes/{id}`

Enzyme with substrates, inhibitors, inducers.

---

## 5. Clinical Query Endpoints

### `GET /interactions`

**Query parameters:**

| Param | Type | Description |
|-------|------|-------------|
| `drug` | string | Drug slug or ID |
| `drug_b` | string | Second drug for pair lookup |
| `severity` | string | minor, moderate, major, contraindicated |
| `enzyme` | string | CYP enzyme slug (indirect interactions) |

---

### `GET /coverage`

Antibiotic coverage map.

**Query parameters:** `organism`, `drug`, `gram_stain`

---

### `GET /contraindications`

**Query parameters:** `drug`, `condition`

---

### `GET /monitoring`

**Query parameters:** `drug`, `lab_test`

---

## 6. Search

### `GET /search`

Full-text search across all entity types.

**Query parameters:**

| Param | Type | Description |
|-------|------|-------------|
| `q` | string | Search query (required) |
| `types` | string[] | Entity types to search |
| `module` | string | Organ system filter |
| `limit` | int | Default 20 |

**Response:**

```json
{
  "data": [
    {
      "id": "drug:...",
      "type": "Drug",
      "label": "Metformin",
      "match_field": "generic_name",
      "score": 0.98,
      "snippet": "..."
    }
  ]
}
```

---

## 7. Explainability

### `GET /explain`

Structured reasoning chain — core explainability endpoint.

**Query parameters (structured):**

| Param | Type | Description |
|-------|------|-------------|
| `drug` | string | Drug slug (required) |
| `effect` | string | Side effect or outcome slug |
| `question_type` | string | mechanism, interaction, indication, monitoring |

**Example:** `GET /explain?drug=ramipril&effect=dry-cough&question_type=mechanism`

**Response:**

```json
{
  "data": {
    "question": "Why does ramipril cause dry cough?",
    "answer_summary": "ACE inhibition reduces bradykinin degradation...",
    "reasoning_chain": [
      {
        "step": 1,
        "from": {"type": "Drug", "id": "...", "label": "Ramipril"},
        "relationship": "HAS_MECHANISM_ROOT",
        "to": {"type": "MechanismFragment", "id": "...", "label": "ACE Inhibition"},
        "explanation": "...",
        "evidence": []
      },
      {
        "step": 2,
        "from": {"type": "MechanismFragment", "label": "ACE Inhibition"},
        "relationship": "PRECEDES",
        "to": {"type": "MechanismFragment", "label": "Bradykinin Accumulation"},
        "explanation": "...",
        "evidence": [{"id": "...", "type": "pubmed_article", "title": "..."}]
      },
      {
        "step": 3,
        "from": {"type": "MechanismFragment", "label": "Bradykinin Accumulation"},
        "relationship": "RESULTS_IN",
        "to": {"type": "SideEffect", "label": "Dry Cough"},
        "explanation": "...",
        "evidence": []
      }
    ],
    "confidence": 0.92,
    "evidence_level": "A",
    "content_layers": ["biomedical"]
  }
}
```

**No path found:**

```json
{
  "data": null,
  "error": {
    "code": "NO_PATH",
    "message": "No validated mechanism path found in knowledge base."
  }
}
```

---

## 8. Graph & Visualization

### `POST /graph/query`

Parameterized read-only Cypher execution.

**Security:** Whitelisted query templates only; no arbitrary Cypher from clients.

**Request:**

```json
{
  "template": "drug_neighborhood",
  "params": {"drug_slug": "metformin", "depth": 2}
}
```

---

### `GET /visualize/{mode}`

Pre-built visualization projections.

| Mode | Description |
|------|-------------|
| `mechanism` | Drug mechanism DAG |
| `side_effects` | Side effect chains |
| `interactions` | Interaction network |
| `treatment` | Disease treatment map |
| `receptors` | Receptor binding map |
| `pathways` | Pathway map |
| `coverage` | Antibiotic coverage |
| `cyp` | CYP interaction map |
| `pregnancy` | Pregnancy safety map |
| `organ` | Organ system map |

**Query parameters:** `drug`, `disease`, `format` (react_flow | cytoscape | mermaid)

**React Flow response:**

```json
{
  "data": {
    "nodes": [
      {
        "id": "drug:...",
        "type": "drugNode",
        "position": {"x": 0, "y": 0},
        "data": {"label": "Ramipril", "entity_type": "Drug"}
      }
    ],
    "edges": [
      {
        "id": "edge-1",
        "source": "drug:...",
        "target": "enzyme:...",
        "type": "inhibitsEdge",
        "data": {"label": "INHIBITS", "explanation": "..."}
      }
    ],
    "layout_hint": "dagre"
  }
}
```

---

## 9. Comparison

### `POST /compare`

Compare multiple drugs side-by-side.

**Request:**

```json
{
  "drug_ids": ["drug:metoprolol", "drug:propranolol"],
  "dimensions": ["mechanism", "indications", "side_effects", "interactions", "dosing"],
  "include_education": false
}
```

**Response:**

```json
{
  "data": {
    "drugs": [{}, {}],
    "comparison": {
      "mechanism": {"shared_targets": [], "differences": []},
      "indications": {"shared": [], "unique": [[], []]},
      "side_effects": {},
      "interactions": {},
      "dosing": {}
    },
    "subgraph": {}
  }
}
```

---

## 10. Version & Meta Endpoints

### `GET /version`

Current published dataset version.

### `GET /version/{tag}`

Specific version manifest from PostgreSQL.

### `GET /version/{tag}/diff/{other_tag}`

Entity/relationship count diff between versions.

---

## 11. AI Integration Endpoints (Future)

### `POST /rag/query`

Full RAG pipeline endpoint for LLM consumers.

**Request:**

```json
{
  "question": "Which antibiotics cover Pseudomonas?",
  "max_paths": 5,
  "min_confidence": 0.7,
  "include_education": false
}
```

**Response:** Same as `/explain` but with multiple paths ranked by confidence.

**Constraint:** Response `reasoning_chain` is mandatory; LLM receives this as context only.

---

## 12. Error Codes

| Code | HTTP | Description |
|------|------|-------------|
| `ENTITY_NOT_FOUND` | 404 | Entity does not exist |
| `NO_PATH` | 404 | No graph path for explain query |
| `INVALID_QUERY` | 400 | Bad parameters |
| `QUERY_DEPTH_EXCEEDED` | 400 | Traversal depth too high |
| `VERSION_NOT_FOUND` | 404 | Dataset version not found |
| `GRAPH_UNAVAILABLE` | 503 | Neo4j connection failure |

---

## 13. Rate Limiting (Future)

Tracked in PostgreSQL `api_statistics`. Default: 100 req/min anonymous, 1000 req/min authenticated.

---

## 14. Content Layer Headers

Responses may include:

```
X-Content-Layers: biomedical
X-Content-Layers: biomedical,education
X-Dataset-Version: 2026.1.0
```

Clients must not treat `education` layer content as clinical fact.
