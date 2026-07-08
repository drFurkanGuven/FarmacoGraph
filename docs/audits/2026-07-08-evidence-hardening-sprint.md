# Evidence Workflow Hardening Sprint

Date: 2026-07-08  
Scope: Studio evidence route alignment, stricter evidence tests, backend route contract tests, documentation reconciliation.

## What Changed

- Studio Drug Editor evidence calls now resolve a canonical route from explicit context:
  - slug context: `/curator/drugs/{slug}/evidence`
  - UUID context: `/drugs/{uuid}/evidence`
  - missing slug/UUID: clear client error
- Removed the silent `/evidence?drug_id=...` fallback from the Drug Editor evidence client. The global `/evidence` catalog is no longer used as a pretend drug-scoped evidence source.
- Attach/detach now use the same selected route split as list calls. Attach responses that only return link metadata are hydrated with `GET /evidence/{id}` so existing UI summaries still receive an evidence record.
- Playwright evidence mocks now reject `/drugs/ramipril/evidence` and expose `/curator/drugs/ramipril/evidence` plus `/drugs/{uuid}/evidence` separately.
- Backend API tests now cover UUID drug evidence, slug curator evidence, invalid slug-on-UUID route behavior, and the documented non-scoped behavior of `/evidence?drug_id=...`.
- Docs were reconciled for Publish wizard status, drug evidence route status, and live `/auth/introspect`.

## Intentionally Deferred

- No server-side `GET /evidence?drug_id=` filter was implemented; removal of the misleading Studio fallback was the selected path.
- No nginx, middleware, auth, mechanism editor, graph explorer, or assertion-level evidence UI changes.
- Live context panel overflow remains a separate UI follow-up with visual verification.
- Staging authenticated smoke script was not added in this pass; existing public smoke remains unchanged.

## Commands Run

```bash
cd apps/studio && npm test -- evidence
# Passed: 7 files, 40 tests

cd apps/studio && npm test
# Passed: 36 files, 216 tests

cd apps/studio && npm run build
# Passed; existing ESLint warnings remain in unrelated files

cd apps/studio && npm run test:e2e -- evidence-workflow.spec.ts
# First sandboxed attempt failed with EPERM starting local server on 0.0.0.0:3000
# Rerun with local server permission passed: 3 tests

python3 -m pytest tests/api/test_evidence_api.py -v
# Failed on system Python 3.9: datetime.UTC unavailable

.venv/bin/python -m pytest tests/api/test_evidence_api.py -v
# Passed: 11 tests

./scripts/dev.sh test
# Failed on system Python 3.9: datetime.UTC unavailable

FG_ENVIRONMENT=test FG_DATABASE_URL=sqlite+aiosqlite:///:memory: FG_NEO4J_ENABLED=false FG_LOG_JSON=false .venv/bin/python -m pytest -m "not integration"
# Passed: 160 passed, 5 skipped, 19 deselected

rg <stale publish/evidence/introspection status phrases> docs README.md
# Passed: no matches for the sprint drift pattern
```

## Known Residual Risks

- Production-like evidence create/attach still needs a live Neo4j staging smoke to cover graph writes end to end.
- Global Evidence Manager writes still depend on Neo4j availability and should surface 503 states clearly.
- Assertion-level `SUPPORTED_BY` UI remains planned for mechanism/relationship editor work.
- Local scripts that call `python3` may fail on machines where `python3` is below 3.11; this repo's `.venv` test run passed.
