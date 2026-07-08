# FarmacoGraph API Specification

> **Version:** 1.1.0  
> REST API for graph queries, explainability, and curation

**Live docs:** https://farmacograph.furkanguven.space/docs  
**Getting started:** [getting-started.md](getting-started.md)  
**API roadmap:** [api-roadmap.md](api-roadmap.md)

---

## Implementation status

The OpenAPI file at `openapi/openapi.yaml` describes the **full contract** (implemented + planned). FastAPI serves the live spec at `/openapi.json`.

### Implemented endpoints (27 routes)

| Method | Path | Auth scope | Notes |
|--------|------|------------|-------|
| POST | `/api/v1/auth/token` | Public | Issue JWT (`password` or `api_key` grant) |
| POST | `/api/v1/auth/refresh` | Public | Refresh access token |
| GET | `/api/v1/info` | Public | API discovery |
| GET | `/api/v1/health` | Public | Health check |
| GET | `/api/v1/dashboard` | `knowledge:read` | Studio ops dashboard |
| GET | `/api/v1/audit-logs` | `knowledge:read` | Recent audit entries |
| GET | `/api/v1/jobs` | `knowledge:read` | Background job list |
| GET | `/api/v1/drugs` | `knowledge:read` | List drugs |
| GET | `/api/v1/drugs/{drug_id}` | `knowledge:read` | Drug detail |
| GET | `/api/v1/search` | `knowledge:search` | Drug search (Neo4j when enabled) |
| GET | `/api/v1/modules` | `knowledge:read` | Curriculum modules |
| GET | `/api/v1/modules/{module_slug}/curriculum` | `knowledge:read` | Module curriculum |
| GET | `/api/v1/statistics` | `knowledge:read` | Graph statistics |
| GET | `/api/v1/explain` | `knowledge:explain` | Reasoning chain |
| POST | `/api/v1/compare` | `knowledge:read` | Drug comparison |
| GET | `/api/v1/drugs/{drug_slug}/prerequisites` | `knowledge:read` | Learning prerequisites |
| POST | `/api/v1/curator/validate` | `curator:write` | Dry-run validation |
| GET | `/api/v1/curator/stubs/cardiovascular` | `curator:write` | Structural stub template |
| POST | `/api/v1/curator/workflows` | `curator:write` | Create draft |
| GET | `/api/v1/curator/workflows/{workflow_id}` | `curator:write` | Get workflow |
| GET | `/api/v1/curator/queue` | `curator:write` | Review queue |
| GET | `/api/v1/curator/validation-summary` | `curator:write` | Validation stats |
| POST | `/api/v1/curator/workflows/{id}/submit` | `curator:write` | draft → review |
| POST | `/api/v1/curator/workflows/{id}/approve` | `curator:publish` | review → approved |
| POST | `/api/v1/curator/workflows/{id}/publish` | `curator:publish` | approved → published |

### App-level routes (not under `/api/v1`)

| Method | Path | Notes |
|--------|------|-------|
| GET | `/` | Redirect to `/docs` |
| GET | `/search` | Public HTML search page |
| GET | `/docs` | Swagger UI |
| GET | `/metrics` | Prometheus (if `FG_METRICS_ENABLED=true`) |

### Planned (in OpenAPI, not yet routed)

Entity endpoints (`/drug-classes`, `/diseases`, `/pathways/{id}`, …), clinical queries (`/interactions`), education (`/flashcards`, `/cases`), graph projection (`/drugs/{id}/graph`, `POST /graph/query`), version management (`/version`), and AI endpoints (`POST /rag`, `POST /tutor`).

### Auth (current)

- `POST /auth/token` — password or API key grant → access + refresh JWT pair
- `POST /auth/refresh` — rotate access token from refresh token
- Bearer JWT or raw API key on `Authorization: Bearer …` (API keys validated against PostgreSQL `api_keys`)
- Optional `X-API-Key` header (same validation as Bearer API key)
- Scope checks per route via `require_scope` dependency
- Anonymous read/search/explain allowed when `FG_ALLOW_ANONYMOUS_READ=true` (default in development; forced off in production)
- Curator endpoints (`curator:write`, `curator:publish`) require authentication — anonymous callers receive `401`
- `POST /auth/introspect` — planned (Studio client ready; not routed yet)
- Self-service API key provisioning — planned (manual provisioning today)

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

### 1.1 Authentication endpoints

#### `POST /auth/token`

Issue an access/refresh token pair.

**Request body:**

| Field | Type | Required | Description |
|-------|------|----------|-------------|
| `grant_type` | string | Yes | `password` or `api_key` |
| `username` | string | For password | User email |
| `password` | string | For password | User password |
| `api_key` | string | For api_key | Full API key (`fg_…`) |

**Response:**

```json
{
  "access_token": "eyJ…",
  "refresh_token": "eyJ…",
  "token_type": "bearer",
  "expires_in": 3600,
  "scopes": ["knowledge:read", "curator:write"],
  "email": "curator@example.org",
  "name": "Curator Name"
}
```

#### `POST /auth/refresh`

Rotate tokens using a refresh token (refresh tokens cannot be used as Bearer credentials on protected routes).

**Request body:** `{ "refresh_token": "eyJ…" }`

**Response:** Same shape as `/auth/token`.

**Implementation:** `farmacograph/api/routers/auth.py`, `farmacograph/auth/service.py`

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
