# FarmacoGraph Pre-Sprint 5 Readiness Audit

**Audit date:** 2026-07-08  
**Repository:** `/Users/furkan/Desktop/FarmacoGraph`  
**Scope:** Post-Sprint 4 verification + Sprint 5 (Evidence Manager) readiness  
**Auditor:** Architecture Auditor (read-only)  
**Prior audits:** [`2026-07-08-architecture-audit.md`](2026-07-08-architecture-audit.md) (baseline), [`2026-07-08-sprint4-architecture-audit.md`](2026-07-08-sprint4-architecture-audit.md) (Sprint 4 functional review)  
**Git HEAD:** `486e608` — *"Deliver end-to-end curation vertical slice for Studio."*  
**Working tree:** 60 modified + 41 untracked files (**101 outside HEAD**)

---

# Executive Summary

## Sprint 4 verdict: **PASS WITH MINOR FOLLOW-UPS**

Sprint 4 deliverables are **functionally implemented in the working tree**: Publish Wizard, workflow state panel, validation integration, submit/approve/publish actions, activity timeline, and snapshot result card all exist with supporting backend routes and tests. Documentation and OpenAPI have been updated in modified files to reflect Studio 4.4 completion.

Sprint 4 is **not release-ready** because the publish wizard (`apps/studio/src/components/publish-wizard/`), workflow timeline UI, dedicated publish/timeline backend tests, and OpenAPI/doc updates are **not committed**. Git HEAD still lacks the Publish button in the Drug Editor and the timeline route.

## Sprint 5 readiness: **BLOCKED**

Do **not** treat Sprint 5 as a clean start until Sprint 4 work is committed, Studio tests are green, and evidence URL contracts are aligned. Sprint 5 scaffolding (Evidence Manager page, drug evidence section, evidence router) already exists in the working tree but introduces path mismatches and test regressions.

| Lens | Assessment |
|------|------------|
| Sprint 4 functional goals | **Complete** (working tree) / **Incomplete** (HEAD) |
| Studio tests | **178/180 pass** — 2 publish-wizard UI failures |
| Backend publish tests | **Present, unverified** — local Python 3.9 cannot run pytest |
| Docs + OpenAPI | **Synced in working tree** — timeline + `PublishWorkflowResponse` in `openapi/openapi.yaml` |
| Security | **No regressions** — anonymous curator mutations return 401 |
| Studio-first curation | **Yes** — documented and functional in working tree |
| Evidence Manager start | **Blocked** — API gaps + uncommitted Sprint 4 + failing tests |

**Recommended action:** Land Sprint 4 commit, fix 2 Studio test failures, then begin Sprint 5 with evidence contract alignment as Task 1.

---

# Sprint 4 Completion Checklist

| Item | Status | Evidence |
|------|--------|----------|
| **Publish Wizard** | **Complete** (WT*) / **Missing** (HEAD) | `apps/studio/src/components/publish-wizard/publish-wizard.tsx` (untracked); `drug-editor-workspace.tsx` wires header button (modified); absent in HEAD (`git show HEAD:...drug-editor-workspace.tsx` — no publish/wizard) |
| **Workflow State Panel** | **Complete** (WT) / **Partial** (HEAD) | `workflow-state-panel.tsx` (untracked); embedded in `drug-context-panel.tsx` (modified) |
| **Validation integration** | **Complete** (WT) | `use-publish-readiness.ts` with `skipPackageFetch`; wizard receives `editorValidation` from drug editor |
| **Submit action** | **Complete** | `use-publish-wizard.ts` → `client.submitWorkflow`; backend `POST /curator/workflows/{id}/submit` in HEAD |
| **Approve action** | **Complete** | `client.approveWorkflow`; backend requires `curator:publish` scope |
| **Publish action** | **Complete** | `client.publishWorkflow`; `build_publish_result_async` in modified `services/curator.py` |
| **Audit timeline** | **Complete** (WT) / **Missing** (HEAD) | Backend `GET /curator/workflows/{id}/timeline` (`curator.py:215`, modified); UI `workflow-timeline/` (untracked) |
| **Snapshot result** | **Complete** (WT) | `snapshot-result-card.tsx`, `publish-phases.tsx`; `PublishWorkflowResponse` in OpenAPI (modified) |
| **Tests** | **Partial** | Untracked: `tests/curator/test_publish_workflow.py`, `tests/api/test_publish_workflow.py`, `tests/curator/test_workflow_timeline.py`; Studio **2 failures** in `publish-wizard-ui.test.tsx` |
| **Documentation** | **Complete** (WT) / **Stale** (HEAD) | `docs/curation-studio.md:4-10` marks 4.4 complete; `docs/studio-roadmap.md` updated; modified, not committed |
| **OpenAPI sync** | **Complete** (WT) / **Stale** (HEAD) | `openapi/openapi.yaml` has `/curator/workflows/{id}/timeline` (line 357) and `PublishWorkflowResponse` (line 1593); modified, not committed |

*WT = working tree*

---

# Blockers Before Sprint 5

1. **Commit Sprint 4 vertical slice** — publish wizard directory, workflow-timeline, timeline route + enhanced publish in `curator.py`, publish/timeline tests, doc/OpenAPI updates (~101 files outside HEAD).
2. **Fix 2 failing Studio tests** — `publish-wizard-ui.test.tsx` fails when rendering `EvidenceReadinessPanel` (`validation-panel.tsx:203-224` — `validation.evidence.categorized` undefined in test fixtures).
3. **Resolve evidence list/attach contract** — `GET /drugs/{drug_id}/evidence` not implemented (`drugs.py` has no evidence routes); Studio `evidence-client.ts:46` tries drug-centric path first, falls back to `/evidence?drug_id=`.
4. **Verify backend tests on Python 3.12** — local env blocked (`ImportError: cannot import name 'UTC' from 'datetime'` on Python 3.9).
5. **Neo4j requirement for evidence writes** — `EvidenceService._require_graph()` returns 503 without Neo4j; must be documented for Sprint 5 dev setup.

---

# Non-Blocking Follow-ups

- Add `GET .../timeline` to `tests/api/test_security_regression.py`.
- Live-stack E2E: real submit → approve → publish (current `publish-wizard.spec.ts` is mock-only).
- Snapshots manager page (`/snapshots` still placeholder).
- OpenAPI `workflow-state` route (`GET /curator/drugs/{slug}/workflow-state` exists in `curator.py:88`, not grep-matched in OpenAPI).
- Outbox publisher not started in API lifespan (unchanged from baseline).
- Rate limiting still missing (pre-existing).
- `GET /curator/drugs/{slug}/evidence` — referenced in `studio-roadmap.md:160` as Studio expectation; not implemented (Studio client uses `/drugs/{id}/evidence` with fallback).

---

# Architecture Drift

| Area | Spec | Implementation | Drift |
|------|------|----------------|-------|
| Sprint 4 in VCS | Complete per `studio-roadmap.md` | Publish wizard untracked; timeline modified | **Severe** — code ahead of git |
| Evidence drug list | `studio-roadmap.md:160` mentions `GET /drugs/{id}/evidence` | Not in `drugs.py`; OpenAPI has evidence-centric attach only | **Moderate** |
| Evidence attach | OpenAPI `POST /evidence/{id}/drugs/{drug_id}` | FastAPI matches; Studio tries drug-centric first (`evidence-client.ts:121-134`) | **Low** — client has fallback |
| Evidence Manager | Sprint 5 scope | `EvidenceBrowser` already live at `/knowledge/evidence` | **Ahead of schedule** — partial Sprint 5 in WT |
| Publish wizard evidence gating | Sprint 5 concern | `EvidenceReadinessPanel` in publish validation (untracked) | **Scope bleed** — causes test failures |
| Dashboard curriculum | API-first (`docs/api-first.md`) | Filesystem via `drug_package.py` | **Pre-existing** |
| Mechanism DAG engine | Roadmap ✅ | Model only, no engine | **Unchanged** |

---

# Security Review

| Check | Status | Evidence |
|-------|--------|----------|
| Anonymous curator mutations | **401** | `require_scope` (`deps.py:120-133`) raises 401 when unauthenticated and scope not in `ANONYMOUS_READ_SCOPES` |
| Scope separation write vs publish | **Enforced** | `curator:publish` required for approve/publish (`curator.py:303,320`) |
| API key + JWT auth | **Implemented** (HEAD) | `resolve_request_auth` in deps; `POST /auth/token` in HEAD commit |
| Evidence create | **curator:write** + Neo4j | `evidence.py` (untracked router mount in modified `main.py`) |
| Evidence read | **knowledge:read** | `GET /evidence`, `GET /evidence/{id}` |
| Timeline access | **curator:write** | `curator.py:215` — not in security regression matrix |
| Rate limiting | **Missing** | Config fields exist; no middleware |
| Studio auth cookie | **Weak gate** | Cookie flag middleware — pre-existing, documented tradeoff |

**No Sprint 4 security regressions detected.** The baseline anonymous curator-write defect is fixed.

---

# API Contract Review

### Sprint 4 curator routes (working tree vs OpenAPI)

| Route | FastAPI | OpenAPI (modified WT) |
|-------|---------|----------------------|
| `GET /curator/workflows/{id}/timeline` | ✅ `curator.py:215` | ✅ `openapi.yaml:357` |
| `POST /curator/workflows/{id}/publish` extended body | ✅ `build_publish_result_async` | ✅ `PublishWorkflowResponse` |
| `GET /curator/drugs/{slug}/workflow-state` | ✅ `curator.py:88` | **Missing** from OpenAPI |

### Evidence routes (Sprint 5-critical)

| Operation | OpenAPI (modified WT) | FastAPI (`evidence.py`) | Studio client |
|-----------|----------------------|-------------------------|---------------|
| List evidence | `GET /evidence` | ✅ | `GET /evidence` (`evidence-client.ts:83`) |
| Create evidence | `POST /evidence` | ✅ | `POST /evidence` ✅ |
| Get evidence | `GET /evidence/{id}` | ✅ | via `GET /evidence/{id}` on attach fallback |
| List drug evidence | **Not in OpenAPI** | **Missing** | `GET /drugs/{id}/evidence` with fallback to `/evidence?drug_id=` |
| Attach to drug | `POST /evidence/{eid}/drugs/{did}` | ✅ | Tries `POST /drugs/{id}/evidence` first, falls back to evidence-centric path |
| Detach from drug | `DELETE /evidence/{eid}/drugs/{did}` | ✅ | Similar fallback pattern |
| Attach to assertion | `POST /evidence/{eid}/assertions` | ✅ | Not in Studio UI yet |

**Assessment:** OpenAPI and FastAPI are **aligned on evidence-centric attach paths** in the working tree. The main gap is **missing `GET /drugs/{drug_id}/evidence`** (Studio expects it; documented as gap in `studio-roadmap.md:160`). Studio client fallbacks mask this but add complexity.

### Other mismatches (pre-existing)

- Entity routes in OpenAPI (`/diseases`, `/graph/query`, etc.) still unimplemented.
- `GET /drugs/{slug}/prerequisites` vs OpenAPI `{id}` ambiguity — unchanged.

---

# Studio Readiness

| Capability | Status | Evidence |
|------------|--------|----------|
| Publish Wizard | **Complete** (WT) | Full wizard with stepper, validation, confirmation, result phases |
| Workflow timeline in context panel | **Complete** (WT) | `workflow-timeline/` in `drug-context-panel.tsx` |
| Validation Center | **Complete** (HEAD) | `/validation` live |
| Drug Editor | **Complete** (HEAD + WT) | Autosave, sections; publish button only in WT |
| Evidence Manager page | **Partial** | `EvidenceBrowser` at `/knowledge/evidence` (modified page) |
| Drug Editor evidence section | **Partial** | `drug-evidence-section.tsx`, `DrugEvidencePanel` — API fallbacks may return empty |
| Publish wizard evidence gating | **Partial** | `EvidenceReadinessPanel` integrated; **breaks 2 UI tests** |
| Mechanism / Graph / Snapshots | **Missing** | Placeholder pages |

**Studio is structurally ready** to host Evidence Manager (routing, design system, API client patterns exist). **Functional readiness is blocked** by uncommitted Sprint 4, test failures, and evidence API gaps.

---

# Recommended Sprint 5 Scope

Confirm and adjust the proposed plan:

| # | Task | Priority | Notes |
|---|------|----------|-------|
| 0 | **Land Sprint 4 commit + green CI** | **P0** | Prerequisite — not optional |
| 1 | **Evidence Task A: `GET /drugs/{drug_id}/evidence`** | **P0** | Add to `drugs.py` or curator router; update OpenAPI; remove client fallback |
| 2 | **Fix `EvidenceReadinessPanel` test fixtures** | **P0** | Ensure `validation.evidence.categorized` in publish wizard test mocks |
| 3 | **Evidence Manager page polish** | **P1** | `EvidenceBrowser` exists — wire `GET /evidence` list reliably; update stale E2E if any |
| 4 | **Drug Editor evidence panel ↔ API** | **P1** | `use-drug-evidence.ts` + integration tests against real routes |
| 5 | **Evidence create/edit** | **P1** | Create works; add edit flow if in spec |
| 6 | **Evidence attachment to drug** | **P1** | Backend path exists; simplify client to single contract |
| 7 | **Evidence attachment to assertions** | **P2** | Backend `POST /evidence/{id}/assertions` exists; no UI yet |
| 8 | **Validation readiness for evidence** | **P1** | `evidence-gating.test.ts` exists; wire to publish gate |
| 9 | **Publish Wizard evidence step** | **P2** | Panel exists; fix tests first |
| 10 | **OpenAPI sync** | **P1** | Add `workflow-state`, `GET /drugs/{id}/evidence`; commit with Sprint 4 |
| 11 | **Tests** | **P1** | `tests/api/test_evidence_api.py` (untracked); contract tests |
| 12 | **Documentation** | **P2** | Neo4j dev guide for evidence writes |

**Adjusted Sprint 5 entry criteria:** Sprint 4 committed, 180/180 Studio tests pass, `GET /drugs/{id}/evidence` implemented, evidence attach uses one URL shape end-to-end.

---

# Progress Since Sprint 4 Audit

Compared to [`2026-07-08-sprint4-architecture-audit.md`](2026-07-08-sprint4-architecture-audit.md):

| Subsystem | Sprint 4 audit | Now |
|-----------|----------------|-----|
| Documentation | **Stale** (4.4 marked planned) | **Synced** in modified files (`curation-studio.md`, `studio-roadmap.md`, `api.md`) |
| OpenAPI timeline/publish | **Missing** | **Added** in modified `openapi.yaml` |
| Evidence Manager | **Missing** | **Scaffolded** — browser, drug section, backend router (mostly untracked) |
| Studio tests | 131 pass | **178 pass, 2 fail** (+47 tests; regressions from evidence integration) |
| Duplicate SnapshotResultCard | Present | **Fixed** |
| Git commit state | Assumed committed | **Still uncommitted** — critical new finding |
| Security | Fixed | **Unchanged — no regression** |

---

# AI Handoff Summary

```
AUDIT: Pre-Sprint 5 readiness (2026-07-08). Sprint 4 verdict: PASS WITH MINOR FOLLOW-UPS.
Sprint 5 start: BLOCKED until Sprint 4 committed + tests green + evidence list route.

SPRINT 4 (working tree): Publish wizard LIVE — apps/studio/src/components/publish-wizard/* (UNTRACKED).
Timeline: GET /api/v1/curator/workflows/{id}/timeline (curator.py MODIFIED, not in HEAD).
Workflow timeline UI: apps/studio/src/components/workflow-timeline/ (UNTRACKED).
Docs/OpenAPI: MODIFIED, synced for 4.4 in WT. HEAD lacks publish UI entirely.

TESTS: Studio 178/180 pass. Failures: publish-wizard-ui.test.tsx (2) — EvidenceReadinessPanel
  expects validation.evidence.categorized in fixtures.
Backend publish tests EXIST but UNVERIFIED (tests/curator/test_publish_workflow.py,
  tests/api/test_publish_workflow.py, tests/curator/test_workflow_timeline.py — all UNTRACKED).
Local pytest blocked on Python 3.9 (need 3.12 per CI).

SECURITY: No regressions. require_scope returns 401 for anonymous curator mutations (deps.py:128-131).

STUDIO-FIRST: YES — docs/curation-studio.md:6-10, scripts/dev-only/README.md deprecated.

EVIDENCE (Sprint 5 prep already in WT):
- Router: farmacograph/api/routers/evidence.py (8 routes, mounted in main.py MODIFIED)
- OpenAPI: evidence-centric paths at /evidence, /evidence/{id}/drugs/{drug_id}
- Studio: EvidenceBrowser, DrugEvidenceSection, evidence-client.ts with fallbacks
- GAP: GET /drugs/{drug_id}/evidence NOT implemented; Studio tries it first

BLOCKERS: 1) Commit Sprint 4 (~101 files) 2) Fix 2 Studio tests 3) Implement GET /drugs/{id}/evidence
4) Verify backend tests on Py 3.12

NEXT CURSOR PROMPT SHOULD: Commit Sprint 4, fix publish-wizard-ui tests, add GET /drugs/{id}/evidence
to drugs.py + OpenAPI, then continue Evidence Manager with single attach contract.
```

---

*End of pre-Sprint 5 readiness audit.*
