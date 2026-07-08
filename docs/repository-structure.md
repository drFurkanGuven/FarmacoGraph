# Repository Structure

> Map of the FarmacoGraph monorepo as implemented.

```
FarmacoGraph/
├── farmacograph/          # Python application package
├── apps/studio/           # Next.js Curation Studio
├── ontology/              # Ontology definitions (JSON)
├── architecture/          # Platform specs (events, plugins, snapshots)
├── openapi/               # OpenAPI contract
├── docs/                  # Documentation
├── tests/                 # pytest suite
├── scripts/               # Dev and deploy scripts
├── staging/               # Dev fixtures (not for production curation)
├── deploy/                # Nginx and deployment configs
├── alembic/               # Database migrations
├── configs/               # Additional configuration
└── .github/workflows/     # CI pipelines
```

---

## `farmacograph/` — Python backend

| Path | Purpose |
|------|---------|
| `api/` | FastAPI application, routers, middleware, static assets |
| `api/routers/` | Route handlers (`health`, `drugs`, `curator`, `dashboard`, …) |
| `api/schemas/` | Pydantic request/response models |
| `services/` | Business logic layer |
| `repositories/` | Data access (Neo4j graph, PostgreSQL ops) |
| `db/postgres/` | SQLAlchemy models, session factory |
| `db/neo4j/` | Neo4j driver and init scripts |
| `curator/` | Workflow state machine, publish validator, drug packages |
| `validators/` | Ontology, biomedical, education, schema validators |
| `ontology/` | Runtime ontology registry |
| `auth/` | JWT, API key utilities, scope definitions |
| `events/` | Event bus and transactional outbox |
| `workers/` | Background job workers (graph validation) |
| `search/` | Search provider implementations |
| `models/` | Domain Pydantic models |
| `graph/` | Mechanism DAG engine |
| `cli/` | `farmacograph` command-line tools |
| `core/` | Config, DI container, logging, metrics |

**Dependency flow:** `api/routers` → `services/` → `repositories/` → `db/`

---

## `apps/studio/` — Curation Studio

| Path | Purpose |
|------|---------|
| `src/app/` | Next.js App Router pages (13 routes) |
| `src/components/` | UI components (layout, dashboard, badges) |
| `src/components/ui/` | shadcn/ui primitives |
| `src/lib/api/` | Typed `FarmacoGraphClient` and types |
| `src/lib/hooks/` | React Query hooks |
| `src/lib/auth/` | Session context and storage |
| `src/providers/` | Theme, Query, Auth, Notification providers |
| `e2e/` | Playwright end-to-end tests |
| `public/` | Static assets |

Studio has no backend routes — all data flows through the FarmacoGraph REST API.

---

## `ontology/` — Knowledge schema

| File | Purpose |
|------|---------|
| `relationships.json` | Relationship type semantics |
| `constraints.json` | Graph validation rules (FG-C001–C030) |
| `*.ttl` / `*.owl` | OWL ontology (if present) |

Consumed by validators, curator publish pipeline, and documentation.

---

## `architecture/` — Platform specifications

| File | Purpose |
|------|---------|
| `events.json` | Domain event catalog |
| `plugin-interfaces.json` | Plugin type registry |
| `snapshots.schema.json` | Immutable release manifest schema |

These are specification artifacts, not runtime code.

---

## `openapi/`

| File | Purpose |
|------|---------|
| `openapi.yaml` | REST API contract (implemented + planned endpoints) |

FastAPI generates live docs at `/docs`; this file is the source of truth for client generation.

---

## `tests/`

| Path | Coverage |
|------|----------|
| `api/` | HTTP endpoint tests |
| `curator/` | Workflow API, publish validation, curriculum |
| `integration/` | Cross-component infrastructure tests |
| `validation/` | Validator rule tests |
| `ontology/` | Registry tests |
| `conftest.py` | Shared fixtures |

---

## `scripts/`

| Path | Purpose |
|------|---------|
| `dev.sh` | Local dev commands (`install`, `api`, `test`, `up`) |
| `find-ports.sh` | Docker port conflict resolution |
| `dev-only/` | **Deprecated** bootstrap scripts — not for curators |
| `lib/` | Shared shell utilities |

---

## `staging/`

Development fixtures and prompts. **Not** the canonical curation path — use Curation Studio or the curator API.

```
staging/
└── cardiovascular/
    ├── drugs/           # Sample drug packages
    ├── shared/          # Shared entities
    └── prompts/         # Curator AI prompts
```

---

## `deploy/`

| Path | Purpose |
|------|---------|
| `nginx/farmacograph.conf` | Reverse proxy (API, Studio, static search) |

---

## `docs/`

| Path | Purpose |
|------|---------|
| `architecture.md` | Biomedical knowledge architecture |
| `platform-architecture.md` | API-first platform design |
| `api.md` | API reference |
| `development.md` | Local setup guide |
| `roadmap.md` | Implementation phases |
| `studio-roadmap.md` | Curation Studio milestones |
| `curation-studio.md` | Studio product spec |
| `adr/` | Architecture decision index |
| `product/` | Long-term product roadmap, personas, SDK strategy |

---

## Root files

| File | Purpose |
|------|---------|
| `pyproject.toml` | Python package definition, ruff, pytest, mypy |
| `docker-compose.yml` | Local stack (postgres, neo4j, api, studio) |
| `Dockerfile` | API container image |
| `.env.example` | Environment variable template |
| `alembic.ini` | Migration configuration |
| `README.md` | Project overview |

---

## What is not in this repository

| Item | Status |
|------|--------|
| Production biomedical dataset | Cardiovascular module in curation |
| Meilisearch / FTS worker | Planned — search uses Neo4j provider when enabled |
| Background worker daemon | Jobs enqueued synchronously on publish |
| User login API | JWT helpers exist; no `POST /auth/token` yet |
| Python/TypeScript SDK | Planned — see [api-roadmap.md](api-roadmap.md) |

---

## Related documents

| Document | Focus |
|----------|-------|
| [development.md](development.md) | How to run locally |
| [architecture-diagrams.md](architecture-diagrams.md) | Runtime architecture |
| [phase3-infrastructure.md](phase3-infrastructure.md) | Platform implementation status |
