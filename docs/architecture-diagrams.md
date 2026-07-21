# Runtime Architecture Diagrams

> Implementation-focused diagrams complementing the design documents in [architecture.md](architecture.md) and [platform-architecture.md](platform-architecture.md).

---

## 1. Deployment topology

Current Docker Compose stack and production layout.

```mermaid
flowchart TB
    subgraph client [Clients]
        Browser[Browser]
        SDK[Future SDKs]
        CLI[CLI / curl]
    end

    subgraph edge [Edge — production]
        Nginx[Nginx reverse proxy]
    end

    subgraph compose [Docker Compose / local]
        Studio[Curation Studio<br/>Next.js :3000]
        API[FastAPI API<br/>:8000]
        PG[(PostgreSQL<br/>ops metadata)]
        Neo[(Neo4j<br/>knowledge graph)]
    end

    Browser --> Nginx
    SDK --> Nginx
    CLI --> Nginx

    Nginx -->|/api/v1/*| API
    Nginx -->|/studio/*| Studio
    Nginx -->|/search| API
    Nginx -->|/docs| API

    Studio -->|REST only| API
    API --> PG
    API --> Neo
```

| Service | Image / build | Default port |
|---------|---------------|--------------|
| `postgres` | postgres:16-alpine | 5433 |
| `neo4j` | neo4j:5-community | 7474 / 7687 |
| `api` | `Dockerfile` | 8001 |
| `studio` | `apps/studio/Dockerfile` | 3001 |

---

## 2. Request flow (API layer)

All HTTP traffic follows the layered architecture enforced in code.

```mermaid
sequenceDiagram
    participant C as Client
    participant M as Middleware
    participant R as Router
    participant S as Service
    participant Repo as Repository
    participant DB as PostgreSQL / Neo4j

    C->>M: HTTP request
    M->>M: Correlation ID, metrics
    M->>R: Route match
    R->>R: Auth + scope check
    R->>S: Business call
    S->>Repo: Data access
    Repo->>DB: Query
    DB-->>Repo: Result
    Repo-->>S: Domain objects
    S-->>R: Response DTO
    R-->>C: JSON envelope
```

**Rule:** Routers in `farmacograph/api/routers/` never import database drivers directly.

---

## 3. Curator publish pipeline

End-to-end flow when a workflow is published via `POST /api/v1/curator/workflows/{id}/publish`.

```mermaid
flowchart LR
    subgraph api [API]
        Pub[Publish endpoint]
    end

    subgraph validate [Validation]
        PV[Publish validator]
        OV[Ontology validator]
        BV[Biomedical validator]
        EV[Education validator]
    end

    subgraph write [Persistence]
        GW[GraphWriter]
        Neo[(Neo4j)]
        CR[CuratorRepository]
        PG[(PostgreSQL)]
    end

    subgraph async [Post-publish]
        OB[Outbox event]
        Job[graph_validation job]
        Snap[Optional snapshot]
        Audit[Audit log]
    end

    Pub --> PV
    PV --> OV & BV & EV
    PV -->|pass| GW
    GW --> Neo
    Pub --> CR
    CR --> PG
    Pub --> OB
    Pub --> Job
    Pub --> Audit
    Pub -->|create_snapshot=true| Snap
    Snap --> PG
```

State machine: `draft → review → approved → published → deprecated`

---

## 4. Curation Studio data flow

Studio is a pure API client — no server-side data access.

```mermaid
flowchart LR
    subgraph studio [apps/studio]
        Pages[App Router pages]
        RQ[React Query]
        Client[FarmacoGraphClient]
        Auth[Auth context]
    end

    subgraph api [FarmacoGraph API]
        Dash[/dashboard]
        Health[/health]
        Search[/search]
        Curator[/curator/*]
    end

    Pages --> RQ
    RQ --> Client
    Auth --> Client
    Client -->|Bearer / X-API-Key| Dash & Health & Search & Curator
```

Phase 4.1 wired endpoints: `/health`, `/info`, `/statistics`, `/modules/{slug}/curriculum`, `/curator/queue`, `/drugs`, `/search`, `/dashboard`.

Current Studio UI: drug and disease browsers/editors, validation center, Evidence Manager, publish wizard, snapshots, graph/mechanism previews, and administrator user management are live. Full mechanism pathway authoring, snapshot diff, and AI drafting remain planned.

---

## 4.1 Studio authentication flow

```mermaid
flowchart LR
    subgraph studio [apps/studio]
        Login[/login]
        MW[middleware.ts]
        Gate[AuthGate]
        Client[FarmacoGraphClient]
    end

    subgraph api [API]
        Token[POST /auth/token]
        Refresh[POST /auth/refresh]
        Protected[Protected routes]
    end

    Login --> Token
    Token --> Client
    MW -->|cookie check| Login
    Gate -->|scope check| Protected
    Client -->|Bearer JWT| Protected
    Client -->|401| Refresh
```

---

## 5. Event and job infrastructure

```mermaid
flowchart TB
    subgraph sync [Synchronous publish]
        API[Curator publish]
        Bus[In-process EventBus]
        Outbox[(OutboxEvent table)]
        Jobs[(Job table)]
    end

    subgraph worker [Worker — no daemon yet]
        GVW[GraphValidationWorker]
    end

    API --> Bus
    API --> Outbox
    API -->|enqueue| Jobs
    Jobs -->|fetch_pending| GVW
    GVW -->|mark completed/failed| Jobs
```

Jobs are enqueued synchronously on publish. A background worker daemon is planned.

---

## 6. Search provider selection

```mermaid
flowchart TD
    Req[GET /search?q=...] --> Svc[SearchService]
    Svc --> Check{FG_NEO4J_ENABLED?}
    Check -->|yes| Graph[GraphSearchProvider]
    Check -->|no| Null[NullSearchProvider]
    Graph --> Neo[(Neo4j drug index)]
    Null --> Empty[Empty results]
```

Full-text search (Meilisearch/FTS plugin) is planned — see [api-roadmap.md](api-roadmap.md).

---

## 7. Authentication model

```mermaid
flowchart TD
    subgraph token [Token issuance]
        T1[POST /auth/token]
        T2[POST /auth/refresh]
    end

    subgraph request [Per-request]
        Req[Incoming request] --> MW[AuthContextMiddleware]
        MW --> Auth{Authorization header?}
        Auth -->|Bearer JWT| Decode[decode_access_token]
        Auth -->|Bearer fg_*| KeyLookup[api_keys table lookup]
        Auth -->|X-API-Key| KeyLookup
        Auth -->|none| Anon{scope in ANONYMOUS_READ?}
        Decode --> Scopes[require_scope]
        KeyLookup --> Scopes
        Anon -->|yes + allow_anonymous| Handler[Route handler]
        Anon -->|no or production| Deny401[401 Authentication required]
        Scopes -->|match| Handler
        Scopes -->|mismatch| Deny403[403 Missing scope]
    end

    T1 --> Decode
    T2 --> Decode
```

| Component | Path |
|-----------|------|
| Token routes | `farmacograph/api/routers/auth.py` |
| Auth service | `farmacograph/auth/service.py` |
| Request middleware | `farmacograph/auth/middleware.py` |
| Scope dependency | `farmacograph/api/deps.py` → `require_scope` |

**Live:** `POST /auth/token`, `POST /auth/refresh`, and `POST /auth/introspect`.

**Not yet implemented:** rate-limit middleware (Phase API 5.3), self-service API key CRUD.

---

## Related documents

| Document | Focus |
|----------|-------|
| [architecture.md](architecture.md) | Knowledge model, C4 context, hybrid DB |
| [platform-architecture.md](platform-architecture.md) | Events, jobs, search, snapshots, plugins |
| [repository-structure.md](repository-structure.md) | Code layout |
| [phase3-infrastructure.md](phase3-infrastructure.md) | Phase 3 completion status |
| [phase4-curator.md](phase4-curator.md) | Curator API details |
| [studio-roadmap.md](studio-roadmap.md) | Studio implementation phases |
