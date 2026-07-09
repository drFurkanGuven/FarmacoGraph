# FarmacoGraph API Specification

> **Version:** 1.1.0  
> REST API for graph queries, explainability, and curation

**Live docs:** https://farmacograph.furkanguven.space/docs  
**Getting started:** [getting-started.md](getting-started.md)  
**API roadmap:** [api-roadmap.md](api-roadmap.md)

---

## Implementation status

The OpenAPI file at `openapi/openapi.yaml` describes the **full contract** (implemented + planned). FastAPI serves the live spec at `/openapi.json`.

### Implemented endpoints (30 routes)

| Method | Path | Auth scope | Notes |
|--------|------|------------|-------|
| POST | `/api/v1/auth/token` | Public | Issue JWT (`password` or `api_key` grant) |
| POST | `/api/v1/auth/refresh` | Public | Refresh access token |
| POST | `/api/v1/auth/introspect` | Public | Introspect JWT or API key (scopes, roles, identity) |
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
| GET | `/api/v1/diseases` | `knowledge:read` | Disease catalog (bootstrap nodes index) |
| GET | `/api/v1/diseases/{disease_id}` | `knowledge:read` | Disease detail by canonical UUID |
| GET | `/api/v1/curator/drugs` | `curator:write` | Curator drug browser |
| GET | `/api/v1/curator/drugs/{slug}/workflow-state` | `curator:write` | Drug workflow aggregate |
| POST | `/api/v1/curator/drugs/{slug}/workflows` | `curator:write` | Open/create workflow for slug |
| GET | `/api/v1/curator/drugs/{slug}/package` | `curator:write` | Load draft package |
| GET | `/api/v1/curator/diseases` | `curator:write` | Curator disease browser |
| POST | `/api/v1/curator/diseases/{slug}/workflows` | `curator:write` | Open/create disease workflow |
| GET | `/api/v1/curator/diseases/{slug}/package` | `curator:write` | Load disease draft package |
| GET | `/api/v1/curator/diseases/{slug}/workflow-state` | `curator:write` | Disease workflow aggregate |
| PUT | `/api/v1/curator/workflows/{id}/package` | `curator:write` | **Canonical autosave** |
| POST | `/api/v1/curator/validate` | `curator:write` | Dry-run validation |
| GET | `/api/v1/curator/stubs/cardiovascular` | `curator:write` | Structural stub template |
| POST | `/api/v1/curator/workflows` | `curator:write` | Create draft (entity UUID) |
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

> **Note:** Core evidence CRUD, UUID drug evidence routes under `/drugs/{drug_id}/evidence`, curator slug routes under `/curator/drugs/{slug}/evidence`, and evidence-centric attach routes under `/evidence/{evidence_id}/drugs/{drug_id}` are **implemented** — see [§1.4](#14-evidence-workflow-status).

### Auth (current)

- `POST /auth/token` — password or API key grant → access + refresh JWT pair
- `POST /auth/refresh` — rotate access token from refresh token
- `POST /auth/introspect` — introspect JWT or API key (scopes, roles, identity, expiry)
- Bearer JWT or raw API key on `Authorization: Bearer …` (API keys validated against PostgreSQL `api_keys`)
- Optional `X-API-Key` header (same validation as Bearer API key)
- Scope checks per route via `require_scope` dependency
- Anonymous read/search/explain allowed when `FG_ALLOW_ANONYMOUS_READ=true` (default in development; forced off in production)
- Curator endpoints (`curator:write`, `curator:publish`) require authentication — anonymous callers receive `401`
- Manual JSON editing and shell publish scripts (`scripts/dev-only/`) are **dev-only / deprecated** for curators — use Curation Studio (`apps/studio`) or the curator API below

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

#### `POST /auth/introspect`

Resolve scopes, roles, and identity from a JWT or API key without issuing new tokens.

**Request body (any of):**

| Field | Type | Description |
|-------|------|-------------|
| `access_token` | string | JWT access token |
| `api_key` | string | Full API key (`fg_…`) |

Alternatively, send `Authorization: Bearer …` or `X-API-Key` header.

**Response:**

```json
{
  "active": true,
  "scopes": ["knowledge:read", "curator:write"],
  "roles": ["curator"],
  "user_id": "uuid",
  "email": "curator@example.org",
  "name": "Curator Name",
  "auth_method": "jwt",
  "token_type": "access",
  "expires_at": "2026-07-08T12:00:00Z"
}
```

**Implementation:** `farmacograph/api/routers/auth.py`, `farmacograph/auth/service.py`

### 1.2 Curator autosave workflow

Studio and integration clients persist drug drafts through the curator workflow API:

| Step | Endpoint | Scope |
|------|----------|-------|
| Open by slug | `POST /curator/drugs/{slug}/workflows` | `curator:write` |
| Create draft | `POST /curator/workflows` | `curator:write` |
| **Autosave** | `PUT /curator/workflows/{id}/package` | `curator:write` |
| Validate | `POST /curator/validate` | `curator:write` |
| Submit | `POST /curator/workflows/{id}/submit` | `curator:write` |
| Approve | `POST /curator/workflows/{id}/approve` | `curator:publish` |
| Publish | `POST /curator/workflows/{id}/publish` | `curator:publish` |

**Package body (`PUT .../package` and `POST .../publish`):**

```json
{
  "entity_payload": { "id": "uuid", "slug": "...", "type": "Drug" },
  "related_entities": [],
  "relationships": [],
  "dataset_version": "2026.1.0",
  "module": "cardiovascular",
  "create_snapshot": false
}
```

**Autosave response:** `{ "data": { "workflow": {...}, "validation": { "valid": true, "issues": [] } } }`

Draft packages are stored in PostgreSQL (`draft_package_json`) until publish writes to Neo4j. Package edits are allowed only in `draft` and `review` states. There is no `PATCH /drugs/{id}` endpoint.

### 1.3 Curator publish workflow

State machine (FG-C023), enforced in `farmacograph/curator/workflow.py`:

```
draft → review → approved → published → deprecated
         ↑__________|
```

| Transition | Endpoint | Scope | Preconditions |
|------------|----------|-------|---------------|
| draft → review | `POST /curator/workflows/{id}/submit` | `curator:write` | Valid state transition |
| review → approved | `POST /curator/workflows/{id}/approve` | `curator:publish` | Workflow in `review` |
| approved → published | `POST /curator/workflows/{id}/publish` | `curator:publish` | Workflow in `approved`; package passes `require_valid_publish_package` |

**Publish request body:** Same shape as autosave (`entity_payload`, `related_entities`, `relationships`, `dataset_version`, optional `module`, `create_snapshot`).

**Publish side effects** (when `FG_NEO4J_ENABLED=true`):

1. Neo4j MERGE via `GraphWriter.publish_package`
2. Workflow state → `published`
3. Outbox event (`DrugPublished` or `KnowledgeValidated`)
4. Background job `graph_validation`
5. Audit log (`curator.published`)
6. Optional module snapshot when `create_snapshot=true`

**Studio status:** Transition endpoints are live and wired to the **Publish wizard** in the Drug Editor. See [curation-studio.md](curation-studio.md).

**Queue inspection:** `GET /curator/queue?state=review|draft|approved|published` — used by dashboard and drug browser.

**Workflow timeline:** `GET /curator/workflows/{id}/timeline?limit=50&offset=0` — audit-backed activity feed (autosave, validation, submit, approve, publish, snapshot). Used by Drug Editor sidebar and Publish wizard.

**Publish response:** `POST .../publish` returns `data.workflow` plus `published_slug`, `dataset_version`, `published_at`, `graph_write`, `snapshot`, and `validation_summary`.

### Dev-only / deprecated publishing paths

| Path | Status |
|------|--------|
| `scripts/dev-only/publish-drug.sh` | Dev-only — publishes local JSON via API |
| `scripts/dev-only/publish-stub.sh` | Dev-only — structural stub bootstrap |
| `scripts/dev-only/bootstrap-cv.sh` | Dev-only — stub + curriculum summary |
| `staging/*.json` | Dev-only fixtures |
| `python3 -m farmacograph init-drug-entry` | Dev-only scaffold |

These remain for pipeline testing, CI, and emergency recovery — **not** production curator workflows. See [scripts/dev-only/README.md](../scripts/dev-only/README.md).

### 1.4 Evidence workflow status

Evidence spans **ontology nodes** (`Evidence`, `SUPPORTED_BY` edges — see [ontology.md](ontology.md)), **REST CRUD/attach endpoints**, **FG-C012 validation**, and **curation gates** in Studio.

| Capability | API / Studio | Status |
|------------|--------------|--------|
| List / create evidence | `GET/POST /evidence` | **Implemented** |
| Evidence detail / update | `GET/PATCH /evidence/{id}` | **Implemented** |
| List drug evidence | `GET /drugs/{drug_id}/evidence`, `GET /curator/drugs/{slug}/evidence` | **Implemented** |
| Attach / detach drug evidence | `POST/DELETE /drugs/{id}/evidence`, `/curator/drugs/{slug}/evidence` | **Implemented** — Neo4j required |
| Attach to assertion | `POST/DELETE /evidence/{id}/assertions` | **Implemented** |
| Evidence publish validation | FG-C012 / FG-C019 / FG-C020 in `EvidenceValidator` | **Implemented** |
| Drug Editor Evidence section | Drug Editor | **Implemented** |
| Global Evidence Manager | `/knowledge/evidence` | **Implemented** |
| Publish wizard evidence readiness | Publish wizard | **Implemented** |

**Implemented evidence routes (FastAPI):**

| Method | Path | Scope |
|--------|------|-------|
| GET | `/evidence` | `knowledge:read` |
| POST | `/evidence` | `curator:write` |
| GET | `/evidence/{evidence_id}` | `knowledge:read` |
| PATCH | `/evidence/{evidence_id}` | `curator:write` |
| POST | `/evidence/{evidence_id}/drugs/{drug_id}` | `curator:write` |
| DELETE | `/evidence/{evidence_id}/drugs/{drug_id}` | `curator:write` |
| POST | `/evidence/{evidence_id}/assertions` | `curator:write` |
| DELETE | `/evidence/{evidence_id}/assertions` | `curator:write` |
| GET | `/drugs/{drug_id}/evidence` | `knowledge:read` |
| POST | `/drugs/{drug_id}/evidence` | `curator:write` |
| DELETE | `/drugs/{drug_id}/evidence/{evidence_id}` | `curator:write` |
| GET | `/curator/drugs/{slug}/evidence` | `curator:write` |
| POST | `/curator/drugs/{slug}/evidence` | `curator:write` |
| DELETE | `/curator/drugs/{slug}/evidence/{evidence_id}` | `curator:write` |

**List query parameters:** `limit`, `offset`, `evidence_type`, `search` (not `q`). Evidence writes return `503` when Neo4j is unavailable.

**Package provenance shape (draft autosave):**

```json
{
  "entity_payload": {
    "provenance": {
      "created_at": "2026-07-08T00:00:00+00:00",
      "updated_at": "2026-07-08T00:00:00+00:00",
      "created_by": "curator@example.org",
      "source": "manual",
      "curator_attestation": true
    }
  }
}
```

**Validation constraints (evidence-related):**

| ID | Level | Summary |
|----|-------|---------|
| FG-C018 | biomedical | Provenance metadata required on publish |
| FG-C028 | biomedical | Curator attestation required before publish |
| FG-C006 | ontology | Published clinical edges require `SUPPORTED_BY` → Evidence (graph write) |

Studio groups FG-C018/FG-C028 and provenance keyword matches into **Missing evidence** (Validation Center) and **Evidence readiness** (Publish wizard).

**Dashboard `evidence_count`:** Returned by `GET /statistics` and `GET /dashboard` from the latest `KnowledgeSnapshot` row — not a live evidence inventory API.

**E2E smoke:** `apps/studio/e2e/evidence-workflow.spec.ts` — Playwright mocks implement the Studio client contract for local CI without Neo4j.

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

All published education layer content for a drug.

**Query parameters:**

| Param | Type | Description |
|-------|------|-------------|
| `dataset_version` | string | Optional published dataset version |

**Response:** All nodes include `"content_layer": "education"`.

### `GET /curator/drugs/{slug}/education`

Draft education layer content from the curator package. Requires `curator:write`.

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
