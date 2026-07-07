# Phase 4 — Curator Workflow & Dev Environment

> Infrastructure for knowledge curation. No real pharmacology data.

## Phase 4.1 — Docker Compose

```bash
docker compose up -d postgres neo4j
```

| Service | URL | Credentials |
|---------|-----|-------------|
| PostgreSQL | localhost:5432 | farmacograph / farmacograph |
| Neo4j Browser | http://localhost:7474 | neo4j / farmacograph |
| Neo4j Bolt | bolt://localhost:7687 | neo4j / farmacograph |

Update `.env` for Docker:

```env
FG_DATABASE_URL=postgresql+asyncpg://farmacograph:farmacograph@localhost:5432/farmacograph
FG_NEO4J_ENABLED=true
FG_NEO4J_URI=bolt://localhost:7687
FG_NEO4J_PASSWORD=farmacograph
```

## Phase 4.2 — Curator Workflow API

State machine (FG-C023 enforced):

```
draft → review → approved → published → deprecated
         ↑__________|
```

| Method | Endpoint | Action |
|--------|----------|--------|
| POST | `/api/v1/curator/workflows` | Create draft |
| GET | `/api/v1/curator/workflows/{id}` | Get workflow |
| GET | `/api/v1/curator/queue?state=review` | Review queue |
| POST | `/api/v1/curator/workflows/{id}/submit` | draft → review |
| POST | `/api/v1/curator/workflows/{id}/approve` | review → approved |
| POST | `/api/v1/curator/workflows/{id}/publish` | approved → published |

Publish triggers:
- Neo4j MERGE (when `FG_NEO4J_ENABLED=true`)
- Outbox event (`DrugPublished` or `KnowledgeValidated`)
- Background job (`graph_validation`)
- Audit log entry

### Example (structural stub only)

```bash
# 1. Create draft
curl -X POST http://127.0.0.1:8000/api/v1/curator/workflows \
  -H "Content-Type: application/json" \
  -d '{"entity_id":"00000000-0000-4000-8000-000000000099","entity_type":"Drug","notes":"test stub"}'

# 2. Submit → Approve → Publish (use workflow id from step 1)
curl -X POST http://127.0.0.1:8000/api/v1/curator/workflows/{id}/submit
curl -X POST http://127.0.0.1:8000/api/v1/curator/workflows/{id}/approve
curl -X POST http://127.0.0.1:8000/api/v1/curator/workflows/{id}/publish \
  -H "Content-Type: application/json" \
  -d '{"entity_payload":{"id":"00000000-0000-4000-8000-000000000099","entity_type":"Drug","slug":"test-stub","label":"Test Stub","generic_name":"Test Stub"},"dataset_version":"2026.1.0"}'
```

## Phase 4.3 — Graph Writer

`GraphWriter` (`repositories/graph_writer.py`) performs Neo4j MERGE operations:
- `merge_entity(label, properties)` — upsert biomedical node
- `merge_relationship(type, source, target, ...)` — upsert edge

Only called from `CuratorService.publish()` — never from API controllers directly.

## Dev Scripts

```bash
./scripts/dev.sh install   # python3 -m pip install
./scripts/dev.sh up        # Docker: postgres + neo4j
./scripts/dev.sh api       # Start API
./scripts/dev.sh test      # Run pytest
./scripts/dev.sh health    # Health check
```

## Next: Phase 4.4 — Cardiovascular Module Curation

First real drug entries require:
1. Neo4j running (`FG_NEO4J_ENABLED=true`)
2. Curator workflow per drug
3. Validated entity payloads through 4-level validators
4. Mechanism DAG fragments
5. First snapshot `2026.1.0`
