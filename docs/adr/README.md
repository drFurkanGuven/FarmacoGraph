# Architecture Decision Records (ADR) Index

> FarmacoGraph records architectural decisions in specification documents rather than standalone ADR files. This index is the canonical entry point.

## Status

| Range | Topic | Location | Status |
|-------|-------|----------|--------|
| ADR-001 – ADR-009 | Knowledge model & ontology | [Roadmap decision log](../roadmap.md#6-decision-log) | Accepted |
| ADR-010 – ADR-016 | Platform infrastructure | [Platform architecture](../platform-architecture.md#architecture-decision-log) | Accepted |
| ADR-020 – ADR-024 | Curation Studio | [Studio roadmap](../studio-roadmap.md#architecture-decisions) | Accepted |
| ADR-025 | Authentication (JWT + API key) | [platform-architecture.md](../platform-architecture.md) (§2 Multi-Tenant) | Accepted |

No per-decision markdown files exist yet. When a decision needs extended rationale or alternatives analysis, add `docs/adr/ADR-0XX-short-title.md` and link it from this index.

---

## ADR-001 – ADR-009: Knowledge Architecture

| ID | Decision | Rationale | Source |
|----|----------|-----------|--------|
| ADR-001 | Neo4j canonical from Day One | Graph traversal is core value | [roadmap.md](../roadmap.md) |
| ADR-002 | Normalized entities, no Drug blob | Single source of truth | [roadmap.md](../roadmap.md) |
| ADR-003 | Mechanism DAGs | Branching/merging pharmacology | [roadmap.md](../roadmap.md) |
| ADR-004 | Evidence as first-class entity | Explainability and AI safety | [roadmap.md](../roadmap.md) |
| ADR-005 | Education layer separation | Prevent mnemonic/fact confusion | [roadmap.md](../roadmap.md) |
| ADR-006 | Open terminology first | SNOMED/MedDRA as plugins | [roadmap.md](../roadmap.md) |
| ADR-007 | Module-based rollout | Quality over quantity | [roadmap.md](../roadmap.md) |
| ADR-008 | Apache 2.0 + CC BY 4.0 | Open platform, attribution datasets | [roadmap.md](../roadmap.md) |
| ADR-009 | Hybrid Neo4j + PostgreSQL | Knowledge vs operations split | [architecture.md](../architecture.md#3-hybrid-database-architecture) |

---

## ADR-010 – ADR-016: Platform Infrastructure

| ID | Decision | Rationale | Implemented |
|----|----------|-----------|-------------|
| ADR-010 | API is the only public interface | Platform, not database | Yes — all clients via REST |
| ADR-011 | Tenant context in PostgreSQL only | Shared open knowledge graph | Yes — `Organization`, `Workspace` models |
| ADR-012 | Transactional outbox for events | Reliable delivery without Neo4j triggers | Yes — `OutboxRepository` |
| ADR-013 | Search as separate index | Graph traversal ≠ full-text discovery | Partial — `GraphSearchProvider` when Neo4j enabled |
| ADR-014 | Immutable snapshots | Reproducible releases | Yes — `KnowledgeSnapshot` model |
| ADR-015 | Plugin system for all externals | No tight coupling | Spec only — `architecture/plugin-interfaces.json` |
| ADR-016 | Observability from Phase 3 | Not retrofitted | Yes — structlog, Prometheus `/metrics` |

Full context: [platform-architecture.md](../platform-architecture.md#architecture-decision-log).

---

## ADR-020 – ADR-024: Curation Studio

| ID | Decision | Rationale | Implemented |
|----|----------|-----------|-------------|
| ADR-020 | Studio is the only curator UI | JSON/scripts are bootstrap only | Yes — drug browser, editor, validation center live |
| ADR-021 | Studio never touches databases | API-first consistency | Yes — `FarmacoGraphClient` only |
| ADR-022 | AI drafts, humans publish | Clinical accountability | Yes — draft editing and Drug/Disease publish wizard live |
| ADR-023 | Separate education editor | Layer separation in UI | Partial — Drug Editor education MVP live; global education manager deferred |
| ADR-024 | Next.js App Router + React Query | Typed client, server-state caching | Yes — `apps/studio` |

Full context: [studio-roadmap.md](../studio-roadmap.md#architecture-decisions).

---

## ADR-025: Authentication

| ID | Decision | Rationale | Implemented |
|----|----------|-----------|-------------|
| ADR-025 | Dual auth: JWT sessions + API keys | Studio login for humans; API keys for integrations | Yes — `POST /auth/token`, `/auth/refresh`, `/auth/introspect` |

| Sub-decision | Choice |
|--------------|--------|
| Token format | HS256 JWT with `sub`, `exp`, `scopes[]`, `type` (`access` / `refresh`) |
| API key storage | Prefix + SHA-256 hash in PostgreSQL; never store plaintext |
| Anonymous read | Configurable; disabled automatically in production |
| Curator gates | `curator:write` / `curator:publish` require authenticated context |

Full context: [platform-architecture.md](../platform-architecture.md), [api.md](../api.md#auth-current).

---

## How to propose a new ADR

1. Open a GitHub issue or PR describing context, decision, and consequences.
2. Add a row to the appropriate table above (or create `docs/adr/ADR-0XX-title.md` for complex decisions).
3. Update the relevant specification document (`architecture.md`, `platform-architecture.md`, or `studio-roadmap.md`).
4. Reference the ADR ID in code comments only when the decision affects non-obvious implementation choices.

---

## Related documents

| Document | Decisions covered |
|----------|-------------------|
| [architecture.md](../architecture.md) | Knowledge model, layers, hybrid storage |
| [platform-architecture.md](../platform-architecture.md) | API-first, events, jobs, search, snapshots |
| [api-first.md](../api-first.md) | Client access rules |
| [curation-studio.md](../curation-studio.md) | Studio product principles |
| [roadmap.md](../roadmap.md) | Phase timeline and knowledge ADRs |
