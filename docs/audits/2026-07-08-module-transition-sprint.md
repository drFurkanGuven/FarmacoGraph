# Module Transition Sprint — Post-Implementation Audit

Date: 2026-07-08  
Scope: Disease backend foundation, Studio disease browser/editor, entity-editor abstraction, staging smoke.

## Executive summary

The first non-drug curation module (**Disease**) is now wired end-to-end at a **minimal viable** level: catalog reads, curator slug workflows, package scaffold, schema validation, Studio browser, and a sectioned editor using the new shared `EntityEditorShell`.

No P0 regressions found in static review. Production public smoke remains green.

## Delivered

| Area | Change |
|------|--------|
| Backend | `GET /diseases`, `GET /diseases/{id}`, `GET /curator/diseases`, `POST /curator/diseases/{slug}/workflows`, `GET /curator/diseases/{slug}/package` |
| Packages | `farmacograph/curator/disease_package.py` — nodes index catalog + `build_disease_entry_package` |
| Validation | `SchemaValidator` skips non-matching `entity_type`; Disease schema registered in publish validator |
| Studio | `DiseaseBrowser`, `DiseaseEditorWorkspace`, shared `components/entity-editor/` |
| Ops | `scripts/smoke-studio-staging.sh` (auth + dashboard + curator diseases) |
| Tests | `tests/api/test_diseases_api.py`, `tests/curator/test_disease_package.py` |

## Findings

### P1 — Disease publish path not yet Studio-tested end-to-end

- **Symptom:** Disease editor saves draft packages but has no publish wizard yet.
- **Impact:** Curators can edit drafts; publish still manual via generic workflow API.
- **Fix direction:** Reuse `PublishWizard` generalization (M-1 from prior audit) in a follow-up sprint.

### P2 — Catalog is nodes-index backed, not Neo4j graph list

- **Symptom:** `GET /diseases` reads `staging/cardiovascular/shared/nodes.index.json`, not live graph.
- **Impact:** Correct for bootstrap; graph-enriched fields appear only after publish.
- **Fix direction:** Extend `GraphRepository` with `list_diseases` when Neo4j content grows.

### P2 — Staging smoke requires explicit credentials

- **Symptom:** Script exits unless `FG_SMOKE_EMAIL` + `FG_SMOKE_PASSWORD` set.
- **Impact:** Intentional — avoids accidental production mutation probes.
- **Verify:** `./scripts/smoke-studio-staging.sh https://staging-host` with env vars.

### P3 — OpenAPI still lacks curator disease routes

- **Symptom:** FastAPI routes exist; OpenAPI sync deferred to contract sprint.
- **Fix:** Add paths in `openapi/openapi.yaml` + `docs/api.md` implemented section.

## Gate status

| Check | Result |
|-------|--------|
| `./scripts/smoke-studio.sh` (production) | PASS (6/6) |
| `npm run build` (Studio) | Run in CI/local after merge |
| `.venv/bin/python -m pytest -m "not integration"` | 160+ passed pre-merge |
| Disease API tests | 9 passed |

## Recommended next sprint

1. OpenAPI sync for disease + workflow-state routes  
2. Generalize `PublishWizard` for `EntityEditorSnapshot`  
3. Drug editor `TREATS` disease picker (uses new disease catalog)  
4. One live Neo4j staging evidence/disease attach smoke
