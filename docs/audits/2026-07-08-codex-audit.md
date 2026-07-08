# FarmacoGraph Codex Audit

Date: 2026-07-08  
Scope: static repository audit only; no code changes.  
Inputs: README, architecture/product docs, prior audit notes, FastAPI routers/services, Studio auth/evidence/publish paths, OpenAPI references, deploy smoke script, and attached handoff prompt.

## Executive Summary

FarmacoGraph is in a solid post-foundation state: the core API layering is consistent, Studio uses the public REST API rather than direct database access, auth is implemented with scoped JWT/API key flows, and the curator path from draft through publish is wired. The most important immediate risks are not large missing subsystems; they are documentation drift, evidence workflow test realism, and keeping production deploy regressions from reappearing.

No new P0 blocker was found in this pass. The auth redirect code now has explicit login-loop and open-redirect defenses. The higher-value work is to tighten the contract/docs around evidence routes, add real-stack verification for evidence attach/create, and reconcile stale roadmap/development statements with the current code.

## Findings

### [P1] Evidence workflow E2E can pass while production route semantics differ

- **Symptom:** Studio evidence tests can pass against mocks that accept both slug-like and UUID-like drug identifiers, while real FastAPI drug-scoped routes require UUID path parameters.
- **Evidence:** `apps/studio/e2e/helpers/evidence-api.ts:260-267` mocks `drugs/ramipril/evidence` and `drugs/{uuid}/evidence`; real `farmacograph/api/routers/drugs.py:61-80` declares `drug_id: UUID`. `useDrugEvidence` selects `entityId || drugId` at `apps/studio/src/components/drug-editor/use-drug-evidence.ts:22-30`, so current editor packages are probably safe when `entity_payload.id` is present, but the mock is more permissive than production.
- **Root cause:** The Playwright mock encodes a friendlier route surface than the backend actually exposes.
- **Fix:** Add one non-mocked or stricter mocked test that fails if Studio sends a slug to `/drugs/{drug_id}/evidence`; keep slug-specific curation routes under `/curator/drugs/{slug}/evidence`.
- **Verify:** `cd apps/studio && npm run test:e2e -- evidence-workflow.spec.ts`; then a live-stack smoke against `POST /api/v1/drugs/{uuid}/evidence` and `POST /api/v1/curator/drugs/{slug}/evidence`.
- **Doc update:** `docs/studio-roadmap.md` evidence workflow table.

### [P1] Evidence fallback path is misleading and can return unscoped catalog data

- **Symptom:** If `/drugs/{drugId}/evidence` fails, Studio falls back to `/evidence?drug_id=...`; the backend evidence list route does not accept or apply `drug_id`, so the fallback may return the general evidence catalog rather than drug-specific attachments.
- **Evidence:** fallback at `apps/studio/src/components/drug-editor/evidence-client.ts:45-59`; backend list parameters at `farmacograph/api/routers/evidence.py:23-40` include `limit`, `offset`, `evidence_type`, `search`, `dataset_version`, but no `drug_id`; service signature at `farmacograph/services/evidence.py:57-65` also has no `drug_id`.
- **Root cause:** A historical compatibility fallback remained after proper drug evidence routes were added.
- **Fix:** Prefer the implemented route surface only: UUID-based `/drugs/{id}/evidence` for canonical drug IDs and slug-based `/curator/drugs/{slug}/evidence` for curator context. If `/evidence?drug_id=` is desired, implement it explicitly server-side and add contract tests.
- **Verify:** Add/adjust unit test around `fetchDrugEvidence` fallback behavior; live API request `GET /api/v1/evidence?drug_id=<uuid>` should either be documented as unsupported or return scoped data.
- **Doc update:** `docs/api.md`, `openapi/openapi.yaml` if adding filter semantics.

### [P2] Documentation says Studio publish transitions are not wired, but they are — resolved in evidence hardening sprint

- **Symptom:** Development docs understate current Studio capability and may send future agents toward redundant work.
- **Evidence:** Before this sprint, `docs/development.md:154` described publish transitions as API-only. Current README marks publish wizard complete at `README.md:20`, and `docs/api.md:219` says transition endpoints are wired to the Drug Editor Publish wizard.
- **Root cause:** Status docs were updated unevenly after Studio 4.4.
- **Fix:** Update `docs/development.md` route/workflow section to match README and API docs.
- **Verify:** Run the sprint doc-drift grep for stale publish status phrases.
- **Doc update:** `docs/development.md`.

### [P2] Curation Studio evidence status table contains stale route alignment warning

- **Symptom:** `docs/curation-studio.md` claims a Studio/API path gap that no longer matches the backend router.
- **Evidence:** `docs/curation-studio.md:66` says backend exposes drug links under `/evidence/{id}/drugs/{drug_id}` while Studio uses `/curator/drugs/{slug}/evidence`. But FastAPI implements curator slug evidence routes at `farmacograph/api/routers/curator.py:123-152`.
- **Root cause:** Evidence routes were added after the product spec warning was written.
- **Fix:** Replace the gap statement with the actual split: public drug UUID routes, curator slug routes, and evidence-centric attach routes all exist, but test coverage and fallback cleanup remain open.
- **Verify:** Run the sprint doc-drift grep for stale evidence route phrases.
- **Doc update:** `docs/curation-studio.md`, optionally `docs/studio-roadmap.md`.

### [P2] Platform architecture marks auth introspection as planned despite live route — resolved in evidence hardening sprint

- **Symptom:** Architecture docs conflict with implemented auth status.
- **Evidence:** Before this sprint, `docs/platform-architecture.md:202` marked `POST /auth/introspect` as future work. FastAPI exposes it at `farmacograph/api/routers/auth.py:69-95`; README lists API 5.2 introspect complete at `README.md:18`.
- **Root cause:** Older platform architecture status table was not reconciled after API 5.2.
- **Fix:** Mark introspect live and narrow the planned item to self-service key management if that is still future work.
- **Verify:** Run the sprint doc-drift grep for stale auth introspection status.
- **Doc update:** `docs/platform-architecture.md`.

### [P2] API docs still call drug-scoped evidence list contract-only — resolved in evidence hardening sprint

- **Symptom:** API docs said `GET /drugs/{drug_id}/evidence` was not routed, but FastAPI routes it.
- **Evidence:** Before this sprint, `docs/api.md:60-64` listed drug-scoped evidence list as contract-only. Real routes exist at `farmacograph/api/routers/drugs.py:61-97`; OpenAPI also includes `/drugs/{drug_id}/evidence`.
- **Root cause:** Planned endpoint list was not pruned after implementation.
- **Fix:** Move drug-scoped evidence list/attach/detach into current endpoint docs and reserve "planned" for truly missing entity/graph/AI endpoints.
- **Verify:** Compare `rg "@router\\.(get|post|delete)" farmacograph/api/routers` with `docs/api.md` endpoint tables.
- **Doc update:** `docs/api.md`.

### [P3] Evidence Manager is live, but assertion-level evidence remains product gap

- **Symptom:** Curators can manage evidence records and drug attachments, but cannot attach evidence to individual assertions from the Studio UI.
- **Evidence:** API assertion attach/detach exists at `farmacograph/api/routers/evidence.py:114-139`; roadmap marks assertion `SUPPORTED_BY` UI planned at `docs/studio-roadmap.md:162`; curation spec repeats it at `docs/curation-studio.md:67`.
- **Root cause:** Mechanism/relationship editors are still planned, so assertion-level UX has no natural editing surface yet.
- **Fix:** Keep as planned product work; do not treat as a backend blocker. When mechanism editor starts, design assertion IDs and evidence attachment affordances together.
- **Verify:** Add UI tests once mechanism/relationship editor surfaces exist.
- **Doc update:** None required beyond keeping planned status explicit.

### [P3] Production smoke coverage is strong for deploy regressions but not authenticated curation

- **Symptom:** `scripts/smoke-studio.sh` catches API health, login page, redirect loops, empty HTML, static chunks, localhost leakage, and build fingerprint, but it intentionally does not log in or exercise curation mutations.
- **Evidence:** script comment at `scripts/smoke-studio.sh:9-10`; checks cover `/api/v1/health`, `/studio/`, `/studio/login/`, chunks, and build ID at `scripts/smoke-studio.sh:51-204`.
- **Root cause:** Smoke script is safe for public production probing, not a full authenticated curation test.
- **Fix:** Keep this script non-invasive; add a separate staging-only authenticated smoke for login, drug editor load, validation dry-run, evidence attach/create against a disposable fixture.
- **Verify:** Existing: `./scripts/smoke-studio.sh https://farmacograph.furkanguven.space`. Future staging smoke should require explicit env vars and never run against production by default.
- **Doc update:** `docs/deploy-studio.md`, `docs/test-strategy.md`.

## Doc Drift Table

| File | Drift | Suggested correction |
|------|-------|----------------------|
| `docs/development.md` | Previously said publish transitions were API-only | Mark Publish wizard live; include route `/knowledge/drugs/[id]` header button flow |
| `docs/curation-studio.md` | Says curator drug evidence path alignment is a gap | State current route split and remaining test/fallback risks |
| `docs/platform-architecture.md` | Marks `/auth/introspect` planned | Mark live; keep self-service API key management planned |
| `docs/api.md` | Previously marked `GET /drugs/{drug_id}/evidence` as contract-only | Move drug evidence routes to implemented section |
| `docs/studio-roadmap.md` | Previously questioned whether drug-evidence routes were routed | Update to "routed; live-stack coverage still needed" |

## Test Gaps

- Add a stricter evidence workflow test where `/drugs/ramipril/evidence` returns 422/404 and only UUID or curator slug routes succeed.
- Add backend/API contract tests for `/drugs/{uuid}/evidence`, `/curator/drugs/{slug}/evidence`, and `/evidence/{id}/drugs/{uuid}` with auth scopes.
- Add a staging-only authenticated Studio smoke that exercises at least one read-only curator flow and one dry-run validation flow.
- Add a test confirming unsupported query params like `/evidence?drug_id=` are not accidentally treated as scoped results, unless that filter is intentionally implemented.

## Deploy Checklist Review

The deploy smoke script directly targets the recent production incidents:

- `/studio/` redirect loop detection.
- `/studio/login/` must be public 200.
- Empty/tiny HTML body detection.
- Static chunk path verification under `/studio/_next/static`.
- Loopback URL leakage check.
- `build-id.txt` check to prove the new image is deployed.

Residual deploy risk is mostly process-driven: cached Docker builds, stale nginx reloads, and schema drift on persistent Postgres volumes. The existing `scripts/fix-studio-production.sh`, `scripts/migrate-schema.sh`, and `scripts/smoke-studio.sh` remain the key operational guardrails.

## Recommended Sprint

Recommended next sprint: **Evidence Workflow Hardening**.

1. Reconcile docs and OpenAPI/API route descriptions for evidence and publish status.
2. Remove or formalize the `/evidence?drug_id=` fallback.
3. Add backend tests for the three evidence attachment route families.
4. Add stricter Playwright route mocks that mirror FastAPI UUID vs slug semantics.
5. Add a staging-only authenticated smoke for evidence create/attach/detach with disposable data.

This is smaller and safer than starting mechanism/graph explorer work immediately, and it protects the current "secure curation path live" claim.

## What Appears Healthy

- Studio auth route hardening is explicit: `isLoginPath`, `safeReturnTo`, and `isLoginLoopLocation` are implemented in `apps/studio/src/lib/auth/routes.ts`.
- Middleware avoids protecting login variants before any auth decision in `apps/studio/src/middleware.ts`.
- FastAPI routing follows the intended dependency flow: routers depend on services, services on repositories.
- Curator publish path is state-gated and records audit/outbox/job/snapshot side effects.
- Production smoke checks are practical and aligned with the incidents described in the handoff.

## Commands Used

```bash
git status --short --branch
rg "TODO|FIXME|Gap|Planned|not yet|stub|deprecated" README.md docs farmacograph apps/studio/src -n
rg "curator/drugs|drugs/.*/evidence|/evidence|introspect|workflow-state|timeline" openapi/openapi.yaml -n
rg "@router\\.(get|post|put|delete|patch)" farmacograph/api/routers -n
```

No tests were run during this audit pass.
