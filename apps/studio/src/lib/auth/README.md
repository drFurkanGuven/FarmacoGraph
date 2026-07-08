# Studio authentication

Client-side auth layer for FarmacoGraph Curation Studio. Connects to the public backend auth endpoints and keeps a manual JWT/API key fallback for older local API builds.

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

## Backend status

- `POST /auth/token` — live for password and API key grants.
- `POST /auth/refresh` — live and used automatically after a 401.
- `POST /auth/introspect` — live for token/session inspection.
- Direct API key auth works via Bearer token or `X-API-Key` header when PostgreSQL auth is configured.

If a local API build does not expose auth endpoints, API key login stores a client-only curator session and Settings can still hold manual credentials.
