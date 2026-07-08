# FarmacoGraph Studio

Next.js Curation Studio — secure curation path live (drug browser, drug editor, evidence, validation, publish).

## Quick start

```bash
cp .env.example .env.local
npm install
npm run dev
```

Default API: `http://127.0.0.1:8001/api/v1` (configure in Settings or `.env.local`).

Sign in at http://localhost:3000/login (API key or password) or paste credentials in Settings.

## Scripts

| Command | Purpose |
|---------|---------|
| `npm run dev` | Development server (port 3000) |
| `npm run build` | Production build |
| `npm run lint` | ESLint |
| `npm run typecheck` | TypeScript check |
| `npx vitest run` | Unit tests |
| `npx playwright test` | E2E tests |

## Status

### Live routes

| Route | Feature |
|-------|---------|
| `/` | Dashboard — ops metrics, curator queue, validation summary, jobs |
| `/login` | Sign in via `POST /api/v1/auth/token` (password or API key grant) |
| `/settings` | Manual JWT/API key, session scopes, API URL |
| `/search` | Global drug search |
| `/knowledge/drugs` | **Drug Browser** — list, filter, sort, pagination, workflow status |
| `/knowledge/drugs/[id]` | **Drug Editor** — sectioned fields, autosave, live validation, context panel |
| `/knowledge/evidence` | **Evidence Manager** — browse, filter, create citations |
| `/validation` | **Validation Center** — summary stats, grouped issues, publish readiness |
| `/activity` | Audit log and background jobs surface |
| `/snapshots` | Current snapshot marker and recently published workflows |
| `/knowledge/diseases` | Disease browser for shared disease nodes and workflows |
| `/knowledge/education`, `/knowledge/mechanisms`, `/graph` | Connected read-only surfaces linked to Drug Editor, Evidence, and Validation |

### Deferred editor routes

| Route | Planned milestone | Notes |
|-------|-------------------|-------|
| `/knowledge/education` | Education MVP | Read-only connected surface until education API/editor contracts land |
| `/knowledge/mechanisms` | Mechanism editor | Connected surface until DAG and assertion evidence contracts land |
| `/graph` | Graph Explorer | Connected preview surface until graph query endpoints land |
| `/users` | Admin | Placeholder admin view |

## Authentication

Two-layer protection:

1. **Middleware** (`src/middleware.ts`) — cookie check, redirect to `/login?returnTo=…`
2. **Client `AuthGate`** (`src/lib/auth/guards.tsx`) — scope/role enforcement per route

| Flow | Endpoint / header |
|------|-------------------|
| Password login | `POST /auth/token` with `grant_type: password` |
| API key login | `POST /auth/token` with `grant_type: api_key` |
| Token refresh | `POST /auth/refresh` (automatic on 401) |
| Direct API key | `Authorization: Bearer fg_…` or `X-API-Key` header |

Session: `localStorage` + `farmacograph.studio.authenticated` cookie.

**Protected routes:** `/knowledge/*` and `/validation` require `curator:write`; `/snapshots` requires `curator:publish`.

## Autosave (Drug Editor)

Canonical draft persistence uses the curator workflow API:

1. Open workflow — `POST /curator/drugs/{slug}/workflows` (slug) or find/create via queue (UUID)
2. Autosave — `PUT /curator/workflows/{id}/package` (800ms debounce)
3. Validate — `POST /curator/validate` (600ms debounce)

Key files: `src/components/drug-editor/autosave.ts`, `use-drug-editor.ts`.

Submit/approve/publish are exposed in the Drug Editor **Publish wizard** with `curator:publish` gating.

## Documentation

| Document | Focus |
|----------|-------|
| [docs/curation-studio.md](../../docs/curation-studio.md) | Product specification |
| [docs/studio-roadmap.md](../../docs/studio-roadmap.md) | Implementation milestones |
| [docs/development.md](../../docs/development.md) | Full dev setup + auth |
| [src/lib/api/README.md](src/lib/api/README.md) | API client usage |
| [src/lib/auth/README.md](src/lib/auth/README.md) | Auth flow |
