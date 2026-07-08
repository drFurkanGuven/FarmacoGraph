# Development Guide

> How to set up, run, and test FarmacoGraph locally.

## Prerequisites

| Tool | Version | Purpose |
|------|---------|---------|
| Python | 3.9+ (CI uses 3.12) | API, CLI, tests |
| Node.js | 20+ | Curation Studio |
| Docker | 24+ | PostgreSQL, Neo4j, full stack |
| Git | 2.x | Version control |

On macOS, `pip` and `uvicorn` may not be on PATH — use `python3 -m pip` and `python3 -m uvicorn`, or the `./scripts/dev.sh` helper.

---

## Repository layout

See [repository-structure.md](repository-structure.md) for a full directory map. Key paths:

| Path | Role |
|------|------|
| `farmacograph/` | Python package — API, services, repositories |
| `apps/studio/` | Next.js Curation Studio |
| `ontology/` | Relationship and constraint definitions |
| `openapi/` | REST API contract |
| `tests/` | pytest suite |
| `scripts/dev.sh` | Local development commands |

---

## Quick start (API only)

```bash
git clone https://github.com/drFurkanGuven/FarmacoGraph.git
cd FarmacoGraph

cp .env.example .env
chmod +x scripts/dev.sh
./scripts/dev.sh install
./scripts/dev.sh api
```

Verify:

```bash
./scripts/dev.sh health
# or: curl http://127.0.0.1:8000/api/v1/health
```

- Swagger UI: http://127.0.0.1:8000/docs
- Metrics (if enabled): http://127.0.0.1:8000/metrics

By default, SQLite is used for ops metadata and Neo4j is disabled (`FG_NEO4J_ENABLED=false`). Drug lists and search return empty until Neo4j is enabled and data is published.

---

## Docker stack (PostgreSQL + Neo4j + API + Studio)

```bash
# Scan host ports and write .env overrides
./scripts/find-ports.sh --apply

# Start databases only
./scripts/dev.sh up

# Or full stack
docker compose up -d
```

After starting databases, update `.env`:

```env
FG_DATABASE_URL=postgresql+asyncpg://farmacograph:farmacograph@localhost:5433/farmacograph
FG_NEO4J_ENABLED=true
FG_NEO4J_URI=bolt://localhost:7687
FG_NEO4J_PASSWORD=farmacograph
```

| Service | Default URL | Credentials |
|---------|-------------|-------------|
| API | http://localhost:8001 | — |
| Studio | http://localhost:3001 | — |
| Neo4j Browser | http://localhost:7474 | neo4j / farmacograph |
| PostgreSQL | localhost:5433 | farmacograph / farmacograph |

Run Alembic migrations when using PostgreSQL:

```bash
alembic upgrade head
```

---

## Curation Studio

```bash
cd apps/studio
cp .env.example .env.local
npm install
npm run dev
```

Open http://localhost:3000. Configure the API URL in Settings or set `NEXT_PUBLIC_API_URL=http://127.0.0.1:8000/api/v1`.

### Studio authentication

1. Start API with **PostgreSQL** (SQLite works for read-only; auth requires `users` and `api_keys` tables).
2. Run migrations: `alembic upgrade head`
3. Open http://localhost:3000/login — sign in with API key or email/password.
4. Or paste a JWT/API key manually at `/settings`.

**Creating credentials for local development:**

On first startup in `development` or `test` with an empty database, the API seeds a default curator when `FG_SEED_DEV_USERS=true` (default):

| Field | Default |
|-------|---------|
| Email | `curator@farmacograph.local` |
| Password | `curator-dev-password` |
| Scopes | `curator:write`, `curator:publish`, read scopes |

Override via `FG_SEED_CURATOR_EMAIL` and `FG_SEED_CURATOR_PASSWORD`. Seeding is skipped if any user already exists.

For API keys, insert into `api_keys` using `farmacograph.auth.models.generate_api_key` or use test helpers in `tests/auth/helpers.py`.

**Token grant examples:**

```bash
# Password grant (after dev seed)
curl -s -X POST http://127.0.0.1:8000/api/v1/auth/token \
  -H 'Content-Type: application/json' \
  -d '{"grant_type":"password","username":"curator@farmacograph.local","password":"curator-dev-password"}' | jq

# API key grant (after creating a key in PostgreSQL)
curl -s -X POST http://127.0.0.1:8000/api/v1/auth/token \
  -H 'Content-Type: application/json' \
  -d '{"grant_type":"api_key","api_key":"fg_xxxxxxxx_yyyyyyyy"}' | jq
```

**Studio route guards:** `/knowledge/*` and `/validation` require `curator:write`. Use a token with curator scopes or sign in via `/login`.

Studio scripts:

| Command | Purpose |
|---------|---------|
| `npm run dev` | Development server (port 3000) |
| `npm run build` | Production build |
| `npm run lint` | ESLint |
| `npm run typecheck` | TypeScript check |
| `npx vitest` | Unit tests |
| `npx playwright test` | E2E tests |

---

## Environment variables

From `.env.example` and `farmacograph/core/config.py` (`FG_` prefix):

| Variable | Default | Description |
|----------|---------|-------------|
| `FG_ENVIRONMENT` | `development` | `development`, `staging`, `production`, `test` |
| `FG_DATABASE_URL` | SQLite file | Async SQLAlchemy URL |
| `FG_NEO4J_ENABLED` | `false` | Enable Neo4j knowledge graph |
| `FG_NEO4J_URI` | `bolt://localhost:7687` | Neo4j bolt URI |
| `FG_NEO4J_PASSWORD` | `password` | Neo4j password |
| `FG_JWT_SECRET_KEY` | (change me) | JWT signing secret — required non-default in production |
| `FG_ALLOW_ANONYMOUS_READ` | `true` (forced `false` in production) | Allow unauthenticated read/search/explain |
| `FG_SEED_DEV_USERS` | `true` | Seed default curator on empty DB (development/test) |
| `FG_SEED_CURATOR_EMAIL` | `curator@farmacograph.local` | Dev seed email |
| `FG_SEED_CURATOR_PASSWORD` | `curator-dev-password` | Dev seed password |
| `FG_LOG_LEVEL` | `INFO` | Log level |
| `FG_LOG_JSON` | `false` | Structured JSON logging |
| `FG_METRICS_ENABLED` | `true` | Prometheus `/metrics` endpoint |

Docker host ports: `FG_HOST_PG_PORT`, `FG_HOST_NEO4J_HTTP_PORT`, `FG_HOST_NEO4J_BOLT_PORT`, `FG_HOST_API_PORT`, `FG_HOST_STUDIO_PORT`.

---

## Running tests

### Python (API)

```bash
./scripts/dev.sh test
# or with coverage:
FG_ENVIRONMENT=test FG_DATABASE_URL=sqlite+aiosqlite:///:memory: \
  FG_NEO4J_ENABLED=false pytest --cov=farmacograph
```

Test layout:

| Directory | Focus |
|-----------|-------|
| `tests/api/` | HTTP endpoints, search page |
| `tests/auth/` | Token issuance, API key validation, scope gates |
| `tests/curator/` | Workflow API, publish validation |
| `tests/integration/` | Health, drugs, modules, jobs, events |
| `tests/validation/` | Ontology and education validators |
| `tests/ontology/` | Registry loading |

CI runs on push/PR to `main` and `develop`: ruff lint, OpenAPI/ontology validation, pytest with 60% coverage floor.

### Studio (with auth)

```bash
cd apps/studio
npm run typecheck
npx vitest run
npx playwright test   # requires API + Studio running
```

Auth unit tests: `apps/studio/src/lib/auth/__tests__/`

---

## CLI

The `farmacograph` CLI is installed with the package:

```bash
farmacograph --help
```

Useful for ontology validation and package checks. Curator-facing workflows should use Curation Studio or the curator API — not `scripts/dev-only/` bootstrap scripts.

---

## Architecture rules (enforced in code)

1. **API → Service → Repository → Database** — handlers never query Neo4j or PostgreSQL directly.
2. **No biomedical data in PostgreSQL** — knowledge lives in Neo4j; ops metadata in PostgreSQL.
3. **OpenAPI is the contract** — implemented routes should eventually sync with `openapi/openapi.yaml`.
4. **Validators before publish** — curator publish runs multi-layer validation (ontology, biomedical, education).

See [architecture.md](architecture.md) and [phase3-infrastructure.md](phase3-infrastructure.md).

---

## Common tasks

### Publish a structural stub (development)

See [phase4-curator.md](phase4-curator.md) for the curator workflow curl examples. Requires `curator:write` and `curator:publish` scopes (JWT in development).

### Enable Neo4j search

1. `docker compose up -d neo4j`
2. Set `FG_NEO4J_ENABLED=true` in `.env`
3. Publish data via curator workflow
4. Test: `curl 'http://127.0.0.1:8000/api/v1/search?q=...'`

### Lint and format (Python)

```bash
ruff check farmacograph tests
ruff format farmacograph tests  # if configured
```

---

## Deployment

| Document | Scope |
|----------|-------|
| [deploy-nginx.md](deploy-nginx.md) | Reverse proxy configuration |
| [deploy-studio.md](deploy-studio.md) | Studio production build |
| [getting-started.md](getting-started.md) | Public API access |

---

## Related documents

| Document | Focus |
|----------|-------|
| [repository-structure.md](repository-structure.md) | Directory map |
| [api.md](api.md) | REST API reference |
| [CONTRIBUTING.md](../CONTRIBUTING.md) | Contribution workflow |
| [test-strategy.md](test-strategy.md) | Testing philosophy |
