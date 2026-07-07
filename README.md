# FarmacoGraph

**Explainable Biomedical Knowledge Graph — the operating system for medical knowledge.**

FarmacoGraph is not a pharmacology database. It is a **long-term biomedical knowledge platform** — API-first, event-driven, plugin-extensible, and snapshot-versioned.

## Status

| Phase | Status |
|-------|--------|
| Phase 0 — Core Ontology | **Complete** |
| Phase 2 — Foundation (schemas, validators, API contract) | **Complete** |
| Platform Architecture Review | **Complete** |
| **Phase 3 — Infrastructure** | **Complete** |
| **Phase 4 — Curator & Dev Environment** | **Complete** |
| Phase 4.4 — Cardiovascular structural stub | **Complete** |
| **Phase 4.5 — CV curation tooling** | **Ready** |

## Core Principle

**The API is the product. The database is an implementation detail.**

No client — including first-party apps — accesses Neo4j or PostgreSQL directly.

## API (canlı)

| | |
|---|---|
| **Docs (Swagger)** | https://farmacograph.furkanguven.space/docs |
| **Health** | https://farmacograph.furkanguven.space/api/v1/health |
| **Erişim rehberi** | [docs/getting-started.md](docs/getting-started.md) |
| **API yol haritası** | [docs/api-roadmap.md](docs/api-roadmap.md) |
| **Discovery** | `GET /api/v1/info` |

Early access: okuma endpoint’leri API key olmadan denenebilir. Key ve kurumsal erişim → getting-started rehberi.

## Quick Start

macOS'ta `pip` ve `uvicorn` PATH'te olmayabilir. `python3 -m` kullanın:

```bash
cp .env.example .env
chmod +x scripts/dev.sh

# Bağımlılıkları kur
./scripts/dev.sh install

# API sunucusunu başlat
./scripts/dev.sh api
```

Başka terminalde:

```bash
./scripts/dev.sh health
# veya: curl http://127.0.0.1:8000/api/v1/health
```

### Docker ile Postgres + Neo4j

```bash
docker compose up -d postgres neo4j
# .env dosyasında FG_NEO4J_ENABLED=true yapın
./scripts/dev.sh api
```

- API docs: http://127.0.0.1:8000/docs
- Neo4j browser: http://localhost:7474 (neo4j / farmacograph)

```bash
./scripts/dev.sh test
```

## Architecture

| Layer | Technology | Public? |
|-------|------------|---------|
| API Platform | REST (OpenAPI), GraphQL/MCP/SPARQL future | **Yes** |
| Knowledge Graph | Neo4j | No |
| Operations | PostgreSQL (tenants, jobs, audit, snapshots) | No |
| Search | Plugin-based index (Meilisearch/FTS) | Via API only |

## Documentation

| Document | Description |
|----------|-------------|
| **[Platform Architecture](docs/platform-architecture.md)** | **API-first, events, jobs, search, plugins, SaaS** |
| [Architecture](docs/architecture.md) | Biomedical knowledge design |
| [API-First](docs/api-first.md) | API hard requirements |
| [Ontology](docs/ontology.md) | Entity types and relationships |
| [Validation Matrix](docs/validation-matrix.md) | FG-C001–C030 |
| [Graph Specification](docs/graph-specification.md) | Neo4j model |
| [OpenAPI Contract](openapi/openapi.yaml) | REST API specification |
| [Phase 3 Infrastructure](docs/phase3-infrastructure.md) | Platform implementation guide |
| [Product Roadmap](docs/product/roadmap.md) | Long-term product milestones |

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
