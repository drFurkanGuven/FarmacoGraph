# FarmacoGraph Post-Sprint Architecture Audit

**Sprint:** 4 — Publish Wizard and Curation Workflow UX  
**Audit date:** 2026-07-08  
**Repository:** `/Users/furkan/Desktop/FarmacoGraph`  
**Auditor:** Architecture Auditor (read-only)  
**Prior audit:** [`docs/audits/2026-07-08-sprint3-architecture-audit.md`](2026-07-08-sprint3-architecture-audit.md)

---

## 1. Executive Summary

### Sprint outcome

Sprint 4 **achieved its primary goal**: curators can complete the full curation workflow in Studio — open a drug editor, review validation readiness, advance `submit` → `approve` → `publish` via a typed API client, see workflow state in the right sidebar, and inspect an activity timeline backed by audit logs. The secure curation path is **functionally complete end-to-end in Studio** for the drug editor path.

### Project health (post-Sprint 4)

| Lens | Status | Notes |
|------|--------|-------|
| **Full curation path (login → edit → validate → publish)** | **Mostly complete (~95%)** | Publish wizard live; E2E uses mocks only; no live publish E2E |
| **Backend curator API** | **Complete** for sprint scope | 15 curator routes; timeline + enhanced publish response |
| **Studio publish UX** | **Complete** (core) | Wizard, state panel, timeline, scope gating; snapshots page still placeholder |
| **Contract alignment** | **Partial** | Timeline + publish response extras not in OpenAPI; docs stale |
| **Test coverage (sprint-critical paths)** | **Strong** | +22 Studio tests; timeline backend tests; shallow publish E2E |

### Overall completion estimate (updated)

| Lens | Post-Sprint 3 | Post-Sprint 4 |
|------|---------------|---------------|
| Full platform vision | ~38–42% | ~40–44% (unchanged knowledge content) |
| V1 milestone (platform + CV module) | ~58–62% | **~65–68%** (full Studio curation loop) |
| Secure curation path (draft → publish) | ~90% | **~95%** (UI publish live; E2E depth gap) |

### Biggest risks (post-sprint)

1. **Documentation drift is severe** — `README.md`, `docs/studio-roadmap.md`, `docs/curation-studio.md`, `docs/api.md`, and `docs/deploy-studio.md` still state Studio 4.4 publish wizard is "Next" / "API-only". This will mislead deployers and AI planners.
2. **OpenAPI contract lags implementation** — `GET /curator/workflows/{id}/timeline` is absent from `openapi/openapi.yaml`; publish response still documents `WorkflowEnvelopeResponse` without `graph_write`, `snapshot`, or `published_slug` fields.
3. **E2E publish coverage is shallow** — `publish-wizard.spec.ts` mocks all API calls; no Playwright test exercises real `submit` → `approve` → `publish` against a running API.
4. **Knowledge content still minimal** — 1 structural stub; 63/63 CV drugs `pending` in `staging/cardiovascular/curriculum.yaml`; graph APIs return skeleton without populated Neo4j.
5. **Outbox publisher still not started** at app lifespan — unchanged; events durable in DB but not polled to bus.

### Biggest strengths

1. **End-to-end Studio publish wizard** — `PublishWizard` dialog wired from Drug Editor header (`drug-editor-workspace.tsx:103–106`, `168–179`); actions call `submitWorkflow`, `approveWorkflow`, `publishWorkflow` via typed client.
2. **Validation reuse** — `usePublishReadiness` accepts `editorValidation` with `skipPackageFetch` to avoid duplicate validation calls (`use-publish-readiness.ts:41–72`).
3. **Workflow activity timeline** — Backend `GET /curator/workflows/{id}/timeline` (`curator.py:215–236`) + `WorkflowTimeline` in context panel (`drug-context-panel.tsx:108`).
4. **Enhanced publish response** — `build_publish_result_async` returns `graph_write`, `snapshot`, `published_slug`, `validation_summary` (`services/curator.py:190–210`); Studio types in `types.ts:218–226`; UI in `snapshot-result-card.tsx`.
5. **Scope-gated actions** — Approve/publish blocked without `curator:publish` (`use-publish-wizard.ts:222–226`); backend enforces same scopes.
6. **Test growth** — Studio **131 passed** (verified); backend **128 passed** (per sprint report; CI on Python 3.12); +2 timeline API tests.

### Recommended next milestone

**Documentation + contract sync sprint:** Update all stale 4.4 references; add timeline and publish response schemas to OpenAPI; add live-stack E2E publish flow. Then **first real CV drug curation** end-to-end to prove pipeline beyond structural stub.

---

## 2. Definition of Done — Sprint 4 Checklist

| # | Sprint goal | Status | Evidence |
|---|-------------|--------|----------|
| 1 | Publish Wizard in Drug Editor (submit/approve/publish via typed API client) | **Done** | `apps/studio/src/components/publish-wizard/publish-wizard.tsx`; `use-publish-wizard.ts:121–133` calls `client.submitWorkflow`, `approveWorkflow`, `publishWorkflow`; header button `drug-editor-workspace.tsx:103–106` |
| 2 | Workflow State Panel in right sidebar | **Done** | `workflow-state-panel.tsx`; embedded in `drug-context-panel.tsx:68` (desktop + mobile drawer) |
| 3 | Validation-to-publish integration (reuses editor validation via `usePublishReadiness` + `editorValidation`) | **Done** | `drug-editor-workspace.tsx:176–177` passes `snapshot.validation`; `use-publish-readiness.ts:41–72` `skipPackageFetch` when editor validation present |
| 4 | Workflow activity timeline via `GET /curator/workflows/{id}/timeline` | **Done** | Backend `curator.py:215–236`, `services/curator.py:277–292`; Studio `workflow-timeline.tsx` + `client.getWorkflowTimeline` (`client.ts:142–146`) |
| 5 | Publish response enhanced with snapshot/graph_write metadata | **Done** | `services/curator.py:190–210`; `curator.py:341–347`; `types.ts:218–226`; `snapshot-result-card.tsx`; test `test_curator_api.py:74–75` |
| 6 | Backend tests: 128 passed | **Reported done** (not re-verified locally) | Local env Python 3.9 cannot run pytest (`ImportError: UTC`); CI runs on 3.12 (`.github/workflows/ci.yml:80–87`); ~110 `def test_` functions in `tests/` |
| 7 | Studio tests: 131 passed; build passes | **Verified** | `npm test -- --run` → 24 files, **131 passed** |
| 8 | E2E `publish-wizard.spec.ts` added | **Done** (partial depth) | `apps/studio/e2e/publish-wizard.spec.ts` — opens wizard, asserts readiness; **all API mocked** via `mockPublishWizardApi` |
| 9 | Documentation updated for Sprint 4 | **Not done** | `README.md:20`, `docs/studio-roadmap.md:33–51`, `docs/curation-studio.md:4–8,88`, `docs/api.md:217`, `docs/deploy-studio.md:36–38` still say 4.4 is next/API-only |
| 10 | OpenAPI updated for timeline + publish response | **Not done** | No `timeline` path in `openapi/openapi.yaml`; publish response schema is `WorkflowEnvelopeResponse` only (line 453) |

**Sprint DoD verdict:** **PASS with documentation/contract gaps** — all functional deliverables met; docs and OpenAPI not updated (should be immediate follow-up, not sprint failure).

### Sprint scope explicitly deferred (not DoD failures)

| Item | Status | Notes |
|------|--------|-------|
| Snapshots manager page (`/snapshots`) | **Deferred** | Still placeholder per `studio-roadmap.md:24` |
| Mechanism editor, graph explorer | **Deferred** | Placeholder pages |
| Live-stack E2E publish (no mocks) | **Deferred** | Recommended post-sprint |
| Full OpenAPI ↔ FastAPI parity | **Out of scope** | ~20+ planned paths in spec without routers |

---

## 3. Remaining Gaps and Risks

### Functional gaps (curation path)

| Gap | Severity | Detail |
|-----|----------|--------|
| Stale documentation | **High** | Five primary docs contradict implemented publish wizard |
| OpenAPI missing timeline + publish extras | **Medium–High** | Contract drift; no contract test for timeline |
| E2E publish uses mocks only | **Medium** | `publish-wizard.spec.ts` does not hit real API transitions |
| Duplicate `SnapshotResultCard` render | **Low** | `publish-phases.tsx:122–131` renders card twice on success |
| No `GET /drugs/{slug}` | **Medium** | Editor uses curator slug workflows; public drug detail remains UUID-only |
| Dashboard reads curriculum from filesystem | **Medium** | `farmacograph/curator/drug_package.py` — API-first violation (pre-existing) |
| Education validator not in publish gate | **Medium** | Pre-existing; publish uses schema + biomedical + per-edge ontology only |
| Snapshots page placeholder | **Low–Medium** | Publish shows snapshot metadata in wizard; no list/diff UI |

### Security gaps

| Gap | Severity | Detail |
|-----|----------|--------|
| Timeline endpoint not in security regression | **Low** | `test_security_regression.py` covers submit/approve/publish but not `GET .../timeline` |
| Studio middleware cookie guard | **Low** (UI only) | `middleware.ts:12` — cosmetic; API `require_scope` is real boundary |
| No rate limiting on auth endpoints | **Medium** | Phase API 5.3 not implemented |
| JWT in localStorage | **Medium** (accepted) | Standard SPA tradeoff per `studio-roadmap.md` |

### Architecture / ops gaps (unchanged from Sprint 3)

| Gap | Severity | Detail |
|-----|----------|--------|
| Outbox publisher not started | **Medium** | `events/outbox.py` exists; `api/main.py` lifespan does not poll |
| Jobs run inline on publish | **Medium** | `graph_validation` not via background worker |
| Plugin system | **Low** (future) | Spec only; no runtime loader |
| Knowledge graph sparse | **High** (product) | Explain/compare return skeleton/no_data without Neo4j content |

---

## 4. Architecture Compliance

| Area | Status | Reasoning |
|------|--------|-----------|
| **API-first curation** | **Mostly Complete** | Studio uses `FarmacoGraphClient` only; dashboard still reads staging files |
| **Curator workflow (FG-C023)** | **Complete** | State machine + API + Studio UI transitions |
| **Auth (ADR-025, API 5.2)** | **Complete** | JWT + API key + introspect; scope gating in wizard |
| **Studio route protection** | **Mostly Complete** | Middleware + AuthGate; cookie is weak UI gate |
| **Validation on edit + publish** | **Complete** | Editor debounces validate; wizard reuses editor validation |
| **Publish path (Studio)** | **Complete** | Wizard wired; scope checks; unsaved-changes guard |
| **Workflow audit timeline** | **Complete** | Audit repo → timeline API → Studio component |
| **Event bus / outbox** | **Partial** | Write path appends; publisher not started |
| **OpenAPI-first** | **Partial** | Sprint routes partially documented; timeline + publish response missing |
| **Snapshots (ADR-014)** | **Partial** | Created on publish; metadata in response; no HTTP list API or Studio page |
| **Curation Studio (ADR-020–024)** | **Mostly Complete** | Drug path complete through publish; mechanism/graph/snapshots pages missing |

---

## 5. Backend Status

| Subsystem | Status | Evidence |
|-----------|--------|----------|
| **API** | **Mostly Complete** | **32** `/api/v1` routes across 8 router modules (+1 vs Sprint 3: timeline) |
| **Database** | **Mostly Complete** | PostgreSQL models for workflows, audit, snapshots, outbox, jobs |
| **Validation** | **Mostly Complete** | 4 validators; publish gate in `publish_validator.py` |
| **Authentication** | **Complete** | `auth.py` token/refresh/introspect; `require_scope` fixed |
| **Events** | **Partial** | Outbox writes on publish; `OutboxPublisher` not in lifespan |
| **Jobs** | **Partial** | Enqueued; `graph_validation` inline on publish |
| **Search** | **Partial** | Neo4j provider when enabled; FTS planned |
| **Snapshots** | **Partial** | `SnapshotService`; optional on publish; no list HTTP route |
| **Plugin interfaces** | **Missing** | Spec only |
| **Service layer / DI** | **Complete** | `Container` in `core/container.py`; routers → services → repos |
| **Logging / observability** | **Mostly Complete** | structlog, Prometheus, correlation middleware |
| **Performance** | **Acceptable** | Inline jobs acceptable for alpha; publish latency risk at scale |
| **Security** | **Mostly Complete** | Curator mutations require auth; regression tests present |

### New/changed backend (Sprint 4)

- `GET /api/v1/curator/workflows/{workflow_id}/timeline` — audit-derived activity feed
- `POST .../publish` response extended via `build_publish_result_async` with `graph_write`, `snapshot`, `published_slug`, `published_at`, `validation_summary`
- `tests/curator/test_workflow_timeline.py` — 2 tests for timeline kinds including `publish_failed`

---

## 6. Frontend Status

| Feature | Status | Evidence |
|---------|--------|----------|
| **Studio shell** | **Complete** | App shell, nav, dark mode, command palette |
| **Dashboard** | **Complete** | `dashboard-view.tsx` + `GET /dashboard` |
| **Drug Editor** | **Complete** | Sectioned editor, autosave, context panel, **Publish button** |
| **Publish Wizard** | **Complete** | `publish-wizard/` module — overview, confirm, result phases |
| **Workflow State Panel** | **Complete** | Sidebar + wizard; `useDrugWorkflowState` hook |
| **Workflow Timeline** | **Complete** | `workflow-timeline/` in context panel |
| **Validation Center** | **Complete** | `/validation` page |
| **Evidence Manager** | **Missing** | Placeholder |
| **Relationship Editor** | **Missing** | Placeholder |
| **Mechanism Editor** | **Missing** | Placeholder |
| **Graph Explorer** | **Missing** | Placeholder |
| **Snapshots page** | **Missing** | Placeholder route |
| **Authentication** | **Complete** | Login, scopes, `hasPermission` for publish actions |
| **Design system** | **Complete** | shadcn/ui components, badges, timeline |
| **Routing** | **Complete** | Slug-based drug editor |
| **Accessibility** | **Partial** | Dialog wizard; no dedicated a11y audit |
| **Performance** | **Acceptable** | Editor validation debounced; wizard skips redundant fetch |

---

## 7. API Status

### Implemented endpoints (32 total)

| Router | Count | Routes |
|--------|-------|--------|
| Curator | 15 | drugs, slug workflows/package/workflow-state, workflows CRUD, timeline, queue, validate, stubs, validation-summary, submit, approve, publish |
| Auth | 3 | token, refresh, introspect |
| Dashboard | 3 | dashboard, audit-logs, jobs |
| Health | 2 | info, health |
| Drugs | 2 | list, detail by UUID |
| Learning | 1 | prerequisites |
| Platform | 4 | search, modules, curriculum, statistics |
| Explain | 2 | explain, compare |

### Sprint 4 API additions

| Endpoint | Status | Contract in OpenAPI | Tests |
|----------|--------|---------------------|-------|
| `GET /curator/workflows/{id}/timeline` | **Live** | **Missing** | `test_workflow_timeline.py` (2) |
| `POST .../publish` enhanced body | **Live** | **Stale** (no extras in schema) | `test_curator_api.py:74–75` |

### Missing endpoints (from OpenAPI spec, not implemented)

Planned entity routes (`/mechanisms`, `/diseases`, `/evidence`, `/education`, `/graph/*`, `/snapshots` HTTP API, `/reasoning`, `/simulate`, etc.) — unchanged from baseline.

### Contract mismatches

| Mismatch | Detail |
|----------|--------|
| Timeline absent from OpenAPI | Implemented in FastAPI; not in `openapi/openapi.yaml` |
| Publish response schema | OpenAPI: `WorkflowEnvelopeResponse`; FastAPI returns workflow + `graph_write` + `snapshot` + metadata |
| `docs/api.md` | No timeline section; line 217 says Studio publish "not yet wired" |
| Auth introspect envelope | Flat body vs `{data, meta}` on curator routes (pre-existing) |

---

## 8. Documentation Status

| Document | Status | Issue |
|----------|--------|-------|
| `README.md` | **Stale** | Line 20: "Studio UI not wired" for 4.4 |
| `docs/studio-roadmap.md` | **Stale** | Lines 33, 51: publish API-only; contradicts lines 19–21 |
| `docs/curation-studio.md` | **Stale** | Lines 4–8, 88: publish wizard "not yet wired" |
| `docs/api.md` | **Stale** | Line 217; missing timeline endpoint |
| `docs/deploy-studio.md` | **Stale** | Lines 36–38: "API-only until Studio 4.4" |
| `docs/platform-architecture.md` | **Stale** (pre-existing) | Introspect marked "Planned" |
| `docs/architecture.md` | **Mostly current** | High-level accurate |
| `docs/phase4-curator.md` | **Mostly current** | Backend workflow documented |
| OpenAPI | **Partial** | Curator transitions documented; timeline + publish extras missing |
| ADR index | **Complete** | `docs/adr/README.md` |

---

## 9. Testing Status

| Suite | Sprint 3 | Sprint 4 | Evidence |
|-------|----------|----------|----------|
| Backend unit/contract | 124 passed, 5 skipped | **128 passed** (reported) | CI `pytest -m "not integration"`; local blocked (Py 3.9) |
| Studio unit | 109 passed | **131 passed** (verified) | +`publish-wizard.test.ts`, +`timeline-utils.test.ts`, +`issue-grouping.test.ts` |
| Security regression | Present | **Unchanged** | No timeline in anonymous-denial matrix |
| Studio E2E | 4 specs | **5 specs** | +`publish-wizard.spec.ts` (mocked) |
| Integration | Present | **Unchanged** | `tests/integration/` |
| Contract CI | YAML syntax only | **Unchanged** | No Schemathesis / FastAPI diff |
| Coverage floor | 60% Python | **Unchanged** | `.github/workflows/ci.yml:87` |

### Sprint-critical new tests

- `apps/studio/src/components/publish-wizard/__tests__/publish-wizard.test.ts` — `gatePublishAction`, section mapping
- `apps/studio/src/components/workflow-timeline/__tests__/timeline-utils.test.ts`
- `apps/studio/src/components/publish-wizard/validation/__tests__/issue-grouping.test.ts`
- `tests/curator/test_workflow_timeline.py`

---

## 10. Technical Debt

| Rank | Item | Why |
|------|------|-----|
| **Critical** | Documentation says publish UI missing while code ships it | Deploy/runbook risk; AI planning errors |
| **High** | OpenAPI missing timeline + publish response fields | Contract consumers break; no automated drift detection |
| **High** | Knowledge content ~1% | Product cannot demonstrate value |
| **Medium** | E2E publish mocked only | Regression blind spot for real API integration |
| **Medium** | Outbox publisher not started | Events stuck in DB |
| **Medium** | Inline `graph_validation` on publish | Latency at scale |
| **Medium** | Dashboard filesystem curriculum read | API-first violation |
| **Low** | Duplicate `SnapshotResultCard` in `publish-phases.tsx:122–131` | UI bug / copy-paste |
| **Low** | Cookie-based Studio middleware | Cosmetic bypass only |
| **Low** | mypy `continue-on-error` in CI | Type safety not gated |

---

## 11. Risks

| Category | Risk |
|----------|------|
| **Architecture** | Contract drift accelerates as more sprint features ship without OpenAPI updates |
| **Performance** | Publish blocks on inline graph validation + Neo4j MERGE |
| **Scalability** | No background worker daemon; outbox not polled |
| **Security** | Auth endpoints unrate-limited; timeline readable with `curator:write` (acceptable) |
| **Maintainability** | Docs contradict code — high onboarding cost |
| **Developer experience** | Local Python 3.9 cannot run tests; requires 3.12 per CI |
| **Deployment** | Operators following `deploy-studio.md` will not test publish wizard |

---

## 12. Missing Features Checklist

| Feature | Status |
|---------|--------|
| Phase 0 specs / ontology | **Done** |
| Phase 3 infrastructure (Docker, PG, Neo4j) | **Done** |
| Phase 4 backend curator API | **Done** |
| Phase API 5.1 discovery/search | **Done** |
| Phase API 5.2 JWT/auth | **Done** |
| Studio 4.1 shell + dashboard | **Done** |
| Studio 4.2 drug browser + editor | **Done** |
| Studio 4.3 validation center | **Done** |
| **Studio 4.4 publish wizard** | **Done** (core) |
| Workflow activity timeline | **Done** |
| Snapshots manager UI | **Missing** |
| Mechanism editor | **Missing** |
| Graph explorer | **Missing** |
| Evidence manager | **Missing** |
| Relationship editor | **Missing** |
| Education layer editor | **Missing** |
| AI draft assistant | **Missing** |
| Diff viewer | **Missing** |
| Public SDK | **Missing** |
| MCP server | **Missing** |
| Pipeline / collectors | **Missing** |
| Plugin runtime | **Missing** |
| GraphQL / SPARQL | **Missing** |
| CV module (~70 drugs curated) | **Missing** (63 pending) |
| Reasoning / simulation APIs | **Partial** (skeleton) |
| Rate limiting | **Missing** |
| Outbox polling at runtime | **Missing** |
| Background job worker | **Missing** |
| Full OpenAPI parity | **Partial** |
| Live E2E publish | **Missing** |

---

## 13. Suggested Priority (post-sprint, top 10)

| Rank | Task | Impact |
|------|------|--------|
| 1 | **Update all stale 4.4 documentation** | README, studio-roadmap, curation-studio, api.md, deploy-studio |
| 2 | **OpenAPI: timeline + publish response schemas** | Contract truth for SDK/AI consumers |
| 3 | **Live-stack E2E publish flow** | Real submit → approve → publish regression |
| 4 | **Curate first real CV drug end-to-end** | Proves pipeline beyond structural stub |
| 5 | **Snapshots HTTP API + Studio `/snapshots` page** | Publish preview / release management |
| 6 | **OpenAPI ↔ FastAPI diff CI** | Prevents recurring drift |
| 7 | **Start outbox publisher in API lifespan** | Event durability → bus |
| 8 | **Fix duplicate SnapshotResultCard** | Polish publish result UI |
| 9 | **Background worker for graph_validation** | Publish latency at scale |
| 10 | **Mechanism editor (Studio 4.3)** | Next major editor surface |

---

## 14. Progress Timeline

| Phase | Estimate | Notes |
|-------|----------|-------|
| Phase 1 — Foundation (specs, validators, API contract) | **~95%** | Unchanged |
| Phase 2 — Infrastructure | **~90%** | Docker, CI, auth |
| Phase 3 — Curation backend | **~90%** | Workflow, publish, timeline |
| Phase 4 — Studio (drug path) | **~85%** | Through publish wizard; snapshots/mechanism/graph remain |
| Overall V1 platform | **~65–68%** | Up from ~58–62% post-Sprint 3 |
| Overall full vision | **~40–44%** | Knowledge content bottleneck |

---

## 15. Repository Health

| Criterion | Assessment |
|-----------|------------|
| Folder organization | **Good** — `farmacograph/`, `apps/studio/`, `docs/`, `tests/` clear separation |
| Naming consistency | **Good** — curator/workflow/publish terminology aligned |
| Code duplication | **Low** — validation logic shared via `usePublishReadiness`; minor duplicate card render |
| Complexity | **Moderate** — publish wizard module well-factored (`validation/`, hooks, phases) |
| Modularity | **Good** — `publish-wizard/`, `workflow-timeline/` as discrete packages |
| Layer separation | **Good** — API client → hooks → components; backend routers → services |
| Architecture cleanliness | **Good** with known violations (dashboard filesystem reads) |

---

## 16. AI Readiness

| Capability | Ready? | Notes |
|------------|--------|-------|
| AI Draft Assistant | **Partial** | Studio shell + editor exist; no draft API or UI |
| Explain API | **Partial** | Route live; needs graph content |
| Reasoning API | **Partial** | Skeleton service |
| Learning API | **Partial** | Prerequisites route only |
| Simulation Engine | **Missing** | Spec only |
| Public SDK | **Not ready** | OpenAPI incomplete; no generated client package |
| Developer Platform | **Not ready** | No marketplace, plugins, or keys portal |
| Marketplace | **Missing** | Future per product roadmap |

---

## 17. Progress Since Last Audit (Sprint 3 → Sprint 4)

| Subsystem | Sprint 3 | Sprint 4 | Delta |
|-----------|----------|----------|-------|
| **Studio publish UI** | API client only | **Full wizard** | ✅ Major improvement |
| **Workflow state in sidebar** | Basic validation card | **WorkflowStatePanel + timeline** | ✅ Improved |
| **Validation → publish** | Separate flows | **Shared editor validation** | ✅ Improved |
| **Timeline API** | Missing | **GET .../timeline** | ✅ New |
| **Publish response** | Workflow only | **+graph_write, snapshot, metadata** | ✅ Improved |
| **Backend tests** | 124 passed | 128 passed | ✅ +4 |
| **Studio tests** | 109 passed | 131 passed | ✅ +22 |
| **E2E** | Drug navigation | +publish wizard smoke | ✅ Partial |
| **Documentation** | Minor drift | **Major drift** (says 4.4 not done) | ❌ Regressed |
| **OpenAPI** | Curator routes present | Timeline + publish extras missing | ⚠️ New gap |
| **Outbox / jobs / plugins** | Partial | Unchanged | — |
| **Knowledge content** | ~1–2% | ~1–2% | — |
| **Security gate** | Fixed | Unchanged | — |

**Resolved technical debt (Sprint 3):** "Publish still CLI/API-only" — Studio wizard now live.

**New technical debt:** documentation contradicts implementation; OpenAPI lag on new endpoints; shallow E2E; duplicate snapshot card render.

---

## 18. Deployment Readiness Assessment

### Full curation path — production readiness

| Criterion | Ready? | Notes |
|-----------|--------|-------|
| Authenticated curator API | **Yes** | PostgreSQL + seeded users required |
| Studio login | **Yes** | JWT/API key |
| Drug browse → edit → autosave | **Yes** | Docker Compose includes `studio` |
| Validation in Studio | **Yes** | Editor + validation center |
| **Publish from Studio** | **Yes** | Wizard calls live API; needs `curator:publish` for approve/publish |
| Workflow timeline | **Yes** | Audit-backed; requires workflow ID |
| Anonymous curator blocked | **Yes** | Regression tests |
| Production JWT secret | **Required** | Non-default `FG_JWT_SECRET_KEY` |
| Neo4j for graph write | **Required for publish** | `FG_NEO4J_ENABLED=true` |
| HTTPS / reverse proxy | **Documented** | `docs/deploy-studio.md`, nginx config |
| Deploy docs accurate | **No** | Still describe API-only publish |

### Deployment checklist (updated — post-Sprint 4)

```bash
docker compose up -d --build api studio
# Verify: Login → Drug Browser → /knowledge/drugs/ramipril → autosave → validation
# NEW: Header "Publish" → wizard → submit (curator:write) → approve/publish (curator:publish)
# NEW: Right sidebar workflow state + activity timeline
```

| Environment | Verdict | Rationale |
|-------------|---------|-----------|
| **Staging / pilot curation (full loop)** | **READY** | Draft edit, validate, publish in Studio with auth + Neo4j |
| **Production curator release** | **MOSTLY READY** | UI complete; update deploy docs; knowledge content minimal; outbox not polled |
| **Public read-only API** | **READY** (caveats) | Anonymous read disabled in production; Neo4j needed for search |

### Pre-production recommendations (ordered)

1. Update `README.md`, `docs/deploy-studio.md`, `docs/studio-roadmap.md`, `docs/curation-studio.md`, `docs/api.md` to reflect live publish wizard.
2. Add OpenAPI schemas for timeline and enhanced publish response.
3. Run manual smoke: Login → editor → Publish wizard → submit → approve → publish on staging with Neo4j enabled.
4. Seed production PostgreSQL with curator + reviewer users (`curator:write` + `curator:publish`).
5. Add live-stack E2E publish before relying solely on mocked tests.

---

## 19. Evidence-Based Findings

### 19.1 Publish wizard integration

```103:106:apps/studio/src/components/drug-editor/drug-editor-workspace.tsx
          <Button variant="default" size="sm" onClick={() => setPublishOpen(true)}>
            <Rocket className="h-4 w-4" />
            Publish
          </Button>
```

```168:179:apps/studio/src/components/drug-editor/drug-editor-workspace.tsx
      <PublishWizard
        open={publishOpen}
        onOpenChange={setPublishOpen}
        drugId={drugId}
        workflow={workflow}
        package={snapshot.package}
        saveStatus={snapshot.saveStatus}
        dirtySections={snapshot.dirtySections}
        editorValidation={snapshot.validation}
        validationPending={snapshot.validationPending}
        onWorkflowUpdated={handleWorkflowUpdated}
        onNavigateSection={setActiveSection}
```

### 19.2 Editor validation reuse

```41:72:apps/studio/src/components/publish-wizard/validation/use-publish-readiness.ts
  const useEditorValidation = skipPackageFetch && editorValidation != null;
  // ...
  const packageValidation = useMemo(() => {
    if (useEditorValidation && packageInput) {
      return toPackageValidationSnapshot(editorValidation!, packageInput);
    }
    return packageQuery.data?.data ?? null;
  }, [useEditorValidation, editorValidation, packageInput, packageQuery.data?.data]);
```

### 19.3 Timeline API

```215:236:farmacograph/api/routers/curator.py
@router.get("/workflows/{workflow_id}/timeline")
async def get_workflow_timeline(
    workflow_id: UUID,
    service=Depends(get_curator_service),
    _auth: Annotated[AuthContext, Depends(require_scope("curator:write"))] = None,
    limit: int = Query(50, ge=1, le=100),
    offset: int = Query(0, ge=0),
) -> dict:
```

### 19.4 Enhanced publish response

```190:210:farmacograph/services/curator.py
    async def build_publish_result_async(
        self,
        workflow: CuratorWorkflow,
        package: dict[str, Any],
    ) -> dict[str, Any]:
        # ...
        return {
            "published_slug": entity_payload.get("slug"),
            "dataset_version": version_tag,
            "published_at": workflow.updated_at,
            "graph_write": {
                "available": graph_available,
                "status": "success" if graph_available else "skipped",
            },
            "snapshot": snapshot_ref,
            "validation_summary": {"valid": True, "publish_ready": True},
        }
```

### 19.5 Scope gating in wizard

```222:226:apps/studio/src/components/publish-wizard/use-publish-wizard.ts
      if (action === "approve" || action === "publish") {
        if (!hasPermission("curator:publish")) {
          blockers.push("Reviewer permission (curator:publish) is required.");
        }
      }
```

---

## Executive Summary (for humans)

Sprint 4 **delivered the publish wizard and curation workflow UX** as specified. Curators can now submit, approve, and publish from the Drug Editor using the live API, with workflow state and an audit-backed activity timeline in the right sidebar. Validation is shared between the editor and publish readiness checks. Backend and Studio test counts increased (128 and 131 respectively, Studio verified locally).

The main remaining gap is **E2E depth** — publish wizard E2E uses mocked APIs and does not exercise a live submit→approve→publish flow when Neo4j is disabled in test mode.

**Deployment:** The full curation loop is ready for staging/pilot with PostgreSQL, JWT, and Neo4j. Update deploy docs before production handoff to non-technical curators.

**Recommended next work:** Doc + OpenAPI sync, then live E2E publish, then first real cardiovascular drug curation.

---

## AI Handoff Summary

**Sprint 4 status:** PASS (functional). Publish wizard **live** in Drug Editor.

**Key new files:** `apps/studio/src/components/publish-wizard/*`, `apps/studio/src/components/workflow-timeline/*`, `farmacograph/api/routers/curator.py` (timeline), `farmacograph/services/curator.py` (`build_publish_result_async`, `get_workflow_timeline`), `tests/curator/test_workflow_timeline.py`, `apps/studio/e2e/publish-wizard.spec.ts`.

**Tests:** Backend 128 passed (per sprint; CI Py 3.12). Studio **131 passed** verified. E2E publish wizard is **mock-only**.

**Not done (post-doc sync):** Snapshots page, mechanism/graph editors, knowledge content, outbox polling, live E2E publish.

**Deploy:** Ready for **full curation pilot** (edit + publish in Studio) with `FG_JWT_SECRET_KEY` + `FG_NEO4J_ENABLED=true`.

---

*End of post-Sprint 4 architecture audit.*
