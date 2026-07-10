# FarmacoGraph

**Explainable Biomedical Knowledge Graph — the operating system for medical knowledge.**

FarmacoGraph is not a pharmacology database. It is a **long-term biomedical knowledge platform** — API-first, event-driven, plugin-extensible, and snapshot-versioned.

## Status

| Phase | Status |
|-------|--------|
| Phase 0 — Core Ontology & architecture specs | **Complete** |
| Phase 2 — Foundation (schemas, validators, API contract) | **Complete** |
| Platform Architecture Review | **Complete** |
| **Phase 3 — Infrastructure** | **Complete** |
| **Phase 4 Backend Foundation** (curator API, validation, graph writer) | **Complete** |
| **Phase 4 Studio 4.1** (Curation Studio shell + dashboard) | **Complete** |
| Phase API 5.1 (discovery, Neo4j search, search page) | **Complete** |
| **Phase API 5.2** (JWT issuance, API key validation, introspect) | **Complete** |
| **Phase 4 Studio 4.2** (drug browser, drug editor, validation center) | **Complete** — secure curation path live |
| **Phase 4 Studio 4.4** (publish wizard UI) | **Complete** — submit / approve / publish from Drug Editor |
| **Phase 4 Studio 5** (Evidence Manager + drug evidence workflow) | **Complete** — `/knowledge/evidence`, Drug Editor Evidence section, publish wizard evidence readiness |
| Phase 4 Studio 4.3 (mechanism + graph) | **MVP live** — mechanism picker + interactive React Flow graph/mechanism previews; full pathway authoring deferred |
| Cardiovascular module curation | In progress |

> **Primary product:** [Curation Studio](docs/curation-studio.md) (`apps/studio`) — the official knowledge authoring interface.  
> **Public docs (no source):** https://github.com/drFurkanGuven/FarmacoGraph-docs  
> **Evidence:** Curators manage citations in **Evidence Manager** (`/knowledge/evidence`) and attach them from the Drug Editor **Evidence** section. Validation and the Publish wizard surface evidence blockers (FG-C012).  
> Manual JSON editing and shell scripts in `scripts/dev-only/` are **dev-only / deprecated** for curators — see [scripts/dev-only/README.md](scripts/dev-only/README.md).

## Core Principle

**The API is the product. The database is an implementation detail.**

No client — including first-party apps — accesses Neo4j or PostgreSQL directly.

## API (live)

| | |
|---|---|
| **Docs (Swagger)** | https://farmacograph.furkanguven.space/docs |
| **Health** | https://farmacograph.furkanguven.space/api/v1/health |
| **Discovery** | `GET /api/v1/info` |
| **Auth** | `POST /api/v1/auth/token`, `POST /api/v1/auth/refresh`, `POST /api/v1/auth/introspect` |
| **Getting started** | [docs/getting-started.md](docs/getting-started.md) |
| **API reference** | [docs/api.md](docs/api.md) |
| **API roadmap** | [docs/api-roadmap.md](docs/api-roadmap.md) |
| **Search UI** | https://farmacograph.furkanguven.space/search |
| **Curation Studio** | https://farmacograph.furkanguven.space/studio/ |
| **Curation Studio** (local) | `cd apps/studio && npm run dev` → http://localhost:3000 |

Early access: read endpoints can be tried without an API key. Keys and institutional access → [getting-started guide](docs/getting-started.md).

## Quick Start

On macOS, `pip` and `uvicorn` may not be on PATH — use `python3 -m` or `./scripts/dev.sh`:

```bash
cp .env.example .env
chmod +x scripts/dev.sh

# Install dependencies
./scripts/dev.sh install

# Start API server
./scripts/dev.sh api
```

In another terminal:

```bash
./scripts/dev.sh health
# or: curl http://127.0.0.1:8000/api/v1/health
```

### Docker (Postgres + Neo4j + API + Studio)

```bash
docker compose up -d
# API:    http://localhost:8001/docs
# Studio: http://localhost:3001
# Neo4j:  http://localhost:7474 (neo4j / farmacograph)
```

Enable Neo4j in `.env`: `FG_NEO4J_ENABLED=true`

```bash
./scripts/dev.sh test
```

### Production bootstrap (Fedora `/opt/FarmacoGraph`)

```bash
cd /opt/FarmacoGraph
git pull
./scripts/migrate-schema.sh
./scripts/deploy-production.sh
./scripts/create-curator.sh --email curator@farmacograph.local
./scripts/install-nginx.sh
```

Then sign in at https://farmacograph.furkanguven.space/studio/login/

**Important:** Production does **not** seed curator users. A working Studio UI with failed login usually means `create-curator.sh` was not run — not that Studio is broken. Unauthenticated `/api/v1/dashboard` → **401** is expected.

After deploy, HTTP smoke: `./scripts/smoke-studio.sh` (see [Deploy (Studio)](docs/deploy-studio.md)).

Full guide: [Deploy (Studio)](docs/deploy-studio.md)

Full setup: [Development Guide](docs/development.md)

## Architecture

| Layer | Technology | Public? |
|-------|------------|---------|
| API Platform | REST (OpenAPI), GraphQL/MCP/SPARQL future | **Yes** |
| Curation Studio | Next.js 15 (`apps/studio`) | **Yes** |
| Knowledge Graph | Neo4j | No |
| Operations | PostgreSQL (tenants, jobs, audit, snapshots) | No |
| Search | Plugin-based index (Neo4j provider live; FTS planned) | Via API only |

Runtime diagrams: [docs/architecture-diagrams.md](docs/architecture-diagrams.md)

## Documentation

### Getting started

| Document | Description |
|----------|-------------|
| [Development Guide](docs/development.md) | Local setup, testing, environment |
| [Getting Started (API)](docs/getting-started.md) | Public API access and authentication |
| [Contributing](CONTRIBUTING.md) | How to contribute code and docs |
| [Repository Structure](docs/repository-structure.md) | Monorepo directory map |

### Architecture & design

| Document | Description |
|----------|-------------|
| [Platform Architecture](docs/platform-architecture.md) | API-first, events, jobs, search, plugins |
| [Architecture](docs/architecture.md) | Biomedical knowledge design |
| [Architecture Diagrams](docs/architecture-diagrams.md) | Runtime deployment and request flows |
| [API-First](docs/api-first.md) | API hard requirements |
| [ADR Index](docs/adr/README.md) | Architecture decision records |
| [Ontology](docs/ontology.md) | Entity types and relationships |
| [Validation Matrix](docs/validation-matrix.md) | FG-C001–C030 |
| [Graph Specification](docs/graph-specification.md) | Neo4j model |
| [OpenAPI Contract](openapi/openapi.yaml) | REST API specification |

### Product & roadmap

| Document | Description |
|----------|-------------|
| [Implementation Roadmap](docs/roadmap.md) | Phase status and module rollout |
| [Product Roadmap](docs/product/roadmap.md) | Long-term product milestones |
| [API Roadmap](docs/api-roadmap.md) | API phase plan |
| [Curation Studio](docs/curation-studio.md) | Primary product — knowledge authoring UI |
| [Studio Roadmap](docs/studio-roadmap.md) | Studio implementation milestones |

### Implementation guides

| Document | Description |
|----------|-------------|
| [Phase 3 Infrastructure](docs/phase3-infrastructure.md) | Platform implementation status |
| [Phase 4 Backend](docs/phase4-curator.md) | Curator workflow API |
| [API Reference](docs/api.md) | Endpoint specification + implementation status |
| [Deploy (Nginx)](docs/deploy-nginx.md) | Production reverse proxy |
| [Deploy (Studio)](docs/deploy-studio.md) | Studio production build |

## Platform Specifications

| File | Purpose |
|------|---------|
| `architecture/events.json` | Domain event catalog |
| `architecture/plugin-interfaces.json` | Plugin type registry |
| `architecture/snapshots.schema.json` | Immutable release manifests |
| `ontology/relationships.json` | Relationship semantics |
| `ontology/constraints.json` | Graph constraints |

## License

- Code: Apache 2.0
- Documentation: CC BY 4.0
