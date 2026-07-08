# Disease Completion — Phase 1 Sprint Report

Date: 2026-07-08  
Scope: Finish Disease module curation path; wire Drug ↔ Disease `TREATS` picker; sync OpenAPI.

## Executive summary

Phase 1 closes the gap between “Disease module started” and “curator can complete a drug–disease story in Studio.” Disease Editor now has the same publish workflow surface as Drug Editor. Drug Editor `TREATS` uses a searchable disease picker backed by `/curator/diseases`. Validation rejects unknown disease UUIDs (FG-C027).

## Delivered

| Area | Change |
|------|--------|
| Backend | `GET /curator/diseases/{slug}/workflow-state` (symmetric with drug) |
| Studio | `PublishWizard` generalized with `entityType: "Drug" \| "Disease"` |
| Studio | Disease Editor publish button + workflow state panel |
| Studio | `DiseasePicker` in Drug Editor indications (`relationships.TREATS`) |
| Validation | `BiomedicalValidator` checks TREATS/PREVENTS/… targets against nodes index (FG-C027) |
| OpenAPI | Curator disease routes + drug/disease workflow-state + `/diseases/{disease_id}` |
| Tests | Disease API, biomedical validator, contract path assertions |

## Catalog honesty (static index vs graph)

| Source | Used by | Meaning |
|--------|---------|---------|
| `staging/cardiovascular/shared/nodes.index.json` | `GET /diseases`, `GET /curator/diseases`, TREATS validation | **Authoring catalog** — canonical UUIDs for curriculum diseases |
| Neo4j (after publish) | Graph queries, future list enrichment | **Published truth** — MERGE from curator publish |

`GET /diseases` is **not** a live Neo4j list today. It is the bootstrap catalog so curators can pick `hypertension` before graph-backed list queries ship. After disease publish, the node exists in Neo4j and drug `TREATS` edges resolve in graph reads.

## Definition of done (Phase 1)

- [x] Disease draft opens, autosaves, validates
- [x] Publish wizard visible in Disease Editor
- [x] Drug Editor selects hypertension via picker (not raw UUID textarea)
- [x] Validation flags unknown disease IDs in `TREATS`
- [x] Curator disease routes documented in OpenAPI + `docs/api.md`
- [ ] Production deploy + browser smoke (user action)
- [ ] Full Ramipril → Hypertension → publish → API graph read E2E with Neo4j (Phase 5)

## Intentionally deferred (Phase 2+)

- Education module in Drug Editor
- Mechanism DAG editor
- Interactive graph canvas
- Neo4j-backed `list_diseases` (replace nodes index for reads)
- Student API enrichment (`GET /explain` with education + diseases)

## Commands run

- `npm test -- drug-editor publish-wizard` — passed
- `pytest tests/api/test_diseases_api.py tests/curator/test_disease_package.py` — passed
- `pytest tests/validation/test_biomedical_validator.py` — passed
- `npm run build` (Studio) — run before deploy

## Residual risks

- Picker catalog and validation both use nodes index; stale index = stale picker until re-seed.
- Disease publish still shares generic workflow transitions; no disease-specific evidence rules yet.
- E2E Playwright for disease publish path not added in this phase.
