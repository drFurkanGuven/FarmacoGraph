# Connected Studio Surfaces Sprint

Date: 2026-07-08

## What changed

- Replaced dead placeholder behavior for `/activity` with a connected audit-log and jobs surface.
- Replaced dead placeholder behavior for `/snapshots` with dashboard snapshot metadata and recently published workflow links.
- Added connected read-only surfaces for `/knowledge/education`, `/knowledge/mechanisms`, and `/graph`.
- Preserved the disease browser work already present at `/knowledge/diseases` and added a validation shortcut.
- Added Drug Editor right-panel knowledge links so a focused drug can move into education, disease, mechanism, graph, activity, and snapshot surfaces with `?drug=` context.
- Reconciled Studio/auth/architecture/roadmap docs so publish, auth, evidence, activity, snapshots, and connected surfaces reflect current behavior.

## Intentionally deferred

- Education CRUD/editor UI.
- Mechanism DAG editor.
- Interactive graph canvas and graph-neighborhood query UI.
- Snapshot diff/release-note manager.
- Users/admin page.

## Commands run

- `cd apps/studio && npm test -- activity snapshots knowledge drug-editor` — passed.
- `cd apps/studio && npm test -- --runInBand` — failed; Vitest does not support Jest's `--runInBand` option.
- `cd apps/studio && npm run build` — first run exposed a server/client icon prop boundary issue; fixed, rerun passed with pre-existing lint warnings.
- `cd apps/studio && npm test` — passed, 216 tests.
- `git diff --check` — passed.
- Stale-doc regex for auth, publish, evidence, activity, snapshots, and placeholder wording — only historical audit entries matched.

## Known residual risks

- `/knowledge/education`, `/knowledge/mechanisms`, and `/graph` are intentionally connected navigation/readiness surfaces, not full editors.
- `/snapshots` depends on dashboard snapshot metadata until a dedicated snapshot HTTP API exists.
- `/activity` reflects the current `GET /audit-logs` and `GET /jobs` API shape; deeper filtering can be added after usage patterns settle.
