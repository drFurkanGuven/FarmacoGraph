# FarmacoGraph Curation Studio

> **Canonical specification** for the primary knowledge authoring product.  
> **Status:** Phase 4.1 — Application foundation

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

### Phase 4 Backend Foundation ✅

Docker, curator workflow API, validation, graph writer, snapshots — see `docs/phase4-curator.md`.

### Phase 4 Studio

| Milestone | Deliverables |
|-----------|--------------|
| **4.1** ✅ (current) | App shell, nav, dark mode, command palette, auth hooks, API client, dashboard, placeholders |
| **4.2** | Drug Editor, Evidence Editor, Relationship Editor |
| **4.3** | Mechanism Editor, Graph Explorer, Validation Center |
| **4.4** | AI Draft Assistant, Diff Viewer, Snapshot Manager, Publish Wizard |
| **4.5** | Performance, accessibility, testing, documentation |

## Application modules (roadmap)

- Dashboard — live API metrics
- Drug Editor — Notion-style sections with autosave
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
- [x] Authenticate via JWT/API key hooks (Settings)
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
