# Phase 3 Infrastructure

> Implementation status for platform infrastructure (no biomedical data).

## Completed

| Phase | Component | Location |
|-------|-----------|----------|
| 3.1 | PostgreSQL operational schema | `farmacograph/db/postgres/models.py` |
| 3.1 | Alembic migrations | `alembic/` |
| 3.2 | Neo4j init + driver | `farmacograph/db/neo4j/` |
| 3.3 | DI container + repositories | `farmacograph/core/container.py`, `repositories/` |
| 3.3 | Service layer | `farmacograph/services/` |
| 3.4 | FastAPI app + routers | `farmacograph/api/` |
| 3.5 | JWT + API key utilities | `farmacograph/auth/` |
| 3.6 | Event bus + outbox | `farmacograph/events/` |
| 3.6 | Job queue + worker abstraction | `farmacograph/workers/`, `repositories/jobs.py` |
| 3.7 | Search provider interface | `farmacograph/services/search.py` |
| 3.8 | Explain/Compare/Learning/Reasoning contracts | `farmacograph/services/` |
| 3.9 | Structured logging + Prometheus metrics | `farmacograph/core/logging.py`, `metrics.py` |
| 3.10 | CI/CD pipeline | `.github/workflows/ci.yml` |
| 3.10 | Docker image | `Dockerfile` |

## Run locally

```bash
pip install -e ".[api,db,auth,observability,dev]"
cp .env.example .env
uvicorn farmacograph.api.main:app --reload
# API docs: http://localhost:8000/docs
# Health:   http://localhost:8000/api/v1/health
# Metrics:  http://localhost:8000/metrics
```

## Run tests

```bash
FG_ENVIRONMENT=test FG_DATABASE_URL=sqlite+aiosqlite:///:memory: pytest
```

## Architecture rules enforced

1. API controllers → services → repositories → databases
2. No biomedical data in PostgreSQL
3. Neo4j disabled by default (`FG_NEO4J_ENABLED=false`)
4. Empty drug list until Cardiovascular module curation begins
