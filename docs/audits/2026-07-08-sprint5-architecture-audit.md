# FarmacoGraph Post-Sprint 5 Architecture Audit

**Sprint:** 5 — Evidence Manager and evidence attachment flow in Studio  
**Audit date:** 2026-07-08  
**Repository:** `/Users/furkan/Desktop/FarmacoGraph`  
**Git HEAD:** `a6e0353` — *"Ship publish wizard and evidence curation workflow in Studio."*  
**Working tree:** Clean except minor uncommitted E2E helper tweak (`apps/studio/e2e/helpers/evidence-api.ts`)  
**Auditor:** Architecture Auditor (read-only)  
**Prior audits:** [`2026-07-08-pre-sprint5-readiness-audit.md`](2026-07-08-pre-sprint5-readiness-audit.md), [`2026-07-08-sprint4-architecture-audit.md`](2026-07-08-sprint4-architecture-audit.md), [`2026-07-08-sprint3-architecture-audit.md`](2026-07-08-sprint3-architecture-audit.md), [`2026-07-08-architecture-audit.md`](2026-07-08-architecture-audit.md) (baseline)

---

## Sprint 5 Verdict: **PARTIAL**

Sprint 5 **delivers the primary curator path** — attach/create evidence on a drug, satisfy attestation, see FG-C012 blockers in validation, and gate publish via Evidence readiness in the wizard. Backend evidence API, `EvidenceValidator`, OpenAPI sync, and test growth are **solid**.

The sprint is **not a full PASS** because the **global Evidence Manager** (`/knowledge/evidence`) does not perform real `POST`/`PATCH` persistence (create/edit dialogs dry-run `POST /curator/validate` only), browse relies on `GET /search` rather than `GET /evidence` list, **assertion-level `SUPPORTED_BY` attach has no Studio UI**, E2E remains **fully mocked**, and **documentation is internally inconsistent** (`apps/studio/README.md` still lists evidence as placeholder; `docs/api.md` line 62 contradicts §1.4).

| Lens | Result |
|------|--------|
| **Drug Editor evidence attachment flow** | **Complete** |
| **Publish wizard evidence readiness** | **Complete** |
| **Backend evidence API + validation** | **Complete** |
| **Global Evidence Manager CRUD** | **Partial** (browse + validate-only forms) |
| **Assertion evidence attach UI** | **Missing** |
| **Contract / doc hygiene** | **Partial** |
| **Tests (claimed 161 + 180)** | **Verified locally** |

---

## Executive Summary

### Project health (post-Sprint 5)

FarmacoGraph has crossed a meaningful curation milestone: a curator can work **entirely in Studio** from login through drug edit, evidence attach, validation, and publish — with server-side FG-C012/C019/C020 enforcement on publish packages. The platform remains **early-alpha on knowledge content** (structural stub + pending CV curriculum) but **Studio 4.2–4.4 + evidence workflow infrastructure is production-shaped**.

### Overall completion estimate

| Lens | Post-Sprint 4 | Post-Sprint 5 |
|------|---------------|---------------|
| Full platform vision | ~40–44% | ~42–46% (unchanged content volume) |
| V1 milestone (platform + CV module) | ~65–68% | **~70–73%** (evidence curation loop) |
| Secure curation path (draft → publish) | ~95% | **~97%** (evidence gating wired) |
| Evidence workflow (Studio + API) | ~40% (scaffolded) | **~75%** (drug path complete; global manager partial) |

### Biggest risks

1. **Evidence Manager UX mismatch** — Global page advertises create/edit but only validates payloads; curators may assume citations were saved (`evidence-form.tsx:122–125`).
2. **Neo4j hard dependency for evidence writes** — `EvidenceService._require_graph()` returns `503` without graph DB; local/dev misconfiguration blocks attach/create silently after UI action.
3. **Multi-path API contracts** — Studio `evidence-client.ts` tries `/drugs/{id}/evidence`, `/evidence?drug_id=`, and `/evidence/{id}/drugs/{id}` fallbacks; increases maintenance and test surface.
4. **No live-stack E2E** — All Playwright evidence and publish flows mock APIs; regressions in real Neo4j attach paths won't be caught in CI.
5. **Knowledge graph still sparse** — Explain/search/graph APIs return skeleton without populated Neo4j content.

### Biggest strengths

1. **`EvidenceValidator` integrated in publish gate** — `publish_validator.py:31–45` runs FG-C012/C019/C020; unit tests in `tests/validation/test_evidence_validator.py`.
2. **Comprehensive evidence REST surface** — 8 evidence routes + 3 drug-scoped + 3 curator slug routes; OpenAPI documents all (`openapi/openapi.yaml:309–1155`).
3. **Drug Editor evidence section** — Full attach/create/detach with React Query (`drug-evidence-section.tsx`, `use-drug-evidence.ts`, `evidence-client.ts`).
4. **Publish wizard evidence gating** — `issue-grouping.ts`, `publish-validation.ts`, `validation-panel.tsx` with 322-line `evidence-gating.test.ts`.
5. **Test growth verified** — Backend **161 passed** (9 skipped); Studio **180 passed** (32 files); +18 evidence-focused backend tests; E2E `evidence-workflow.spec.ts` added.
6. **Pre-Sprint 5 blockers resolved** — Sprint 4 landed in `a6e0353`; `GET /drugs/{drug_id}/evidence` implemented; Studio tests green.

### Recommended next milestone

**Evidence workflow hardening:** Wire global Evidence Manager to real `POST`/`PATCH /evidence`; add assertion attach UI in Drug Editor relationships; simplify client to single canonical drug-evidence contract; add one live-stack Playwright path with Neo4j; then **first real CV drug curation** with evidence-backed `TREATS` edges.

---

## Definition of Done — Sprint 5 Checklist

| # | Sprint goal | Status | Evidence |
|---|-------------|--------|----------|
| 1 | Evidence API — list, detail, CRUD | **Done** | `farmacograph/api/routers/evidence.py` (8 routes); `EvidenceService` in `services/evidence.py` |
| 2 | Drug attach/detach (`POST/DELETE` drug ↔ evidence) | **Done** | `evidence.py:86–111`; `drugs.py:61–97`; `curator.py:123–164` (slug variants) |
| 3 | Assertion attach (`POST/DELETE /evidence/{id}/assertions`) | **Done (API only)** | `evidence.py:114–139`; `EvidenceService.attach_to_assertion` — **no Studio UI** |
| 4 | `EvidenceValidator` — FG-C012, FG-C019, FG-C020 | **Done** | `validators/evidence_validator.py`; wired in `publish_validator.py:31–45` |
| 5 | Evidence Manager page `/knowledge/evidence` | **Partial** | `EvidenceBrowser` live; browse via `GET /search?types=evidence`; create/edit **validate-only** (`evidence-form.tsx`) |
| 6 | Drug Editor Evidence section | **Done** | `sections.ts:89–94` (`kind: "evidence"`); `drug-evidence-section.tsx` (455 lines); context summary `drug-evidence-panel.tsx` |
| 7 | Publish wizard evidence readiness | **Done** | `publish-wizard/validation/*`; `EvidenceReadinessPanel` in `validation-panel.tsx`; gates publish in `gatePublishAction` |
| 8 | OpenAPI synced for evidence + drug evidence routes | **Done** | `openapi/openapi.yaml` paths at `/evidence`, `/drugs/{drug_id}/evidence`, `/curator/drugs/{slug}/evidence` |
| 9 | Backend tests: 161 passed | **Verified** | `uv run pytest tests/` → **161 passed, 9 skipped** (2026-07-08) |
| 10 | Studio tests: 180 passed | **Verified** | `npm test -- --run` → **180 passed** (32 files) |
| 11 | E2E evidence workflow | **Partial** | `e2e/evidence-workflow.spec.ts` — 3 tests, **all API mocked** via `mockEvidenceWorkflowApi` |
| 12 | Documentation updated for Sprint 5 | **Partial** | `README.md`, `docs/curation-studio.md`, `docs/api.md` §1.4 updated; `apps/studio/README.md` **stale**; `evidence-form.tsx` copy **stale** |

**Sprint DoD verdict:** **PARTIAL** — core drug-level evidence attachment + publish gating complete; global manager CRUD and assertion UI deferred; doc gaps remain.

### Explicitly deferred (not DoD failures)

| Item | Status |
|------|--------|
| Assertion `SUPPORTED_BY` UI in relationship/mechanism editors | **Deferred** (backend ready) |
| Live-stack E2E with Neo4j | **Deferred** |
| Snapshots manager page | **Deferred** (placeholder `/snapshots`) |
| Mechanism editor / Graph explorer | **Deferred** |

---

## Architecture Compliance

| Area | Status | Reasoning |
|------|--------|-----------|
| **API-first curation** | **Mostly Complete** | Studio uses `FarmacoGraphClient`; dashboard still reads staging filesystem |
| **Evidence as first-class entity** | **Mostly Complete** | Neo4j repo + REST CRUD; validator enforces `SUPPORTED_BY` / `evidence_ids` |
| **FG-C012 publish evidence gate** | **Complete** | `EvidenceValidator` in `validate_publish_package` |
| **Curator workflow (FG-C023)** | **Complete** | Unchanged; publish wizard integrates evidence gating |
| **Auth / scopes** | **Complete** | Evidence read `knowledge:read`; writes `curator:write` |
| **Studio Evidence Manager** | **Partial** | Page exists; CRUD not wired in global form |
| **OpenAPI-first** | **Mostly Complete** | Evidence routes synced; `GET /curator/drugs/{slug}/workflow-state` still missing from OpenAPI |
| **Event bus / outbox** | **Partial** | Unchanged — publisher not started at lifespan |
| **Snapshots (ADR-014)** | **Partial** | Created on publish; no list HTTP API or Studio page |
| **Education validator on publish** | **Partial** | `EducationValidator` exists but **not** in `publish_validator.py` |
| **Curation Studio (ADR-020–024)** | **Mostly Complete** | Drug path + evidence complete; mechanism/graph/snapshots missing |

---

## Backend Status

| Subsystem | Status | Evidence |
|-----------|--------|----------|
| **API** | **Mostly Complete** | **40** router endpoints across 7 modules (`curator` 18, `evidence` 8, `drugs` 5) |
| **Evidence service** | **Complete** | `services/evidence.py` — list, CRUD, drug attach, assertion attach, audit logging |
| **Evidence repository** | **Complete** | `repositories/evidence.py` — Neo4j-backed |
| **Validation** | **Mostly Complete** | 5 validators; evidence in publish gate; education omitted |
| **Authentication** | **Complete** | Scope checks on all evidence mutations |
| **Database** | **Mostly Complete** | PostgreSQL workflows/audit; Neo4j for evidence nodes/edges |
| **Events** | **Partial** | Outbox writes; no publisher in lifespan |
| **Jobs** | **Partial** | Inline `graph_validation` on publish |
| **Search** | **Partial** | Evidence browse in Studio uses `/search?types=evidence` |
| **Snapshots** | **Partial** | Optional on publish; metadata in response |
| **Plugin interfaces** | **Missing** | Spec only |
| **Dependency injection** | **Complete** | `get_evidence_service` in `deps.py`; container wiring |
| **Logging / observability** | **Mostly Complete** | Structured logging; Prometheus optional |
| **Security** | **Mostly Complete** | Scope gating; evidence/timeline routes **not** in security regression matrix |
| **Performance** | **UNKNOWN** | No load tests for evidence list at scale |

### EvidenceValidator implementation review

`farmacograph/validators/evidence_validator.py` implements:

- **FG-C012** — Clinical edges with `requires_evidence_on_publish` must have `evidence_ids`, matching `SUPPORTED_BY` edge, or expert-consensus escape with `curator_attestation` (`lines 146–168`, `105–114`).
- **FG-C019** — Published edges require `confidence_score` and `evidence_level` (`lines 187–207`).
- **FG-C020** — Published edges require `explanation` when `requires_explanation_on_publish` (`lines 170–185`).
- Relationship normalization merges `entity_payload.relationships` UUID lists with explicit relationship rows (`_normalize_relationships`).

---

## Frontend Status

| Area | Status | Evidence |
|------|--------|----------|
| **Evidence Manager** (`/knowledge/evidence`) | **Partial** | `EvidenceBrowser`, filters, table, detail drawer, pagination — browse/search only |
| **Drug Editor Evidence section** | **Complete** | Attach, create+attach, detach, search catalog, validation gap summary |
| **Drug context evidence panel** | **Complete** | `DrugEvidencePanel` — count, gaps, link to section |
| **Publish wizard evidence readiness** | **Complete** | Categorized blockers, attestation, low-confidence buckets |
| **Validation Center** | **Complete** (unchanged) | Missing evidence group from validate issues |
| **Mechanism / Graph / Snapshots editors** | **Missing** | Placeholder pages |
| **Authentication** | **Complete** | JWT scopes gate publish actions |
| **Design system** | **Complete** | `EvidenceBadge`, `ConfidenceBadge`, shared cards/dialogs |
| **Routing** | **Complete** | `/knowledge/evidence` in sidebar |
| **Accessibility** | **Partial** | Form labels present; no dedicated a11y audit |
| **Performance** | **Mostly Complete** | React Query caching; client-side filter/sort on search results |

### Evidence Manager vs Drug Editor divergence

| Capability | Drug Editor (`drug-evidence-section.tsx`) | Global Manager (`evidence-browser.tsx`) |
|------------|-------------------------------------------|-------------------------------------------|
| List/browse | `GET /drugs/{id}/evidence` (+ fallbacks) | `GET /search?types=evidence` or `GET /evidence/{id}` lookup |
| Create | `POST /evidence` + attach | **Validate only** — no `POST` |
| Edit | N/A | **Validate only** — no `PATCH` |
| Attach to drug | `POST /drugs/{id}/evidence` (+ fallback) | N/A |

---

## API Status

### Implemented evidence-related endpoints

| Method | Path | Scope | Studio usage |
|--------|------|-------|--------------|
| GET | `/evidence` | `knowledge:read` | Fallback list in `evidence-client.ts:53` |
| POST | `/evidence` | `curator:write` | Drug Editor create |
| GET | `/evidence/{id}` | `knowledge:read` | Detail drawer, attach fallback |
| PATCH | `/evidence/{id}` | `curator:write` | **Not used in Studio** |
| POST | `/evidence/{id}/drugs/{drug_id}` | `curator:write` | Attach fallback |
| DELETE | `/evidence/{id}/drugs/{drug_id}` | `curator:write` | Detach fallback |
| POST | `/evidence/{id}/assertions` | `curator:write` | **No UI** |
| DELETE | `/evidence/{id}/assertions` | `curator:write` | **No UI** |
| GET | `/drugs/{drug_id}/evidence` | `knowledge:read` | Primary list (`evidence-client.ts:46`) |
| POST | `/drugs/{drug_id}/evidence` | `curator:write` | Primary attach (`evidence-client.ts:121`) |
| DELETE | `/drugs/{drug_id}/evidence/{evidence_id}` | `curator:write` | Primary detach |
| GET | `/curator/drugs/{slug}/evidence` | `curator:write` | OpenAPI + contract test; Studio uses UUID drug paths |
| POST | `/curator/drugs/{slug}/evidence` | `curator:write` | Slug variant (docs reference) |
| DELETE | `/curator/drugs/{slug}/evidence/{evidence_id}` | `curator:write` | Slug variant |

### Missing / mismatched

| Item | Severity | Detail |
|------|----------|--------|
| `GET /curator/drugs/{slug}/workflow-state` | **Low** | Implemented `curator.py:92`; **absent from OpenAPI** |
| `GET /evidence?drug_id=` filter | **Low** | Studio fallback sends `drug_id` param; **not documented** in OpenAPI list params |
| Global manager `POST/PATCH` wiring | **Medium** | API exists; Studio form doesn't call it |
| Entity routes (`/diseases`, `/graph/query`, …) | **Pre-existing** | In OpenAPI, not routed |

### Contract tests

`tests/api/contract/test_evidence_contract.py` validates OpenAPI paths including `/drugs/{drug_id}/evidence` and `/curator/drugs/{slug}/evidence`. Neo4j write tests skip with `503` when graph unavailable (**4 skipped** in evidence test subset).

---

## Documentation Status

| Document | Status | Notes |
|----------|--------|-------|
| `README.md` | **Updated** | Marks Phase 4 Studio 5 complete; evidence workflow described |
| `docs/curation-studio.md` | **Mostly current** | Evidence workflow section live; still labels 4.2.4 "partial" |
| `docs/studio-roadmap.md` | **Mostly current** | Evidence Manager marked partial with honest gaps |
| `docs/api.md` | **Partially stale** | §1.4 accurate; line 62 still says `GET /drugs/{drug_id}/evidence` is "OpenAPI only" — **contradicts §1.4 and implementation** |
| `apps/studio/README.md` | **Stale** | Lines 46–48 still list `/evidence` and publish wizard as placeholder |
| `evidence-form.tsx` UI copy | **Stale** | Claims "Evidence write endpoints are not yet available" — **false** since Sprint 5 API |
| `openapi/openapi.yaml` | **Synced** | Evidence + drug evidence routes present |
| `docs/ontology.md` | **Partial** | FG-C012/C019/C020 referenced in code/tests; not grep-visible in ontology.md prose |
| ADRs | **Unchanged** | No new ADR for evidence workflow |

---

## Testing Status

| Suite | Result | Evidence |
|-------|--------|----------|
| Backend (full) | **161 passed, 9 skipped** | Verified 2026-07-08 via `uv run pytest tests/` |
| Backend evidence subset | **18 passed, 4 skipped** | `test_evidence_api.py`, `test_evidence_service.py`, `test_evidence_validator.py`, `test_evidence_contract.py` |
| Studio unit | **180 passed** (32 files) | Includes `evidence-gating.test.ts` (322 lines), `evidence-helpers.test.ts`, `evidence-browser.test.tsx` |
| E2E Playwright | **Present, mock-only** | `evidence-workflow.spec.ts` (3 tests), `publish-wizard.spec.ts`, `drug-navigation.spec.ts` |
| CI | **Configured** | `.github/workflows/ci.yml` — pytest coverage ≥60%, Playwright chromium, Python 3.12 |
| Contract CI | **Partial** | Evidence contract tests exist; not all routes in security regression |
| Coverage gate | **60% floor** | CI `--cov-fail-under=60` |

### Test gaps

- No integration test for full create → attach → validate FG-C012 → publish with Neo4j
- Security regression (`test_security_regression.py`) has **no evidence or timeline routes**
- Global Evidence Manager form has **no test asserting POST /evidence** (because form doesn't call it)

---

## Technical Debt

| Item | Rank | Why |
|------|------|-----|
| Evidence Manager create/edit validate-only | **High** | User-facing false negative — appears to work but doesn't persist |
| Multi-path `evidence-client.ts` fallbacks | **High** | 3 list paths, 2 attach paths; masks API errors |
| Stale `apps/studio/README.md` + form copy | **Medium** | Misleads developers and AI planners |
| `docs/api.md` line 62 contradiction | **Medium** | Same |
| E2E entirely mocked | **Medium** | No CI signal on real evidence graph writes |
| `EducationValidator` omitted from publish gate | **Medium** | Educational layer assertions could publish invalid |
| Outbox publisher not started | **Medium** | Pre-existing; events durable but not delivered |
| `GET /curator/drugs/{slug}/workflow-state` missing from OpenAPI | **Low** | Contract drift |
| Evidence list via search not `GET /evidence` | **Low** | Architectural preference unclear |
| JWT in localStorage | **Low** | Accepted SPA tradeoff |

---

## Risks

| Category | Risk | Likelihood | Impact |
|----------|------|------------|--------|
| **Architecture** | Three parallel drug-evidence URL shapes (UUID drug, slug curator, evidence-centric) | High | Medium — client complexity, doc drift |
| **Product** | Curators use global Evidence Manager thinking citations are saved | Medium | High — silent data loss |
| **Performance** | Evidence browser loads up to 100 search hits then filters client-side | Medium | Low at current scale |
| **Scalability** | Neo4j required for all evidence writes | High | Medium — ops burden |
| **Security** | Evidence routes not in security regression matrix | Low | Medium |
| **Maintainability** | Stale UI copy contradicts implemented API | High | Medium |
| **Deployment** | Production without Neo4j → 503 on evidence create in Drug Editor | Medium | High |
| **Developer experience** | Python 3.9 local env fails (`datetime.UTC`); CI uses 3.12 | Medium | Low — documented in prior audits |

---

## Missing Features (Platform Checklist)

| Feature | Status |
|---------|--------|
| Evidence API CRUD | **Done** |
| Drug evidence attach/detach | **Done** |
| Assertion evidence attach API | **Done** |
| Assertion evidence attach UI | **Missing** |
| EvidenceValidator (FG-C012/C019/C020) | **Done** |
| Evidence Manager browse | **Partial** (search-based) |
| Evidence Manager create/edit persist | **Missing** (validate-only) |
| Drug Editor evidence section | **Done** |
| Publish wizard evidence readiness | **Done** |
| Mechanism editor | **Missing** |
| Graph explorer | **Missing** |
| Snapshots manager | **Missing** |
| Relationship editor | **Missing** |
| AI Draft Assistant | **Missing** |
| Live-stack E2E curation | **Missing** |
| Outbox publisher runtime | **Missing** |
| Rate limiting | **Missing** |
| Full OpenAPI ↔ FastAPI parity | **Partial** |
| CV curriculum content (63 drugs) | **Missing** (~1 stub) |

---

## Suggested Priority — Next 10 Tasks

| Rank | Task | Impact |
|------|------|--------|
| 1 | Wire `EvidenceFormDialog` to `POST /evidence` and `PATCH /evidence/{id}` | Fixes false create/edit UX in global manager |
| 2 | Add assertion attach UI in Drug Editor (indications/relationships) | Completes evidence attachment story; backend ready |
| 3 | Simplify `evidence-client.ts` to canonical `/drugs/{id}/evidence` paths only | Reduces contract drift and fallback masking |
| 4 | One live-stack Playwright test (Neo4j + API + Studio) for evidence attach | CI confidence on real graph writes |
| 5 | Fix `apps/studio/README.md` and `evidence-form.tsx` stale copy | Immediate doc/UX accuracy |
| 6 | Remove `docs/api.md` line 62 contradiction; add `workflow-state` to OpenAPI | Contract hygiene |
| 7 | Add evidence + timeline routes to `test_security_regression.py` | Security coverage |
| 8 | Document Neo4j requirement prominently in `docs/development.md` dev setup | Reduces 503 confusion |
| 9 | First real CV drug curation with evidence-backed `TREATS` + publish | Proves end-to-end pipeline beyond stub |
| 10 | Wire `EducationValidator` into `publish_validator.py` | Closes validation gap for educational layer |

---

## Progress Timeline

| Phase | Description | Estimate | Notes |
|-------|-------------|----------|-------|
| **Phase 1** | Specs, ontology, infra, Docker, CI | **~95%** | Unchanged |
| **Phase 2** | Core API, auth, curator backend | **~90%** | +evidence routes |
| **Phase 3** | Studio shell + drug path + publish | **~92%** | Evidence section added |
| **Phase 4** | Evidence workflow + validation gates | **~75%** | Drug path done; global manager partial |
| **Overall platform** | Full vision (600–800 drugs, AI, SDK) | **~42–46%** | Content remains bottleneck |

---

## Repository Health

| Lens | Assessment |
|------|------------|
| **Folder organization** | **Good** — `farmacograph/`, `apps/studio/`, `tests/` mirror domains |
| **Naming consistency** | **Good** — evidence modules aligned across layers |
| **Code duplication** | **Moderate** — drug-evidence paths in 3 routers; client fallbacks duplicate attach logic |
| **Complexity** | **Moderate** — publish validation grouping is substantial but tested |
| **Modularity** | **Good** — service/repo/router separation maintained |
| **Layer separation** | **Good** — Studio never touches Neo4j directly |
| **Architecture cleanliness** | **Good** — Sprint 5 changes follow existing patterns |

~2,552 lines across evidence UI + publish validation modules (Sprint 5 surface area).

---

## AI Readiness

| Capability | Ready? | Notes |
|------------|--------|-------|
| AI Draft Assistant | **Partial** | Studio shell; no LLM integration |
| Explain API | **Partial** | Route exists; skeleton without graph content |
| Reasoning API | **Missing** | Spec only |
| Learning API | **Partial** | Prerequisites endpoint; minimal content |
| Simulation Engine | **Missing** | Roadmap |
| Public SDK | **Missing** | Typed client internal to Studio |
| Developer Platform | **Partial** | OpenAPI + auth; contract tests growing |
| Marketplace | **Missing** | Future |

Evidence workflow **improves** AI readiness by enforcing provenance and citation links — foundation for RAG without hallucination.

---

## Progress Since Last Audit

Compared to [`2026-07-08-pre-sprint5-readiness-audit.md`](2026-07-08-pre-sprint5-readiness-audit.md):

| Subsystem | Pre-Sprint 5 | Post-Sprint 5 |
|-----------|--------------|---------------|
| Git commit state | 101 files uncommitted; Sprint 4 blocked | **`a6e0353` committed** — Sprint 4+5 landed |
| Studio tests | 178/180 (2 failures) | **180/180 pass** |
| Backend tests | Unverified | **161 pass** (verified) |
| `GET /drugs/{id}/evidence` | Missing | **Implemented** (`drugs.py:61`) |
| Publish wizard evidence gating | Broke tests | **Fixed** — `evidence-gating.test.ts` green |
| Evidence Manager | Scaffolded | **Live** — browse + validate forms |
| Drug Editor evidence | Partial | **Complete** — attach/create/detach |
| OpenAPI evidence routes | Modified WT | **Committed and contract-tested** |
| Documentation | Synced in WT | **Mostly synced**; `apps/studio/README.md` still stale |
| Security | No regression | **Unchanged** — evidence routes not in regression matrix |

### Resolved technical debt (from pre-Sprint 5)

- Sprint 4 uncommitted work
- Studio publish-wizard test failures
- Missing drug evidence list route
- Duplicate `SnapshotResultCard` (fixed in Sprint 4 commit)

### New / remaining technical debt

- Global Evidence Manager validate-only forms (new UX debt)
- Client fallback complexity (reduced priority but not removed)
- Stale `evidence-form.tsx` and `apps/studio/README.md` messaging

---

## Repository Evidence Index (Sprint 5)

| Layer | Key paths |
|-------|-----------|
| Validator | `farmacograph/validators/evidence_validator.py` |
| Publish gate | `farmacograph/curator/publish_validator.py` |
| API router | `farmacograph/api/routers/evidence.py` |
| Drug routes | `farmacograph/api/routers/drugs.py:61–97` |
| Curator slug routes | `farmacograph/api/routers/curator.py:123–164` |
| Service | `farmacograph/services/evidence.py` |
| Studio manager | `apps/studio/src/components/evidence/` |
| Studio drug section | `apps/studio/src/components/drug-editor/drug-evidence-section.tsx` |
| Studio client | `apps/studio/src/components/drug-editor/evidence-client.ts` |
| Publish gating | `apps/studio/src/components/publish-wizard/validation/` |
| OpenAPI | `openapi/openapi.yaml` (lines 309–1155) |
| Tests | `tests/validation/test_evidence_validator.py`, `tests/api/test_evidence_api.py`, `tests/api/contract/test_evidence_contract.py`, `apps/studio/e2e/evidence-workflow.spec.ts` |

---

## Executive Summary (for humans)

Sprint 5 **PARTIAL**: the **drug-level evidence attachment flow is production-ready** — backend API, validators, Drug Editor UI, and Publish wizard gating all work together with strong test coverage (161 + 180). The **global Evidence Manager is only half-done** (browse works; create/edit don't persist). Assertion attach remains API-only. Fix the global manager CRUD wiring, collapse API path fallbacks, and run one live Neo4j E2E before calling evidence workflow complete.

---

## AI Handoff Summary

```
AUDIT: Post-Sprint 5 (2026-07-08). VERDICT: PARTIAL.
HEAD: a6e0353. Tests verified: backend 161 passed (9 skipped), Studio 180 passed.

SPRINT 5 DONE:
- Evidence API: 8 routes in evidence.py + 3 drugs.py + 3 curator slug routes
- EvidenceValidator FG-C012/C019/C020 in publish_validator.py
- Drug Editor Evidence section: drug-evidence-section.tsx + evidence-client.ts (POST/attach works)
- Publish wizard evidence readiness: publish-wizard/validation/* + evidence-gating.test.ts
- OpenAPI synced: /evidence, /drugs/{id}/evidence, /curator/drugs/{slug}/evidence

SPRINT 5 GAPS (block full PASS):
1. Global Evidence Manager (/knowledge/evidence): EvidenceFormDialog only calls POST /curator/validate — NO POST/PATCH /evidence
2. Evidence browser lists via GET /search?types=evidence, not GET /evidence list
3. Assertion attach: POST /evidence/{id}/assertions — backend only, no Studio UI
4. evidence-client.ts still has multi-path fallbacks (/drugs, /evidence?drug_id=, /evidence/{id}/drugs)
5. E2E evidence-workflow.spec.ts — all mocked
6. Stale docs: apps/studio/README.md (evidence placeholder), evidence-form.tsx copy, docs/api.md:62

PRE-SPRINT 5 BLOCKERS: ALL RESOLVED (committed, tests green, GET /drugs/{id}/evidence added).

NEXT (priority): Wire EvidenceFormDialog to POST/PATCH; assertion UI; simplify evidence-client; live E2E; doc fixes; first real CV drug with SUPPORTED_BY edges.
```

---

*End of post-Sprint 5 architecture audit.*
