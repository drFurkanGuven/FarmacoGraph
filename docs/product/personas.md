# FarmacoGraph User Personas

> Product-facing view of platform users. Infrastructure implements permission scopes per persona. Rate-limit tiers below are product targets; enforcement middleware is not yet live.

## Persona Summary

| Persona | Primary APIs | Auth | Target rate limit (future) |
|---------|-------------|------|------------|
| Medical Student | Core, Education, Search, Explain | Viewer/workspace account | 300/min |
| Medical Educator | Core, Education, Analytics | Curator role | 1000/min |
| Researcher | Core, Graph, Search, Snapshots | API key | 1000/min |
| Developer | All public APIs | API key | 1000–10000/min |
| Clinical Simulation | Explain, Reasoning, Core | Enterprise key | 5000/min |
| AI Agent | MCP, Explain, Search | Service key | 10000/min |
| University | Multi-workspace, Analytics | Org admin | Custom |
| Enterprise | All + custom plugins | Org + SSO | Custom |

---

## Medical Student

**Goals:** Learn mechanisms, compare drugs, review flashcards, prepare for exams.

**Workflows:** Search drug → read 5-minute explanation → trace mechanism graph → review flashcards.

**Permissions:** `knowledge:read`, `education:read`, `knowledge:search`, `knowledge:explain`

**Endpoints:** `GET /search`, `GET /drugs/{id}`, `GET /explain`, `GET /flashcards`, `GET /drugs/{id}/education`

**Premium (future):** Adaptive learning paths, spaced repetition sync, offline snapshots.

---

## Medical Educator

**Goals:** Curate content, validate modules, review student-facing material.

**Workflows:** Draft drug entry → submit review → approve publish → monitor module completion.

**Permissions:** `curator:write`, `curator:publish`, `knowledge:read`, `education:read`

**Endpoints:** Curator workflow (internal), `GET /modules`, `GET /statistics`

**Premium (future):** Cohort analytics, custom module branding.

---

## Researcher

**Goals:** Query reproducible snapshots, export subgraphs, cite evidence chains.

**Workflows:** Pin `dataset_version` → graph query → export JSON-LD → cite evidence.

**Permissions:** `knowledge:read`, `graph:query`, `export:read`

**Endpoints:** `GET /drugs/{id}?dataset_version=`, `POST /graph/query`, `POST /exports`

---

## Developer

**Goals:** Build apps on FarmacoGraph without database access.

**Workflows:** Register API key → integrate SDK → consume OpenAPI contract.

**Permissions:** Scoped via API key (`knowledge:read`, `knowledge:search`, etc.)

**Endpoints:** All public REST endpoints per key scope.

**Premium (future):** Higher rate limits, webhooks, dedicated snapshots.

---

## Clinical Simulation Platform

**Goals:** Feed case scenarios with explainable drug knowledge in real time.

**Workflows:** Load case → query interactions → explain adverse effects with evidence.

**Permissions:** `knowledge:read`, `knowledge:explain`, `graph:query`

**Endpoints:** `GET /explain`, `GET /interactions`, `POST /compare`

---

## AI Agent

**Goals:** Answer student questions with cited graph traversal — no hallucination.

**Workflows:** MCP tool call → structured reasoning chain → natural language synthesis.

**Permissions:** `knowledge:read`, `knowledge:explain`, `knowledge:search` (read-only)

**Endpoints:** MCP tools mapping to `/explain`, `/search`, `/drugs/{id}`

---

## University / Enterprise

**Goals:** Deploy for cohorts, manage workspaces, SSO, usage reporting.

**Permissions:** `admin:org`, `admin:api_keys`, workspace-scoped curator roles.

**Endpoints:** Org management (future), `GET /statistics`, bulk export.

**Premium:** SSO, SLA, custom terminology plugins, private curator workspaces.
