# FarmacoGraph Architecture Audit Report

**Audit date:** 2026-07-08  
**Repository:** `/Users/furkan/Desktop/FarmacoGraph`  
**Auditor:** Architecture Auditor (read-only)  
**Prior audit:** **BASELINE AUDIT** — no prior reports found in `docs/audits/`, `docs/architecture-audits/`, `.cursor/audits/`, or `*audit*` under `docs/` (only `.cursor/agents/architecture-auditor.md` and runtime `farmacograph/repositories/audit.py`).

---

## Executive Summary

### Project health

FarmacoGraph is a **well-architected early-alpha platform** with strong specifications, a clean backend layering model, and a polished Curation Studio shell. The **knowledge product itself is largely unbuilt**: one cardiovascular structural stub drug, 63 pending slugs in `staging/cardiovascular/curriculum.yaml`, and skeleton Explain/Compare/Reasoning services. Documentation is ahead of implementation in several areas (OpenAPI contract, pipeline, plugins, mechanism DAG engine).

### Overall completion estimate

| Lens | Estimate | Basis |
|------|----------|-------|
| **Full platform vision** (600–800 drugs, V5 ecosystem) | **~35–40%** | `docs/product/roadmap.md`, empty graph beyond stub |
| **V1 milestone** (platform + CV module ~70 drugs) | **~50–55%** | Infra + 25 API routes + Studio 4.1 done; curation/editors missing |
| **Architecture & specs (Phase 0)** | **~95%** | 32 docs files, ontology JSON, ADR index |
| **Actionable knowledge content** | **~1–2%** | 1 structural stub; 62/63 CV drugs `pending` |

### Biggest risks

1. **Security:** Curator write/publish endpoints appear accessible to anonymous callers (`farmacograph/api/deps.py` `require_scope` only whitelists read scopes for anonymous users; curator scopes fall through to allow anonymous).
2. **Contract drift:** `openapi/openapi.yaml` missing 10+ implemented routes and documents 20+ unimplemented routes — no Schemathesis/contract CI.
3. **Curation bottleneck:** Studio editors are placeholders; real curation still depends on `scripts/dev-only/` and CLI (`docs/curation-studio.md` marks these deprecated).
4. **Empty graph APIs:** Explain/Compare/Graph endpoints return skeleton/`no_data` without populated Neo4j content.
5. **Background processing gap:** Outbox publisher and worker daemon not wired at application startup (`farmacograph/events/outbox.py` exists but is never started in `farmacograph/api/main.py` lifespan).

### Biggest strengths

1. **API-first discipline** enforced in code: routers → services → repositories → DB (`farmacograph/core/container.py`, `docs/api-first.md`).
2. **Comprehensive documentation** (32 files under `docs/`, ADR index, validation matrix, studio spec).
3. **Production-minded infra:** Docker Compose (Postgres, Neo4j, API, Studio), CI with lint/typecheck/coverage/E2E (`/.github/workflows/ci.yml`).
4. **Curator publish pipeline** end-to-end: workflow state machine, 4-level validation gate, graph writer, outbox, jobs, audit (`farmacograph/services/curator.py`).
5. **Studio 4.1 quality:** typed API client with curator mutations already defined (`apps/studio/src/lib/api/client.ts`), functional dashboard, React Query, design system.

### Recommended next milestone

**"Secure curation path" sprint:** API 5.2 (API key + `POST /auth/token`) + fix curator auth gate + Studio 4.2.2 Drug List wired to `GET /drugs` and curator queue — enabling first real cardiovascular drug publish without CLI.

---

## Architecture Compliance

| Area | Status | Reasoning |
|------|--------|-----------|
| **API-first (ADR-010)** | **Mostly Complete** | All access via FastAPI; Studio uses `FarmacoGraphClient` only. Violation risk: dashboard reads curriculum from filesystem via `farmacograph/curator/drug_package.py`, not purely API. |
| **Hybrid Neo4j + PostgreSQL (ADR-009)** | **Mostly Complete** | Ops in `farmacograph/db/postgres/models.py`; knowledge in Neo4j via `GraphRepository`/`GraphWriter`. |
| **Ontology specification** | **Mostly Complete** | `docs/ontology.md` + `ontology/relationships.json`, `constraints.json`, `entity-hierarchy.json`. Runtime registry in `farmacograph/ontology/registry.py`. |
| **Validation matrix (FG-C001–C030)** | **Partial** | Four validators exist; only ~8 constraints explicitly coded; `docs/test-strategy.md` lists most FG-C tests as "Planned". |
| **Curator workflow (FG-C023)** | **Complete** | `farmacograph/curator/workflow.py` state machine; enforced in `CuratorRepository.transition`. |
| **Event bus + outbox (ADR-012)** | **Partial** | Write path appends outbox (`CuratorService.publish`); `OutboxPublisher` never polled at runtime; in-process `EventBus` only. |
| **Job queue (ADR-012)** | **Partial** | Jobs enqueued; `graph_validation` runs **inline** on publish, not via daemon (`farmacograph/services/curator.py:130-135`). `WorkerRegistry` unused. |
| **Search plugin (ADR-013)** | **Partial** | `GraphSearchProvider` live when `FG_NEO4J_ENABLED=true`; FTS/Meilisearch planned (`farmacograph/search/graph_provider.py` comment). |
| **Snapshots (ADR-014)** | **Partial** | `SnapshotService` + `KnowledgeSnapshot` model; no HTTP API; optional on publish via `create_snapshot` flag. |
| **Plugin system (ADR-015)** | **Missing** | Spec in `architecture/plugin-interfaces.json`; no `farmacograph/plugins/`, no `configs/plugins.yaml`. |
| **Multi-tenant model** | **Partial** | PG models (`Organization`, `Project`, `Workspace`, `User`, `ApiKey`) exist; not wired to request auth context. |
| **Observability (ADR-016)** | **Mostly Complete** | structlog, Prometheus metrics, correlation middleware (`farmacograph/api/middleware.py`). |
| **Curation Studio (ADR-020–024)** | **Partial** | Shell + dashboard complete; editors/publish wizard missing per `docs/studio-roadmap.md`. |
| **Pipeline / collectors** | **Missing** | `docs/roadmap.md` Phase 2.1 "Not started"; `farmacograph/graph/__init__.py` is empty docstring only. |
| **OpenAPI-first (platform-architecture)** | **Partial** | Spec exists but diverges heavily from FastAPI implementation. |
| **Mechanism DAG engine** | **Missing** | Roadmap marks ✅ but only Pydantic `MechanismDAG` model exists (`farmacograph/models/graph.py`); no acyclicity engine. |
| **GraphQL / MCP / SPARQL** | **Missing** | Future per `docs/platform-architecture.md`. |
| **Education layer separation** | **Mostly Complete** | Separate models (`EducationResource`), validator (`education_validator.py`), spec in `docs/education-layer.md`. |

---

## Backend Status

### API
**Status: Mostly Complete (foundation routes)**

- FastAPI app: `farmacograph/api/main.py` — mounts `/api/v1`, Swagger at `/docs`, public HTML search at `/search`.
- **23 `/api/v1` routes** across 7 router modules (docs claim 25; count includes `info` + curator set).
- Layering clean: routers depend on services via `farmacograph/api/deps.py` + DI container.

### Database
**Status: Mostly Complete**

- **PostgreSQL/SQLite:** `farmacograph/db/postgres/models.py` — tenants, users, API keys, jobs, audit, outbox, snapshots, curator workflows. Alembic: `alembic/versions/001_initial_operational_schema.py`.
- **Neo4j:** `farmacograph/db/neo4j/driver.py`; disabled by default (`FG_NEO4J_ENABLED=false` in `farmacograph/core/config.py`).
- Docker Compose full stack: `docker-compose.yml` (postgres, neo4j, api, studio).

### Validation
**Status: Partial**

- Registry: `farmacograph/validators/registry.py` (ontology, biomedical, education, optional schema).
- Publish gate: `farmacograph/curator/publish_validator.py` — schema+biomedical for Drug, per-edge ontology.
- **Gap:** Education validator not in publish path; many FG-C rules untested/unimplemented.

### Authentication
**Status: Partial — critical gap**

- JWT decode + scope checks: `farmacograph/auth/models.py`, `farmacograph/api/deps.py`.
- API key utilities exist (`generate_api_key`, `verify_api_key`) but **HTTP validation not wired**.
- No `POST /auth/token`, `/auth/refresh`, `/auth/introspect` routes (Studio client anticipates them in `apps/studio/src/lib/auth/api.ts`).
- **Anonymous read allowed** for `knowledge:read|search|explain|education:read`.
- **Curator scopes not blocked for anonymous** — security defect (see Technical Debt).

Evidence (`farmacograph/api/deps.py:89-97`):

```python
def require_scope(scope: str):
    async def _check(auth: ...) -> AuthContext:
        if not auth.has_scope(scope) and auth.is_authenticated is False:
            if scope in ("knowledge:read", "knowledge:search", "knowledge:explain", "education:read"):
                return auth
        if auth.is_authenticated and not auth.has_scope(scope):
            raise HTTPException(status_code=403, detail=f"Missing scope: {scope}")
        return auth  # anonymous + curator:write/publish falls through here
```

### Events
**Status: Partial**

- In-process bus: `farmacograph/events/bus.py`.
- Outbox table + repository: `farmacograph/repositories/outbox.py`.
- `DrugPublished` emitted on publish; `OutboxPublisher` (`farmacograph/events/outbox.py`) **not started** in app lifespan.
- Event catalog spec: `architecture/events.json`.

### Jobs
**Status: Partial**

- Repository: `farmacograph/repositories/jobs.py`.
- Worker abstraction: `farmacograph/workers/base.py`, `GraphValidationWorker`.
- Jobs created and sometimes executed inline; **no background worker process**.

### Search
**Status: Partial**

- Interface: `farmacograph/services/search.py` (`SearchProvider` protocol).
- Implementation: `farmacograph/search/graph_provider.py` (Neo4j CONTAINS on slug/name).
- `NullSearchProvider` when Neo4j disabled.

### Snapshots
**Status: Partial**

- Service: `farmacograph/services/snapshot.py`.
- Schema: `architecture/snapshots.schema.json`.
- Created optionally on publish; **no REST endpoints** for list/compare/export.

### Plugin interfaces
**Status: Missing (spec only)**

- `architecture/plugin-interfaces.json` defines collector, validator, exporter, search_provider, LLM, etc.
- No runtime plugin loader in codebase.

### Service layer
**Status: Mostly Complete**

- 17 service modules under `farmacograph/services/`.
- Product APIs as protocols: Explain, Compare, Learning, Reasoning (`ReasoningService` returns `not_implemented`).

### Dependency injection
**Status: Complete**

- `farmacograph/core/container.py` — wires all repos/services; `get_container()` singleton; `reset_container()` for tests.

### Logging
**Status: Complete**

- structlog: `farmacograph/core/logging.py`; JSON configurable via `FG_LOG_JSON`.

### Observability
**Status: Mostly Complete**

- Prometheus: `farmacograph/core/metrics.py`; mounted at `/metrics` when `FG_METRICS_ENABLED=true`.
- Request correlation: `CorrelationMiddleware`.

### Performance
**Status: Partial / UNKNOWN**

- No caching layer, no connection pool tuning documented.
- Rate limit **settings exist** (`rate_limit_*` in config) but **no middleware implemented**.
- Neo4j queries are simple; no load testing evidence.

### Security
**Status: Partial — High risk**

- JWT secret defaults to `change-me-in-production` (`farmacograph/core/config.py`).
- Curator endpoints may be anonymously callable (see above).
- No CORS middleware found.
- No rate limiting despite config fields.
- bcrypt/passlib for passwords; no user registration/login API.

---

## Frontend Status (Curation Studio — `apps/studio`)

| Feature | Status | Evidence |
|---------|--------|----------|
| **Studio shell** | **Done** | Next.js 15 App Router, sidebar, top nav, command palette (`src/components/layout/`) |
| **Dashboard** | **Done** | `src/components/dashboard/dashboard-view.tsx` — stats, queue, jobs, audit, 15s refresh via `useDashboard` |
| **Drug Editor** | **Missing** | `src/app/knowledge/drugs/page.tsx` → `PlaceholderPage` |
| **Evidence Manager** | **Missing** | `src/app/knowledge/evidence/page.tsx` → placeholder |
| **Relationship Editor** | **Missing** | Not routed; planned Studio 4.2 |
| **Mechanism Editor** | **Missing** | `src/app/knowledge/mechanisms/page.tsx` → placeholder |
| **Graph Explorer** | **Missing** | `src/app/graph/page.tsx` → placeholder |
| **Validation Center** | **Missing** | `src/app/validation/page.tsx` → placeholder |
| **Publish Wizard** | **Missing** | No route; client methods exist (`publishWorkflow`, etc.) but unused in UI |
| **Authentication** | **Partial** | Settings manual JWT/API key paste (`settings/page.tsx`); `login/page.tsx` exists; `authApi` calls unimplemented backend endpoints; middleware protects `/knowledge/*`, `/users/*`, etc. via cookie flag |
| **Design system** | **Done** | shadcn/ui primitives in `src/components/ui/`, Tailwind, badges, dark mode (`theme-provider.tsx`) |
| **Routing** | **Done** | 15 App Router pages per `docs/repository-structure.md` |
| **Accessibility** | **Partial** | Some `aria-label` on search; WCAG audit not done (Studio 4.5 planned) |
| **Performance** | **Partial** | No virtualization; code splitting via Next.js defaults only |

**API client coverage:** `FarmacoGraphClient` implements health, info, statistics, modules, curriculum, search, drugs, dashboard, audit, jobs, full curator workflow, explain, compare — but UI only uses subset (dashboard, search, settings per `docs/studio-roadmap.md`).

---

## API Status

### Implemented endpoints (23 under `/api/v1` + 3 app-level)

| Method | Path | Module |
|--------|------|--------|
| GET | `/api/v1/info` | `health.py` |
| GET | `/api/v1/health` | `health.py` |
| GET | `/api/v1/dashboard` | `dashboard.py` |
| GET | `/api/v1/audit-logs` | `dashboard.py` |
| GET | `/api/v1/jobs` | `dashboard.py` |
| GET | `/api/v1/drugs` | `drugs.py` |
| GET | `/api/v1/drugs/{drug_id}` | `drugs.py` |
| GET | `/api/v1/drugs/{drug_slug}/prerequisites` | `learning.py` |
| GET | `/api/v1/search` | `platform.py` |
| GET | `/api/v1/modules` | `platform.py` |
| GET | `/api/v1/modules/{module_slug}/curriculum` | `platform.py` |
| GET | `/api/v1/statistics` | `platform.py` |
| GET | `/api/v1/explain` | `explain.py` |
| POST | `/api/v1/compare` | `explain.py` |
| POST | `/api/v1/curator/validate` | `curator.py` |
| GET | `/api/v1/curator/stubs/cardiovascular` | `curator.py` |
| POST | `/api/v1/curator/workflows` | `curator.py` |
| GET | `/api/v1/curator/workflows/{workflow_id}` | `curator.py` |
| GET | `/api/v1/curator/queue` | `curator.py` |
| GET | `/api/v1/curator/validation-summary` | `curator.py` |
| POST | `/api/v1/curator/workflows/{id}/submit` | `curator.py` |
| POST | `/api/v1/curator/workflows/{id}/approve` | `curator.py` |
| POST | `/api/v1/curator/workflows/{id}/publish` | `curator.py` |
| GET | `/` | redirect → `/docs` |
| GET | `/search` | HTML search page |
| GET | `/metrics` | Prometheus (conditional) |

### Missing endpoints (in OpenAPI `openapi/openapi.yaml` but not routed)

`/drugs/{id}/graph`, `/drugs/{id}/mechanism`, `/drugs/{id}/education`, `/drug-classes`, `/diseases`, `/pathways/{id}`, `/proteins/{id}`, `/receptors/{id}`, `/enzymes/{id}`, `/interactions`, `/mechanisms/{drug_id}`, `/evidence/{id}`, `/laboratory-tests`, `/education/{id}`, `/flashcards`, `/cases`, `/graph/query`, `/rag`, `/tutor`, `/version` (referenced in docs).

### Missing endpoints (documented in roadmaps, not in OpenAPI or FastAPI)

`POST /auth/token`, `POST /auth/refresh`, `POST /auth/introspect`, snapshot HTTP API, entity CRUD beyond drugs.

### Implemented but absent from static OpenAPI file

`/info`, `/dashboard`, `/audit-logs`, `/jobs`, entire `/curator/*` tree — **major contract mismatch**.

### Broken / skeleton endpoints

| Endpoint | Issue |
|----------|-------|
| `GET /explain` | Returns empty `reasoning_chain`, `answer_summary: null` even when path found (`farmacograph/services/explain.py:40-47`) |
| `POST /compare` | All dimensions return `{"status": "no_data"}` (`farmacograph/services/compare.py:40`) |
| `GET /drugs/{id}/prerequisites` | Works only if Neo4j has `REQUIRES→KnowledgeTopic` edges |
| Curator publish | Succeeds without Neo4j when disabled (graph write skipped silently if `GraphWriter.is_available` false) |

### Unused endpoints (implemented, minimal/no Studio UI)

`audit-logs`, `jobs`, `validation-summary`, all curator mutations, `compare`, `explain`, `getCardiovascularStub`, `modules` (hook only, not in nav pages).

### Contract mismatches

1. OpenAPI version `1.0.0` vs live FastAPI `1.0.0` — paths diverge (~40% overlap).
2. `docs/api.md` lists 25 routes — accurate for `/api/v1` core set.
3. Response envelope `{data, meta}` implemented consistently.
4. `GET /drugs/{id}` expects UUID; OpenAPI allows generic id; no slug-based route (API 5.4.3 planned).
5. Learning prerequisites mounted at `/drugs/{slug}/prerequisites` but OpenAPI documents `/drugs/{id}/prerequisites` — slug vs UUID ambiguity.

---

## Documentation Status

| Document | Status | Notes |
|----------|--------|-------|
| **README.md** | **Current** | Phase table, quick start, links to live deployment |
| **Architecture** | **Current** | `docs/architecture.md`, `platform-architecture.md`, `architecture-diagrams.md` |
| **Ontology** | **Current** | `docs/ontology.md` (v1.0.0-draft); JSON artifacts in `ontology/` |
| **Roadmap** | **Current** | `docs/roadmap.md` v1.1.0 — honestly marks partial phases |
| **ADR** | **Partial** | Index only (`docs/adr/README.md`); no per-ADR markdown files |
| **OpenAPI** | **Outdated** | Missing implemented routes; includes unbuilt routes |
| **API reference** | **Mostly current** | `docs/api.md` v1.1.0 matches FastAPI better than YAML |
| **Developer docs** | **Good** | `development.md`, `getting-started.md`, `repository-structure.md`, `CONTRIBUTING.md` |
| **Studio spec** | **Current** | `curation-studio.md`, `studio-roadmap.md` |
| **Test strategy** | **Outdated** | `docs/test-strategy.md` still describes Phase 2 layout; CI exceeds doc claims |
| **MkDocs site** | **Missing** | Phase 1.11 "Not started" per roadmap |
| **Deploy guides** | **Present** | `deploy-nginx.md`, `deploy-studio.md` |

---

## Testing Status

### Backend tests
- **Location:** `tests/` — 12 test modules, **~51 test functions**.
- **Categories:** integration (`test_infrastructure.py`, `test_api_skeleton.py`), API (`test_dashboard.py`, `test_api_51.py`, `test_search_page.py`), curator (4 files), validation (2), ontology (1).
- **Fixtures:** in-memory SQLite (`FG_DATABASE_URL=sqlite+aiosqlite:///:memory:`), Neo4j disabled in CI.
- **Coverage gate:** 60% (`ci.yml` `--cov-fail-under=60`).
- **Gaps:** No `tests/unit/`, `tests/graph/`, `tests/contract/` despite `docs/test-strategy.md` plan; biomedical validator largely untested; no Neo4j integration tests in CI.

### Frontend tests
- **Vitest:** 9 unit test files, **~53 test cases**; coverage excludes `src/app/**` and most UI components.
- **Playwright:** 1 smoke test (`e2e/smoke.spec.ts` — home page title only).
- **No coverage floor** in `vitest.config.ts`.

### Integration tests
- Present but lightweight; no full publish→Neo4j→read E2E in CI (Neo4j off).

### CI quality gates
`.github/workflows/ci.yml`: Python ruff + format, mypy (`continue-on-error: true`), pytest 60% cov, OpenAPI YAML parse, ontology JSON parse, Studio lint/prettier/typecheck/unit tests, Playwright smoke, Docker build.

### Assessment
**Adequate for alpha platform; insufficient for production knowledge publishing.** Contract tests and FG-C matrix coverage are the largest gaps.

---

## Technical Debt

### Critical

| Item | Why |
|------|-----|
| **Anonymous curator API access** | `require_scope` in `deps.py` does not reject unauthenticated requests for `curator:write` / `curator:publish` — publish workflow exposed |
| **Default JWT secret** | `change-me-in-production` in config — production misconfiguration risk |
| **OpenAPI ↔ FastAPI drift** | Clients/codegen will break; no contract enforcement |

### High

| Item | Why |
|------|-----|
| **No API key HTTP validation** | Models/utilities exist; `deps.py` comment says "extended in Phase 3.5" but still JWT-only |
| **Outbox never drained** | Events written to PG outbox may never reach bus/consumers |
| **No worker daemon** | Job queue semantics misleading; inline execution only |
| **Mechanism DAG engine claimed, not built** | Roadmap ✅ contradicts empty `farmacograph/graph/` |
| **Curation still script-dependent** | `scripts/dev-only/` active while Studio editors missing |

### Medium

| Item | Why |
|------|-----|
| **Explain/Compare skeletons exposed as live API** | Consumers may assume functional product APIs |
| **Education validator omitted from publish path** | FG-C013/C014 not enforced at publish |
| **Partial FG-C implementation** | ~8 of 30 constraints coded; test matrix mostly "Planned" |
| **mypy continue-on-error** | Type safety not gated |
| **Dashboard reads staging files** | `curator/drug_package.py` filesystem coupling breaks pure API-first for module progress |
| **No CORS / rate limiting** | Config fields exist; middleware missing |
| **Studio auth calls 404 endpoints** | Graceful fallback exists (`isAuthEndpointUnavailable`) but UX incomplete |

### Low

| Item | Why |
|------|-----|
| **MkDocs not started** | Docs live in repo only |
| **No standalone ADR files** | Index sufficient for now |
| **Vitest excludes app pages** | Dashboard/integration UI untested |
| **`graph/__init__.py` placeholder** | Package reserved for future |
| **Test strategy doc stale** | Misleading for new contributors |

---

## Risks

### Architecture risks
- OpenAPI-first workflow documented but not practiced — integration debt compounds.
- Plugin system specified early with zero runtime — future externals may require refactor.
- Filesystem curriculum in dashboard couples ops UI to repo layout.

### Performance risks
- Neo4j substring search does not scale to 600–800 drugs with fuzzy/synonym needs.
- No caching; every dashboard refresh hits multiple services (15s interval in Studio).

### Scalability risks
- In-process event bus won't survive multi-instance API deployment.
- No outbox consumer / search indexer workers.
- SQLite default for local ops DB not production-grade.

### Security risks
- Anonymous curator access (Critical).
- No rate limiting on public deployment (`README.md` references live URL).
- Studio middleware uses cookie flag `AUTH_COOKIE_NAME === "1"` — weak gate, not tied to token validity server-side.

### Maintainability risks
- Documentation overstates completion (DAG engine, Phase 2 pipeline).
- Dual sources of truth: `openapi/openapi.yaml` vs FastAPI auto-schema.

### Developer experience risks
- Curators directed to Studio but must use curl/scripts for real work.
- Auth story fragmented: manual tokens, unimplemented login API, Studio login page partially built.

### Deployment risks
- Production relies on external nginx (`docs/deploy-nginx.md`) — **UNKNOWN** if live env has hardened secrets.
- Docker Studio defaults API URL to production (`docker-compose.yml` `NEXT_PUBLIC_API_URL`).

---

## Missing Features Checklist

| Feature | Status |
|---------|--------|
| Ontology specs + JSON | **Done** |
| Pydantic entity models | **Done** |
| Validator framework | **Done** |
| Full FG-C constraint coverage | **Partial** |
| Mechanism DAG acyclicity engine | **Missing** |
| Pipeline orchestrator | **Missing** |
| Collector plugins | **Missing** |
| FastAPI core platform routes | **Done** |
| Curator workflow API | **Done** |
| Graph writer (Neo4j MERGE) | **Done** |
| Snapshot service | **Partial** (no HTTP) |
| Event outbox + bus | **Partial** |
| Background worker daemon | **Missing** |
| API key auth + token endpoint | **Missing** |
| Rate limiting | **Missing** |
| OpenAPI sync + contract tests | **Missing** |
| Explain API (full chains) | **Partial** (skeleton) |
| Compare API (matrices) | **Partial** (skeleton) |
| Reasoning API | **Missing** (stub service only) |
| Learning API | **Partial** |
| Entity endpoints (diseases, proteins, …) | **Missing** |
| Graph projection API | **Missing** |
| Education endpoints | **Missing** |
| RAG / Tutor endpoints | **Missing** |
| Public search page | **Done** (`/search` HTML) |
| Curation Studio shell | **Done** |
| Studio dashboard | **Done** |
| Drug List (4.2.2) | **Missing** |
| Drug Editor (4.2.3) | **Missing** |
| Evidence Manager | **Missing** |
| Mechanism Editor (React Flow) | **Missing** |
| Graph Explorer (Cytoscape) | **Missing** |
| Validation Center UI | **Missing** |
| Publish Wizard | **Missing** |
| Snapshot Manager UI | **Missing** |
| AI Draft Assistant | **Missing** |
| Activity timeline UI | **Missing** (API exists) |
| Users / RBAC UI | **Missing** |
| Cardiovascular module (63 drugs) | **Partial** (1 stub, 62 pending) |
| Dataset version `2026.1.0` release | **Partial** (stub only) |
| Python / TypeScript SDKs | **Missing** |
| MCP server | **Missing** |
| MkDocs site | **Missing** |

---

## Suggested Priority (next 10 tasks, ranked by impact)

1. **Fix curator authentication gate** — require JWT/API key for `curator:*` scopes; block anonymous publish. *Prevents data integrity/security incident.*
2. **Implement API 5.2 auth** — `POST /auth/token`, API key validation in `get_auth_context`, wire Studio login. *Unblocks real curator sessions.*
3. **OpenAPI sync** — add all 23 live routes to `openapi/openapi.yaml`; remove or tag unimplemented as `x-fg-status: planned`. *Foundation for SDKs and contract tests.*
4. **Studio 4.2.2 Drug List** — paginated `/drugs` + curriculum status from API; replace placeholder. *First usable curation navigation.*
5. **Studio 4.2.3 Drug Editor (MVP)** — load workflow, edit sections, call `validate` + `submit`. *Eliminates script dependency.*
6. **Publish first real CV drug** (e.g. ramipril) via Studio/API with full validation package. *Proves end-to-end knowledge loop.*
7. **Wire OutboxPublisher + worker loop** (or document inline-only as intentional). *Reliable events for search indexing later.*
8. **Add Schemathesis contract tests** in CI against `/openapi.json`. *Catches drift automatically.*
9. **Implement rate limiting middleware** using existing config. *Protects public deployment.*
10. **Expand biomedical validator tests** for FG-C008–C028. *Quality gate before scaling to 63 drugs.*

---

## Progress Timeline

| Phase | Scope | Completion | Evidence |
|-------|-------|------------|----------|
| **Phase 1** | Foundation (models, validators, ontology, CI) | **~80%** | Models in `farmacograph/models/`; no MkDocs, collectors spec-only, DAG engine missing |
| **Phase 2** | Pipeline + API skeleton | **~45%** | FastAPI live; no orchestrator (`docs/roadmap.md` 2.1 Not started) |
| **Phase 3** | Platform infrastructure | **~85%** | Container, events, jobs, metrics, Docker, CI complete; worker daemon missing |
| **Phase 4** | Curation platform | **~40%** | Backend curator ✅; Studio shell ✅; editors ❌; CV data ~2% |
| **Overall** | Full product vision | **~38%** | Weighted: specs strong, content/UI product weak |

**Estimate explanation:** Infrastructure and specifications are mature for an alpha. The value-delivering layers — curated knowledge graph, Studio editors, deep APIs, AI surfaces — are largely unbuilt. README "Complete" labels apply to foundation milestones, not the pharmacopedia product.

---

## Repository Health

| Dimension | Assessment |
|-----------|------------|
| **Folder organization** | **Good** — monorepo map in `docs/repository-structure.md` matches reality |
| **Naming consistency** | **Good** — `farmacograph.*` Python package, `@farmacograph/studio` |
| **Code duplication** | **Low** — shared API client, centralized validators |
| **Complexity** | **Moderate** — container wiring is large but readable |
| **Modularity** | **Good** — clear api/services/repositories split |
| **Layer separation** | **Good** — minor leak: dashboard curriculum from filesystem |
| **Architecture cleanliness** | **Good** with documented exceptions |

**File counts (evidence):** 89 Python modules in `farmacograph/`, 100 TS/TSX under `apps/studio/src/`, 32 docs, 7 ontology files, 26 test files total.

---

## AI Readiness

| Capability | Readiness | Evidence |
|------------|-----------|----------|
| **AI Draft Assistant** | **Not ready** | Spec in `curation-studio.md` Studio 4.4; no LLM plugin runtime; FG-C028 validator exists |
| **Explain API** | **Not ready** | Route live but empty reasoning chains (`explain.py`) |
| **Reasoning API** | **Not ready** | `ReasoningService.reason` returns `not_implemented`; no HTTP route |
| **Learning API** | **Partial** | Prerequisites endpoint; needs populated learning graph |
| **Simulation Engine** | **Not ready** | Product roadmap V4 2028 (`docs/product/roadmap.md`) |
| **Public SDK** | **Not ready** | API 5.5 planned; OpenAPI drift blocks codegen |
| **Developer Platform** | **Not ready** | No keys, rate limits, or stable contract |
| **Marketplace** | **Not ready** | Plugin interfaces JSON only; V5 roadmap |

**Prerequisite for any AI surface:** populated, evidence-linked biomedical graph + stable Explain/Reasoning traversal.

---

## Progress Since Last Audit

**BASELINE AUDIT** — no prior audit artifacts to compare.

This report establishes the reference baseline for future audits. Key baseline metrics:

- 23 `/api/v1` routes live
- Studio 4.1 complete, 10/15 pages placeholders
- 51 backend tests, 60% coverage floor
- 1 published structural stub drug (when Neo4j enabled)
- 63 CV drugs queued, 62 `pending`
- OpenAPI ~40% aligned with implementation

---

## Recommended Next Engineering Sprint

**Sprint theme:** *Secure, visible curation path*

**Duration:** 2 weeks (suggested)

| # | Task | Owner hint | Done when |
|---|------|------------|-----------|
| 1 | Patch `require_scope` to deny anonymous for non-read scopes | Backend | Unauthenticated `POST /curator/workflows` returns 401 |
| 2 | Implement `POST /api/v1/auth/token` (password + api_key grants) | Backend | Studio `loginWithPassword` / `loginWithApiKey` succeed |
| 3 | Validate API keys from `api_keys` table in `get_auth_context` | Backend | Scope resolved from DB record |
| 4 | Update `openapi/openapi.yaml` with info, dashboard, curator, auth paths | Platform | `python validate` + manual diff clean |
| 5 | Studio Drug List page (`/knowledge/drugs`) | Frontend | Lists drugs from API with status badges |
| 6 | Wire curator queue actions on dashboard → workflow detail drawer | Frontend | Submit/approve visible (publish can wait) |
| 7 | Add integration test: create→submit→approve→publish stub with auth | QA | Passes in CI with SQLite |
| 8 | Document production auth requirements in `getting-started.md` | Docs | Anonymous curator explicitly disabled |
| 9 | Start `tests/validation/test_biomedical.py` for FG-C008, C009, C015 | QA | 3+ constraints covered |
| 10 | Curate **one** real drug JSON (ramipril) in `staging/cardiovascular/drugs/` and publish | Content | Appears in `GET /drugs?module=cardiovascular` |

**Sprint exit criteria:** A curator can authenticate in Studio, browse drugs, and publish one real cardiovascular entry without shell scripts; curator endpoints reject anonymous writes.

---

# Executive Summary (for humans)

FarmacoGraph has **strong architectural foundations** — clean backend layering, thorough docs, working curator API, Docker/CI, and a polished Studio shell with a live dashboard. It is **not yet a knowledge product**: almost no drug content (one structural stub), Studio editors are placeholders, Explain/Compare are skeletons, and the static OpenAPI contract is badly out of sync with FastAPI.

**Overall: ~38% toward the full vision, ~52% toward V1 infrastructure.** The most urgent issue is **curator endpoint authentication** — anonymous callers may be able to hit publish workflows. The highest-impact next step is a **"secure curation path" sprint**: fix auth, sync OpenAPI, ship Drug List/Editor in Studio, and publish the first real cardiovascular drug.

---

# AI Handoff Summary

```
PROJECT: FarmacoGraph — API-first biomedical knowledge graph + Curation Studio (Next.js)
AUDIT: Baseline (2026-07-08). No prior audit files.

COMPLETION: ~38% full vision | ~52% V1 infra | Content ~1% (1 CV stub, 62/63 pending)

STACK:
- Backend: Python 3.12, FastAPI, SQLAlchemy async (PG/SQLite), Neo4j optional (FG_NEO4J_ENABLED)
- Frontend: apps/studio — Next.js 15, React 19, TanStack Query, shadcn/ui
- DI: farmacograph/core/container.py
- Entry: farmacograph/api/main.py

LIVE API ROUTES (23): /info, /health, /dashboard, /audit-logs, /jobs, /drugs, /drugs/{id},
  /drugs/{slug}/prerequisites, /search, /modules, /modules/{slug}/curriculum, /statistics,
  /explain, /compare, /curator/* (validate, stubs, workflows CRUD, queue, submit, approve, publish)

NOT IMPLEMENTED: auth endpoints, entity APIs, graph/mechanism/education endpoints, RAG/tutor,
  snapshot HTTP API, worker daemon, outbox polling, plugins runtime, pipeline orchestrator,
  mechanism DAG engine (despite roadmap claim), rate limiting, CORS

STUDIO: 4.1 DONE (dashboard, search, settings, shell). Placeholders: all /knowledge/*, /graph,
  /validation, /snapshots, /activity, /users. Client has curator mutations; UI doesn't use them.

CRITICAL DEBT: require_scope (deps.py) allows anonymous curator:write/publish.
  OpenAPI yaml missing implemented routes. JWT default secret.

TESTS: pytest ~51 tests, 60% cov floor; Studio vitest ~53 tests; 1 Playwright smoke.
  No contract/Neo4j CI tests.

NEXT SPRINT (priority order):
1. Fix curator auth gate
2. POST /auth/token + API key validation (API 5.2)
3. OpenAPI sync + curator routes
4. Studio Drug List + Editor MVP
5. Publish first real CV drug (ramipril)
6. Outbox/worker wiring or document inline-only
7. Schemathesis CI

KEY PATHS:
- Specs: docs/ontology.md, docs/platform-architecture.md, docs/studio-roadmap.md
- Contract: openapi/openapi.yaml (OUTDATED)
- Curator: farmacograph/services/curator.py, api/routers/curator.py
- Studio client: apps/studio/src/lib/api/client.ts
- CV queue: staging/cardiovascular/curriculum.yaml (63 slugs, pending)
```
