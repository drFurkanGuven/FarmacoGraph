# FarmacoGraph Curation Studio

> **Canonical specification** for the primary knowledge authoring product.  
> **Status:** Phase 4.2–4.4 and **Evidence workflow (5)** complete — dashboard, drug browser, drug editor (with Evidence section), validation center, publish wizard, Evidence Manager

The Curation Studio is the **only official interface** for creating, editing, reviewing, validating, and publishing biomedical knowledge.

**Publish workflow:** Curators use the **Publish wizard** in the Drug Editor (header button) for `submit` → `approve` → `publish`. Workflow state, validation readiness, activity timeline, and snapshot result are shown in the wizard and right sidebar.

Manual JSON files and shell scripts are **dev-only / deprecated** for curators (`scripts/dev-only/`, `staging/`).

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
| **4.2.2** Drug List | ✅ | `GET /curator/drugs`, row navigation to `/knowledge/drugs/{slug}` |
| **4.2.3** Drug Editor | ✅ | Obsidian layout; autosave via `PUT /curator/workflows/{id}/package` |
| **4.3** Validation Center | ✅ | `POST /curator/validate`, grouped issues, publish readiness panel |
| **4.4** Publish wizard | ✅ | Submit / approve / publish from Drug Editor; snapshot + graph write result |
| **4.2.4–4.2.9** | Mixed | Evidence manager live; mechanism/graph previews live; full DAG editor and AI draft planned |

### Evidence workflow (partial — Studio 4.2.4)

Evidence curation spans the global **Evidence manager** (`/knowledge/evidence`), Drug Editor **Evidence** section, **Provenance** attestation, validation dry-runs, and the Publish wizard **Evidence readiness** panel.

| Layer | Status | Notes |
|-------|--------|-------|
| Drug Editor **Evidence** section | ✅ Live | Attach/create citations via `DrugEvidenceSection` — calls `/evidence` and `/curator/drugs/{slug}/evidence` |
| Drug Editor **Provenance** section | ✅ Live | `curator_attestation` gate — autosave via `PUT .../package` |
| Validation Center **Missing evidence** group | ✅ Live | FG-C018 / FG-C028 and provenance keywords from `POST /curator/validate` |
| Publish wizard **Evidence readiness** | ✅ Live | Blockers, missing metadata, low-confidence buckets before submit/approve/publish |
| Backend evidence API | ✅ Partial | `GET/POST /evidence`, UUID drug evidence routes, curator slug evidence routes — writes require Neo4j |
| `/knowledge/evidence` Evidence Manager | ✅ Live | `EvidenceBrowser` — search, filter, create via public API |
| Studio ↔ API path alignment | ✅ Live | Drug Editor uses `/curator/drugs/{slug}/evidence` in slug context and `/drugs/{uuid}/evidence` only when slug is absent |
| Assertion-level `SUPPORTED_BY` UI | Partial | TREATS indication cards link attached evidence (`evidence_ids` + package `SUPPORTED_BY` rows); mechanism editors still planned |

**Curator path today:** open drug → **Evidence** (attach/create) → **Provenance** (`curator_attestation: true`) → confirm validation in context panel → **Publish wizard** Evidence readiness.

### TREATS indications (Drug Editor)

The **Indications** section links diseases via `entity_payload.relationships.TREATS` and writes publish metadata on matching rows in `package.relationships`.

| Step | UI | Package effect |
|------|-----|----------------|
| Select diseases | Disease picker (curator catalog) | `TREATS` UUID list + `TREATS` edge rows |
| Per-indication form | Explanation, confidence, evidence level | `properties` on each `TREATS` edge |
| Expert consensus | Evidence level = expert consensus + Provenance attestation | Satisfies FG-C012 without citation |
| Citation path | Pick attached evidence on the card | `properties.evidence_ids` + mirrored `SUPPORTED_BY` rows |
| Readiness badge | Publish ready / Incomplete / Needs metadata | Client mirror of FG-C012 / FG-C019 / FG-C020 |

**Typical publish path:** Indications → fill metadata → Provenance (`curator_attestation: true`) → Publish wizard → Refresh validation → Submit.

See E2E: `apps/studio/e2e/treats-workflow.spec.ts`.

See [studio-roadmap.md § Evidence workflow](studio-roadmap.md#evidence-workflow-partial) and [api.md §1.4](api.md#14-evidence-workflow-status).

### Phase 4 Studio (shell)

| Milestone | Deliverables |
|-----------|--------------|
| **4.1** ✅ | App shell, nav, dark mode, command palette, auth, API client |
| **4.2** | Drug list (4.2.2), editor (4.2.3), validation center — **complete** |
| **4.3** | Mechanism Editor, Graph Explorer, Validation Center |
| **4.4** | Publish Wizard (`submit` → `approve` → `publish`), Diff, Snapshots, AI Draft Assistant |
| **4.5** | Performance, a11y, testing |

## Publish workflow

Curator workflows follow a linear state machine enforced by FG-C023:

```
draft → review → approved → published → deprecated
         ↑__________|           ↓
                    └──────── draft (admin unpublish)
```

| State | Editable in Studio? | Who acts | API |
|-------|---------------------|----------|-----|
| `draft` | Yes — Drug Editor autosave | Curator (`curator:write`) | `PUT /curator/workflows/{id}/package` |
| `review` | Yes — package edits allowed | Curator submits; reviewer approves | `POST .../submit`, `POST .../approve` |
| `approved` | No — Return to draft | Publisher (`curator:publish`) | `POST .../publish` or `.../return-to-draft` |
| `published` | No — Unpublish first | Admin (`admin:org`) | `POST .../return-to-draft` (unpublish) or `.../deprecate` |
| `deprecated` | No | Admin soft-delete | Hidden from public graph reads (`status=deprecated`) |

**What exists today**

| Layer | Status |
|-------|--------|
| Backend state machine | ✅ `farmacograph/curator/workflow.py`, `CuratorService` |
| REST transitions | ✅ `POST /curator/workflows/{id}/submit`, `/approve`, `/publish` |
| Studio draft path | ✅ Drug Editor autosave, live validation, workflow state in context panel |
| Validation Center | ✅ Publish readiness panel (dry-runs queue packages; no transition buttons) |
| Studio publish wizard | ✅ Live — `PublishWizard` in Drug Editor |

**Publish side effects** (on successful `POST .../publish` when Neo4j is enabled): graph MERGE via `GraphWriter`, outbox event (`DrugPublished`), background `graph_validation` job, audit log entry. Optional `create_snapshot` flag on publish body.

See [api.md §1.3](api.md#13-curator-publish-workflow) and [studio-roadmap.md](studio-roadmap.md#canonical-autosave-workflow) for endpoint details and sequence diagrams.

## Application modules (roadmap)

- Dashboard — live API metrics
- Drug Editor — **Obsidian-style** three-pane layout:
  - **Center:** structured field editor (autosave per section, inline validation)
  - **Right context panel (live):** related mechanisms, linked diseases, evidence count, recent changes, publish preview, validation summary, graph position
  - Curator sees the drug’s place in the knowledge graph while editing — critical at scale
- Disease Editor — browser with **Add disease** (`POST /curator/diseases` → runtime catalog + draft workflow) + sectioned editor with provenance, AutosaveStatus, validation context panel, and publish wizard (disease evidence attach deferred)
- Relationship Editor — visual, ontology-constrained
- Mechanism Editor — Drug Editor catalog picker + interactive published DAG preview (full pathway authoring deferred)
- Graph Explorer — interactive React Flow neighborhood on `/graph?drug=…`
- Evidence Manager — citations, DOI, confidence — **live** at `/knowledge/evidence` (`EvidenceBrowser`) and per-drug in Drug Editor **Evidence** section
- Educational Layer Editor — summaries, pearls, flashcards
- AI Draft Assistant — drafts only, never auto-publish
- Validation Center — grouped errors + fixes
- Diff Viewer — draft vs published
- Snapshot surface — `GET /snapshots` release list + detail; diff/release manager deferred
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
- [x] Connected surfaces for future editors — education/mechanism/graph routes link back into Drug Editor, Evidence, and Validation
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

## Dev-only / deprecated (do not use for curation)

| Path | Role | Status |
|------|------|--------|
| `staging/` | Internal JSON fixtures for CI and local bootstrap | Dev-only |
| `scripts/dev-only/publish-drug.sh` | Publish a local JSON file via curator API | Dev-only / deprecated |
| `scripts/dev-only/publish-stub.sh` | One-time structural stub → Neo4j | Dev-only / deprecated |
| `scripts/dev-only/bootstrap-cv.sh` | Stub + curriculum queue summary | Dev-only / deprecated |
| `farmacograph/cli` `init-drug-entry` | Scaffold a new drug JSON entry | Dev-only / deprecated |

Curators must use Curation Studio or the curator REST API. Shell scripts remain for **pipeline testing**, **CI**, and **emergency recovery** only. See [scripts/dev-only/README.md](../scripts/dev-only/README.md).

## Extensibility

Modular pages, plugin-ready architecture for collectors, LLMs, validators, exporters (future).

---

*FarmacoGraph — the API is the product. The Studio is how experts build it.*
