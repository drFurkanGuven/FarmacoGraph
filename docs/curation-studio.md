# FarmacoGraph Curation Studio

> **Canonical specification** for the primary knowledge authoring product.  
> **Status:** Phase 4.2.1 — Functional dashboard (live API)

The Curation Studio is the **only official interface** for creating, editing, reviewing, validating, and publishing biomedical knowledge. JSON files and shell scripts are legacy bootstrap tooling (`scripts/dev-only/`).

## Principles

1. **Curators edit knowledge, not data models** — the platform generates JSON, graph payloads, and snapshots.
2. **API-only** — Studio never accesses Neo4j or PostgreSQL directly.
3. **AI drafts, humans publish** — AI assists; curator attestation required.
4. **Educational layer ≠ biomedical truth** — separate editors and validation.

## Design references

Stripe Dashboard · Linear · GitHub · Supabase Studio · Notion · Obsidian

## Technology

| Layer | Stack |
|-------|--------|
| Frontend | Next.js, React, TypeScript, TailwindCSS, shadcn/ui |
| Data | React Query, React Hook Form, Zod |
| Graphs (later) | React Flow, Cytoscape.js |
| Motion | Framer Motion (subtle only) |
| Backend | Existing FastAPI — public API only |

## Phase map

See [studio-roadmap.md](studio-roadmap.md) for detailed milestones, API wiring status, and exit criteria.

### Phase 4 Backend Foundation ✅

Docker, curator workflow API, validation, graph writer, snapshots — see `docs/phase4-curator.md`.

> **Status:** Phase 4.2.1 — Functional dashboard

### Phase 4.2 — Feature-driven (in progress)

| Milestone | Status | Notes |
|-----------|--------|-------|
| **4.2.1** Dashboard | ✅ | `GET /api/v1/dashboard`, audit-logs, jobs, auto-refresh 15s |
| **4.2.2** Drug List | **Next** | Paginated `GET /drugs`, module filter, workflow status badges |
| **4.2.3** Drug Editor | Planned | **Obsidian-style** — center editor + live right context panel |
| **4.2.4–4.2.9** | Planned | See implementation order in product spec |

### Phase 4 Studio (shell)

| Milestone | Deliverables |
|-----------|--------------|
| **4.1** ✅ | App shell, nav, dark mode, command palette, auth, API client |
| **4.2** | Drug list (4.2.2), editors (4.2.3+) — **in progress** |
| **4.3** | Mechanism Editor, Graph Explorer, Validation Center |
| **4.4** | AI Draft Assistant, Diff, Snapshots, Publish Wizard |
| **4.5** | Performance, a11y, testing |

## Application modules (roadmap)

- Dashboard — live API metrics
- Drug Editor — **Obsidian-style** three-pane layout:
  - **Center:** structured field editor (autosave per section, inline validation)
  - **Right context panel (live):** related mechanisms, linked diseases, evidence count, recent changes, publish preview, validation summary, graph position
  - Curator sees the drug’s place in the knowledge graph while editing — critical at scale
- Relationship Editor — visual, ontology-constrained
- Mechanism Editor — React Flow DAG
- Graph Explorer — Cytoscape.js
- Evidence Manager — citations, DOI, confidence
- Educational Layer Editor — summaries, pearls, flashcards
- AI Draft Assistant — drafts only, never auto-publish
- Validation Center — grouped errors + fixes
- Diff Viewer — draft vs published
- Snapshot Manager — release preview
- Publish Wizard — validation + approvals + snapshot
- Search — global, synonym-ready
- Activity Timeline — audit events
- Users — roles, future SSO

## Phase 4.1 success criteria

- [x] Open Studio, navigate all sections
- [x] Authenticate via `/login` or Settings (JWT/API key)
- [x] Dashboard from public API
- [x] Review queue visible
- [x] Module progress visible
- [x] Placeholder pages for future editors
- [x] Polished shell (dark mode, ⌘K, responsive)

## Running locally

```bash
# Terminal 1 — API
./scripts/dev.sh api

# Terminal 2 — Studio
cd apps/studio
cp .env.example .env.local
npm install
npm run dev
```

Open http://localhost:3000

## API client

`src/lib/api/client.ts` — typed FarmacoGraph client with auth headers, retries, error normalization, dataset version metadata.

## Legacy (do not use for curation)

| Path | Role |
|------|------|
| `staging/` | Dev fixtures only |
| `scripts/dev-only/` | Bootstrap & emergency scripts |
| `farmacograph/cli` `init-drug-entry` | Deprecated for curators |

## Extensibility

Modular pages, plugin-ready architecture for collectors, LLMs, validators, exporters (future).

---

*FarmacoGraph — the API is the product. The Studio is how experts build it.*
