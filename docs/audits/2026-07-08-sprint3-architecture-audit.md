# FarmacoGraph Post-Sprint Architecture Audit

**Sprint:** 3 — Stabilize the Secure Curation Path  
**Audit date:** 2026-07-08  
**Repository:** `/Users/furkan/Desktop/FarmacoGraph`  
**Auditor:** Architecture Auditor (read-only)  
**Prior audit:** [`docs/audits/2026-07-08-architecture-audit.md`](2026-07-08-architecture-audit.md) (baseline, same day)

---

## 1. Executive Summary

### Sprint outcome

Sprint 3 **achieved its primary goal**: curators can authenticate, browse drugs, open a slug-based editor, autosave drafts through the canonical curator workflow API, and review validation — with **anonymous callers blocked** from all curator mutations. The secure curation path is **functionally complete for draft editing**; publish transitions remain API-only (Studio 4.4).

### Project health (secure curation lens)

| Lens | Status | Notes |
|------|--------|-------|
| **Secure curation path (login → browse → edit → validate)** | **Mostly complete (~90%)** | Missing publish wizard UI and end-to-end Studio publish |
| **Backend auth + curator API** | **Complete** for sprint scope | `require_scope` fixed; 3 auth routes live |
| **Studio editors (drug path)** | **Complete** | Browser, editor, validation center wired |
| **Contract alignment (curator/dashboard/auth)** | **Mostly complete** | OpenAPI updated; auth introspect is flat (not `{data,meta}`) |
| **Test coverage (sprint-critical paths)** | **Strong** | Security regression + contract + unit tests; E2E drug navigation |

### Overall completion estimate (updated)

| Lens | Prior (baseline) | Post-Sprint 3 |
|------|------------------|---------------|
| Full platform vision | ~35–40% | ~38–42% (unchanged knowledge content) |
| V1 milestone (platform + CV module) | ~50–55% | **~58–62%** (curation UI path live) |
| Secure curation path sprint | N/A (recommended) | **~90%** (publish UI deferred) |

### Biggest risks (post-sprint)

1. **Publish still CLI/API-only** — curators cannot complete review → approve → publish in Studio; operational risk for non-technical users.
2. **Studio route guard is cookie-based** — `middleware.ts` checks a client-set cookie, not server-validated JWT; real enforcement is API-side (correct), but UI can be bypassed cosmetically.
3. **Contract CI gap** — OpenAPI YAML validates in CI, but Schemathesis/full contract diff against FastAPI is not automated; drift can recur on planned routes.
4. **Knowledge content still minimal** — 1 structural stub; 62/63 CV drugs `pending` in curriculum; graph APIs remain skeleton without populated Neo4j.
5. **Outbox publisher still not started** at app lifespan — unchanged from baseline; events durable in DB but not polled to bus.

### Biggest strengths

1. **Critical security defect resolved** — `require_scope` now returns `401` for unauthenticated non-read scopes (`farmacograph/api/deps.py:113–126`).
2. **Single autosave contract** — Studio uses only `PUT /curator/workflows/{id}/package`; no `PATCH /drugs` fallback in code or docs.
3. **Regression tests lock the gate** — parametrized anonymous-denial tests cover 10+ curator endpoints (`tests/api/test_security_regression.py`).
4. **Documentation largely aligned** — `README.md`, `docs/api.md`, `docs/auth.md`, `docs/studio-roadmap.md`, `docs/curation-studio.md`, `docs/deploy-studio.md` reflect the live path.
5. **CI quality gates** — Python lint/typecheck/tests (60% cov floor), Studio lint/typecheck/109 unit tests, Playwright smoke, Docker build (`.github/workflows/ci.yml`).

### Recommended next milestone

**Studio 4.4 — Publish wizard:** wire `submit` → `approve` → `publish` in UI with role/scope gating (`curator:publish`), snapshot preview hook, and E2E covering full publish without CLI.

---

## 2. Definition of Done — Sprint 3 Checklist

| # | Sprint goal | Status | Evidence |
|---|-------------|--------|----------|
| 1 | Autosave uses **only** canonical `PUT /api/v1/curator/workflows/{workflow_id}/package` (no `PATCH /drugs` fallback) | **Done** | `apps/studio/src/components/drug-editor/autosave.ts` (`saveDrugPackage` → `client.saveWorkflowPackage`); `apps/studio/src/lib/api/client.ts:183–187`; `docs/api.md:187` explicitly states no `PATCH /drugs`; grep shows no PATCH drug route in backend |
| 2 | `ensureDraftWorkflow` uses `POST /curator/drugs/{slug}/workflows` for slugs | **Done** | `apps/studio/src/components/drug-editor/autosave.ts:73–79`; unit test `apps/studio/src/components/drug-editor/__tests__/autosave.test.ts:96–108`; backend `farmacograph/api/routers/curator.py:66–80` |
| 3 | Auth introspect at `POST /api/v1/auth/introspect` | **Done** | `farmacograph/api/routers/auth.py:69–107`; `farmacograph/auth/service.py` (`introspect`); `tests/auth/test_auth.py` (20+ introspect cases); Studio `apps/studio/src/lib/auth/api.ts:129–146` |
| 4 | Introspect response with contract schema | **Done** (minor nuance) | OpenAPI `IntrospectResponse` at `openapi/openapi.yaml:1156–1181`; implementation returns **flat** body (not `{data, meta}` envelope unlike curator/dashboard). Contract test passes: `tests/api/contract/test_auth_contract.py` |
| 5 | OpenAPI updated with curator, dashboard, auth introspect schemas | **Done** | `openapi/openapi.yaml` paths: `/auth/introspect`, `/dashboard`, `/audit-logs`, `/jobs`, full `/curator/*` tree (lines 106–529); component schemas `DashboardResponse`, `CuratorDrugListResponse`, `DrugWorkflowOpenResponse`, etc. (lines 1205+) |
| 6 | Drug browser rows navigate to `/knowledge/drugs/{slug}` | **Done** | `apps/studio/src/components/drugs/drug-table.tsx:72–74`; `apps/studio/src/components/drugs/utils.ts:14`; E2E `apps/studio/e2e/drug-navigation.spec.ts:22–34` |
| 7 | Security regression tests — anonymous curator mutations denied | **Done** | `tests/api/test_security_regression.py` (parametrized 401 on 10 write endpoints + publish + workflow mutations); `tests/curator/test_security_regression.py` (create workflow + submit/approve/publish) |
| 8 | Documentation updated | **Mostly done** | `README.md:18–19`, `docs/api.md`, `docs/auth.md`, `docs/studio-roadmap.md`, `docs/curation-studio.md`, `docs/deploy-studio.md`, `docs/api-first.md:49`. **Stale:** `docs/platform-architecture.md:202` still lists introspect as "Planned"; `docs/architecture-diagrams.md:267` same; `docs/studio-roadmap.md:231` says drug list/editor "not yet wired" (contradicts lines 19–21) |
| 9 | Backend tests: 124 passed, 5 skipped | **Reported done** (not re-verified locally) | CI runs `pytest -m "not integration"` on Python 3.12 (`.github/workflows/ci.yml:80–87`). Local audit environment had Python 3.9 and could not execute pytest |
| 10 | Studio tests: 109 passed; build passes | **Verified** | `npm test -- --run` → 21 files, 109 passed; CI runs lint, typecheck, `test:coverage`, `test:e2e`, Docker build |

### Sprint scope explicitly deferred (not DoD failures)

| Item | Status | Notes |
|------|--------|-------|
| Studio publish wizard (submit/approve/publish UI) | **Deferred** | `docs/studio-roadmap.md:50` marks Studio 4.4 as **Next** |
| Mechanism editor, graph explorer | **Deferred** | Placeholder pages |
| Full OpenAPI ↔ FastAPI parity for planned entity routes | **Out of scope** | ~20+ planned paths in spec without routers |

**Sprint DoD verdict:** **PASS** — all in-scope deliverables met; publish UI correctly deferred to next sprint.

---

## 3. Remaining Gaps and Risks

### Functional gaps (secure curation path)

| Gap | Severity | Detail |
|-----|----------|--------|
| No publish wizard in Studio | **High** | `FarmacoGraphClient.publishWorkflow` exists (`client.ts:190–195`) but no UI invokes submit/approve/publish; curators must use API/CLI for release |
| No slug-based `GET /drugs/{slug}` | **Medium** | Editor uses curator slug workflows; public drug detail remains UUID-only (`farmacograph/api/routers/drugs.py`) |
| Dashboard reads curriculum from filesystem | **Medium** | `farmacograph/curator/drug_package.py` — API-first violation for dashboard stats (pre-existing, not sprint regression) |
| Client-only auth fallback | **Low–Medium** | `docs/studio-roadmap.md:180` — older APIs get client-only session; production API has auth endpoints |
| Education validator not in publish gate | **Medium** | Pre-existing; publish path uses schema + biomedical + per-edge ontology only |

### Security gaps

| Gap | Severity | Detail |
|-----|----------|--------|
| Studio middleware cookie guard | **Low** (UI only) | `apps/studio/src/middleware.ts:12` — `AUTH_COOKIE_NAME === "1"` is not cryptographic; API `require_scope` is the real boundary |
| No rate limiting on auth endpoints | **Medium** | `docs/architecture-diagrams.md` notes Phase API 5.3 rate-limit middleware not implemented |
| JWT in localStorage | **Medium** (accepted) | Studio stores session in localStorage per `docs/studio-roadmap.md:173`; standard SPA tradeoff |
| Production JWT secret enforcement | **Mitigated** | `tests/auth/test_jwt_secret.py`; `docs/deploy-studio.md:33` documents requirement |

### Architecture / ops gaps (unchanged from baseline)

| Gap | Severity | Detail |
|-----|----------|--------|
| Outbox publisher not started | **Medium** | `farmacograph/events/outbox.py` exists; `farmacograph/api/main.py` lifespan does not poll outbox |
| Jobs run inline on publish | **Medium** | `graph_validation` not via background worker |
| Plugin system | **Low** (future) | Spec only; no runtime loader |
| Knowledge graph sparse | **High** (product) | Explain/compare return skeleton/no_data without Neo4j content |

### Documentation drift

| Document | Issue |
|----------|-------|
| `docs/platform-architecture.md` | Introspect marked "Planned" |
| `docs/architecture-diagrams.md` | Introspect listed under "Not yet implemented" |
| `docs/studio-roadmap.md:231` | "Not yet wired" contradicts completed drug browser/editor section |
| `docs/curation-studio.md:37` | Says "4.2.1 — Functional dashboard" under status header that claims 4.2 complete |

---

## 4. Evidence-Based Findings

### 4.1 Authentication and authorization

**`require_scope` fix (critical sprint security deliverable)**

```113:126:farmacograph/api/deps.py
def require_scope(scope: str):
    async def _check(
        auth: Annotated[AuthContext, Depends(get_auth_context)],
        settings: Annotated[Settings, Depends(get_settings)],
    ) -> AuthContext:
        if auth.has_scope(scope):
            return auth

        if not auth.is_authenticated:
            if scope in ANONYMOUS_READ_SCOPES and settings.allow_anonymous_read:
                return auth
            raise HTTPException(status_code=401, detail="Authentication required")

        raise HTTPException(status_code=403, detail=f"Missing scope: {scope}")
```

- Anonymous read scopes defined in `farmacograph/auth/models.py:31–37`.
- Production disables anonymous read: `farmacograph/core/config.py:93`.
- Auth routes mounted in `farmacograph/api/main.py` via `auth` router.

**Auth endpoints implemented**

| Endpoint | File | Scope |
|----------|------|-------|
| `POST /auth/token` | `farmacograph/api/routers/auth.py:22–46` | Public |
| `POST /auth/refresh` | `farmacograph/api/routers/auth.py:49–66` | Public |
| `POST /auth/introspect` | `farmacograph/api/routers/auth.py:69–107` | Credentials required |

**Studio auth stack**

| Layer | File |
|-------|------|
| Login / refresh | `apps/studio/src/lib/auth/api.ts` |
| Route guards (scopes) | `apps/studio/src/lib/auth/routes.ts` |
| Client enforcement | `apps/studio/src/lib/auth/guards.tsx` |
| Server redirect | `apps/studio/src/middleware.ts` |
| Protected paths | `/knowledge/*`, `/validation`, `/snapshots`, `/users` |

### 4.2 Curator API — canonical draft path

**14 curator routes** in `farmacograph/api/routers/curator.py`:

| Method | Path | Auth scope |
|--------|------|------------|
| GET | `/curator/drugs` | `curator:write` |
| POST | `/curator/drugs/{slug}/workflows` | `curator:write` |
| GET | `/curator/drugs/{slug}/package` | `curator:write` |
| PUT | `/curator/workflows/{workflow_id}/package` | `curator:write` (**canonical autosave**) |
| POST | `/curator/validate` | `curator:write` |
| GET/POST | workflows, queue, validation-summary, stubs, submit, approve, publish | `curator:write` / `curator:publish` |

**Studio autosave flow**

1. Open editor → `ensureDraftWorkflow(client, slug)` → `POST /curator/drugs/{slug}/workflows` (`autosave.ts:77–79`).
2. Debounced save → `saveDrugPackage` → `PUT /curator/workflows/{id}/package` (`autosave.ts:51–69`).
3. Hook orchestration: `apps/studio/src/components/drug-editor/use-drug-editor.ts`.

**No PATCH /drugs path** — confirmed by API routers (`drugs.py` has GET only) and explicit documentation in `docs/api.md:187`.

### 4.3 Studio feature wiring

| Feature | Route | Key components |
|---------|-------|----------------|
| Drug browser | `/knowledge/drugs` | `apps/studio/src/app/knowledge/drugs/page.tsx`, `components/drugs/` |
| Drug editor | `/knowledge/drugs/[id]` | `apps/studio/src/app/knowledge/drugs/[id]/page.tsx`, `components/drug-editor/` |
| Validation center | `/validation` | `apps/studio/src/components/validation/` |
| Dashboard | `/` | `components/dashboard/dashboard-view.tsx` → `GET /dashboard` |

**Navigation evidence:** `drug-table.tsx:72–74` uses `router.push(\`/knowledge/drugs/${slug}\`)`; row link test in `e2e/drug-navigation.spec.ts`.

### 4.4 OpenAPI contract (sprint delta vs baseline)

**Baseline audit finding:** curator, dashboard, auth absent from static OpenAPI.  
**Post-sprint:** all sprint-critical paths documented in `openapi/openapi.yaml` with envelope schemas for curator/dashboard; auth token/introspect use flat response models (consistent with `TokenResponse`).

**Contract tests (partial but present)**

| File | Coverage |
|------|----------|
| `tests/api/contract/test_auth_contract.py` | Introspect OpenAPI validation |
| `tests/api/contract/test_curator_contract.py` | validation-summary, validate envelopes |
| `tests/api/contract/test_drugs_contract.py` | Drug list/detail |
| `tests/api/contract/test_health_contract.py` | Health/info |
| `tests/api/contract/test_platform_contract.py` | Search/modules |

CI validates YAML syntax only (`.github/workflows/ci.yml:36–37`) — not full Schemathesis.

### 4.5 Test evidence

| Suite | Count | Location |
|-------|-------|----------|
| Backend (reported) | 124 passed, 5 skipped | Sprint report; CI `pytest -m "not integration"` |
| Studio unit | **109 passed** (verified) | 21 test files under `apps/studio/src/**/__tests__/` |
| Security regression | 3 parametrized modules + curator tests | `tests/api/test_security_regression.py`, `tests/curator/test_security_regression.py` |
| Studio E2E | Drug navigation smoke | `apps/studio/e2e/drug-navigation.spec.ts`, `drugs.spec.ts` |
| JWT secret regression | 5 tests | `tests/auth/test_jwt_secret.py` |

**Sprint-critical unit tests**

- `apps/studio/src/components/drug-editor/__tests__/autosave.test.ts` — canonical save + slug workflow
- `apps/studio/src/lib/auth/__tests__/api.test.ts` — introspect client
- `apps/studio/src/lib/api/__tests__/client.test.ts` — `saveWorkflowPackage` path

### 4.6 API route inventory (post-sprint)

**30 `/api/v1` routes** across 8 router modules (up from 23 in baseline):

- Auth: 3 (`auth.py`)
- Curator: 14 (`curator.py`) — **+4** vs baseline (drugs browser, slug workflows, slug package, workflow package PUT)
- Dashboard: 3 (`dashboard.py`)
- Health: 2 (`health.py`)
- Drugs: 2 (`drugs.py`)
- Learning: 1 (`learning.py`)
- Platform: 4 (`platform.py` — search, modules, curriculum, statistics)
- Explain: 2 (`explain.py`)

---

## 5. Deployment Readiness Assessment

### Secure curation path — production readiness

| Criterion | Ready? | Notes |
|-----------|--------|-------|
| Authenticated curator API | **Yes** | PostgreSQL + seeded users/API keys required |
| Studio login (JWT/API key) | **Yes** | `POST /auth/token`, refresh flow |
| Drug browse → edit → autosave | **Yes** | Docker Compose stack includes `studio` service |
| Validation review in Studio | **Yes** | `/validation` wired |
| Publish from Studio | **No** | API-only; deploy docs don't claim UI publish |
| Anonymous curator blocked | **Yes** | Verified by regression tests |
| Production JWT secret | **Required** | Startup fails on insecure default in staging/production |
| HTTPS / reverse proxy | **Documented** | `docs/deploy-studio.md`, `deploy/nginx/farmacograph.conf` |

### Deployment checklist (`docs/deploy-studio.md`)

```bash
docker compose up -d --build api studio
# Verify: Studio → Login → Drug Browser → /knowledge/drugs/ramipril → autosave → validation
```

| Component | Config | File |
|-----------|--------|------|
| API | `FG_JWT_SECRET_KEY`, `FG_DATABASE_URL`, Neo4j optional | `docker-compose.yml:48–56` |
| Studio | `NEXT_PUBLIC_API_URL`, `NEXT_PUBLIC_BASE_PATH=/studio` | `docker-compose.yml:70–76`, `docs/deploy-studio.md:37–41` |
| Ports | API 8001, Studio 3001 | `docker-compose.yml` |

### Readiness verdict

| Environment | Verdict | Rationale |
|-------------|---------|-----------|
| **Staging / pilot curation (draft editing)** | **READY** | Full secure path for draft create/edit/validate with auth |
| **Production curator release** | **NOT READY** | Publish wizard missing; knowledge content minimal; outbox not polled |
| **Public read-only API** | **READY** (with caveats) | Anonymous read disabled in production; Neo4j needed for meaningful search |

### Pre-production recommendations (ordered)

1. Ship Studio 4.4 publish wizard before inviting non-technical curators.
2. Fix stale docs (`platform-architecture.md`, `studio-roadmap.md` API wiring table).
3. Add contract CI job comparing FastAPI `/openapi.json` to `openapi/openapi.yaml` for implemented routes.
4. Seed production PostgreSQL with curator users and rotate `FG_JWT_SECRET_KEY`.
5. Run manual smoke on production URL per `docs/deploy-studio.md:27–31` after each deploy.

---

## Progress Since Baseline Audit (same day)

| Subsystem | Baseline | Post-Sprint 3 |
|-----------|----------|---------------|
| **Curator auth gate** | **Critical defect** — anonymous allowed | **Fixed** + regression tests |
| **Auth HTTP API** | Missing token/refresh/introspect | **Complete** |
| **OpenAPI curator/dashboard** | Missing from spec | **Documented** with schemas |
| **Studio drug browser/editor/validation** | Placeholders | **Complete** |
| **Autosave contract** | Client had fallback risk | **Single PUT package path** |
| **Outbox / jobs / plugins** | Partial | **Unchanged** |
| **Knowledge content** | ~1–2% | **Unchanged** |
| **Explain/compare** | Skeleton | **Unchanged** |

**Resolved technical debt:** anonymous curator write access; missing auth endpoints; OpenAPI gap for live curator/dashboard routes; Studio editor placeholders.

**New/minor debt:** documentation inconsistencies; introspect flat vs envelope pattern; studio-roadmap self-contradiction on wiring status.

---

## Architecture Compliance (secure curation focus)

| Area | Status | Reasoning |
|------|--------|-----------|
| API-first curation | **Mostly Complete** | Studio uses `FarmacoGraphClient` only; dashboard still reads staging files internally |
| Curator workflow (FG-C023) | **Complete** | State machine + API enforced |
| Auth (ADR-025, API 5.2) | **Complete** | JWT + API key + introspect |
| Studio route protection (ADR-020–024) | **Mostly Complete** | Middleware + AuthGate; cookie is weak UI gate |
| Validation on edit | **Complete** | `PUT .../package` returns validation; editor debounces validate |
| Publish path | **Partial** | Backend complete; Studio UI missing |
| Event bus / outbox | **Partial** | Write path appends; publisher not started |
| OpenAPI-first | **Mostly Complete** | Sprint routes documented; planned routes still unimplemented |

---

## Suggested Priority (post-sprint, top 10)

| Rank | Task | Impact |
|------|------|--------|
| 1 | Studio 4.4 publish wizard | Completes curation loop without CLI |
| 2 | E2E publish flow (API + Playwright) | Regression safety for release path |
| 3 | OpenAPI ↔ FastAPI diff CI | Prevents contract regression |
| 4 | Fix stale architecture docs | Reduces AI/human planning errors |
| 5 | Snapshot HTTP API + Studio snapshots page | Publish preview / diff viewer |
| 6 | Start outbox publisher in API lifespan | Event durability → bus |
| 7 | Curate first real CV drug end-to-end | Proves pipeline beyond stub |
| 8 | Rate limiting on `/auth/*` | Brute-force mitigation |
| 9 | `GET /drugs/{slug}` or document slug resolution | Editor/public ID consistency |
| 10 | Background job worker for graph_validation | Publish latency at scale |

---

## AI Handoff Summary

**Sprint 3 status:** PASS. Secure curation path is live for **draft editing** (login → drug browser → slug editor → autosave via `PUT /curator/workflows/{id}/package` → validation center). Anonymous curator mutations return **401**.

**Key files:** `farmacograph/api/deps.py` (auth gate), `farmacograph/api/routers/curator.py` + `auth.py`, `apps/studio/src/components/drug-editor/autosave.ts`, `apps/studio/src/components/drugs/drug-table.tsx`, `tests/api/test_security_regression.py`, `openapi/openapi.yaml`.

**Tests:** Backend 124 passed / 5 skipped (per sprint; CI on Py 3.12). Studio **109 passed** verified locally.

**Not done:** Studio publish UI (4.4), mechanism/graph editors, populated knowledge graph, outbox polling, full contract CI.

**Deploy:** Ready for **draft curation pilot** with PostgreSQL + secure `FG_JWT_SECRET_KEY`; not ready for **curator-only production publish** without API/CLI.

**Next sprint:** Studio 4.4 publish wizard + E2E publish + doc cleanup.

---

*End of post-sprint architecture audit.*
