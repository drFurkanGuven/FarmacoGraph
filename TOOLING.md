# Developer Tooling

Quality infrastructure for FarmacoGraph. Feature code lives elsewhere; this doc covers lint, test, and CI commands only.

## Prerequisites

```bash
# Python (from repo root)
pip install -e ".[api,db,auth,observability,dev]"

# Node (root + Studio)
npm install
cd apps/studio && npm install
```

Optional: `pip install pre-commit && pre-commit install` for Python hooks alongside Husky.

## Commands (repo root)

| Command | Description |
|---------|-------------|
| `npm run lint` | Ruff (Python) + ESLint (Studio) |
| `npm run typecheck` | mypy + `tsc --noEmit` |
| `npm run test` | pytest + Vitest unit tests |
| `npm run test:python:integration` | pytest integration marker only |
| `npm run test:e2e` | Playwright (Studio) |
| `npm run coverage` | Python + frontend coverage reports |
| `npm run validate` | lint + typecheck + test |

Studio-only scripts: `cd apps/studio && npm run <script>`.

## Pre-commit

- **Husky** (`npm install` at root): runs `lint-staged` and a fast `ruff check`.
- **pre-commit** (optional): `.pre-commit-config.yaml` for ruff, mypy, and file hygiene.

## CI

See `.github/workflows/ci.yml` — Python lint/typecheck/test, Studio lint/typecheck/unit tests, Playwright smoke on `main`/`develop`, Docker build.

### Known blockers

- **mypy**: ~85 errors in `farmacograph/`; CI runs with `continue-on-error` until resolved.
- **ruff**: existing lint debt in `farmacograph/`; fix incrementally or run `python3 -m ruff check --fix farmacograph tests`.
