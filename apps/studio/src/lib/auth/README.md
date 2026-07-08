# Studio authentication

Client-side auth layer for FarmacoGraph Curation Studio. Connects to public backend auth endpoints when available (Phase API 5.2); falls back to manual JWT/API key entry until then.

## Flow

1. **Sign in** (`/login`) — API key or email/password via `POST /auth/token`.
2. **Manual credentials** (`/settings`) — paste JWT + optional refresh token, or API key.
3. **Session** — persisted in `localStorage` (`farmacograph.studio.session`) and mirrored to cookie `farmacograph.studio.authenticated` for middleware.
4. **API requests** — `useApiClient()` passes `getSession` to the transport; `Authorization: Bearer <token|apiKey>` is attached automatically.
5. **401 handling** — transport calls `refreshSession()` once; on failure, `signOut()` clears the session.
6. **Route guards** — `middleware.ts` redirects unauthenticated users from protected paths; `AuthGate` enforces roles/scopes client-side.

## Roles & scopes

Studio roles (`curator`, `reviewer`, `administrator`, …) are derived from JWT `scopes` when present. Permission checks use backend scope names (`curator:write`, `curator:publish`, `admin:org`, …).

## API client integration (Task A)

```typescript
const { session, signOut, refreshSession } = useAuth();

createApiClient({
  baseUrl: process.env.NEXT_PUBLIC_API_URL,
  getSession: () => session,
  refreshSession,
  onUnauthorized: signOut,
});
```

`applyAuthHeaders` in `lib/api/auth.ts` sets `Authorization: Bearer …` from `accessToken` or `apiKey`.

## Backend blockers

- `POST /auth/token` — not deployed (roadmap 5.2.2)
- `POST /auth/refresh` — not deployed
- API key via Bearer works once `deps.py` validates keys against PostgreSQL (5.2.1)

Until then, store API keys locally via Settings or Login (client-only session).
