# FarmacoGraph Studio

Next.js Curation Studio — Phase 4.1 foundation complete; Phase 4.2 editors in progress.

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

### Functional routes

| Route | Feature |
|-------|---------|
| `/` | Dashboard — ops metrics, curator queue, validation summary, jobs |
| `/login` | Sign in via `POST /api/v1/auth/token` |
| `/settings` | Manual JWT/API key, session scopes |
| `/search` | Global drug search |

### Placeholder routes (API client ready)

| Route | Planned milestone | API methods prepared |
|-------|-------------------|----------------------|
| `/knowledge/drugs` | 4.2.2 Drug List | `drugs()`, `getDrug()`, `curatorQueue()` |
| `/knowledge/*` (other) | 4.2 editors | `createWorkflow()`, entity hooks |
| `/validation` | 4.3 Validation Center | `validatePackage()`, `validation-summary` |
| `/graph` | 4.3 Graph Explorer | graph projection endpoints (API planned) |
| `/snapshots` | 4.4 Publish wizard | `approveWorkflow()`, `publishWorkflow()` |
| `/activity`, `/users` | 4.5 | `audit-logs`, admin (planned) |

## Authentication

Two-layer protection:

1. **Middleware** (`src/middleware.ts`) — cookie check, redirect to `/login?returnTo=…`
2. **Client `AuthGate`** (`src/lib/auth/guards.tsx`) — scope/role enforcement

Session: `localStorage` + `farmacograph.studio.authenticated` cookie. API calls attach `Authorization: Bearer <accessToken|apiKey>`.

See `src/lib/auth/README.md` for integration details.

## Documentation

| Document | Focus |
|----------|-------|
| [docs/curation-studio.md](../../docs/curation-studio.md) | Product specification |
| [docs/studio-roadmap.md](../../docs/studio-roadmap.md) | Implementation milestones |
| [docs/development.md](../../docs/development.md) | Full dev setup + auth |
| [src/lib/api/README.md](src/lib/api/README.md) | API client usage |
| [src/lib/auth/README.md](src/lib/auth/README.md) | Auth flow |
