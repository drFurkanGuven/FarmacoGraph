# Authentication

FarmacoGraph uses JWT access tokens and API keys. All curator endpoints require authenticated credentials with the appropriate scopes.

## Endpoints (live)

| Method | Path | Purpose |
|--------|------|---------|
| POST | `/api/v1/auth/token` | Issue access + refresh tokens (`password` or `api_key` grant) |
| POST | `/api/v1/auth/refresh` | Rotate access token from refresh token |
| POST | `/api/v1/auth/introspect` | Inspect JWT or API key (scopes, roles, identity, expiry) |

## Introspection

Send credentials via request body and/or headers:

```bash
# JWT in body
curl -s -X POST http://127.0.0.1:8001/api/v1/auth/introspect \
  -H 'Content-Type: application/json' \
  -d '{"access_token":"<access_token>"}' | jq

# API key
curl -s -X POST http://127.0.0.1:8001/api/v1/auth/introspect \
  -H 'Content-Type: application/json' \
  -d '{"api_key":"fg_..."}' | jq

# Bearer header (Studio pattern)
curl -s -X POST http://127.0.0.1:8001/api/v1/auth/introspect \
  -H "Authorization: Bearer <access_token>" \
  -H 'Content-Type: application/json' \
  -d '{}' | jq
```

Response envelope:

```json
{
  "data": {
    "authenticated": true,
    "user_id": "...",
    "email": "curator@farmacograph.local",
    "roles": ["curator"],
    "scopes": ["curator:write", "curator:publish", "knowledge:read"],
    "auth_method": "jwt",
    "expires_at": "2026-07-08T12:00:00+00:00"
  },
  "meta": { "api_version": "v1" }
}
```

## Scopes

| Scope | Used for |
|-------|----------|
| `knowledge:read` | Dashboard, drugs, modules |
| `knowledge:search` | Search |
| `curator:write` | Drug browser, editor autosave, validate, submit |
| `curator:publish` | Approve and publish workflows |

Anonymous requests to curator mutation endpoints receive **401**.

## Production

Set `FG_JWT_SECRET_KEY` to a long random value. Production startup **fails** if the secret is missing or uses the development default.

Dev auto-seed (`curator@farmacograph.local` / `curator-dev-password`) runs only when `FG_ENVIRONMENT` is `development` or `test`. **Production databases start with zero users** — create a curator on the server:

```bash
cd /opt/FarmacoGraph
./scripts/migrate-schema.sh
./scripts/deploy-production.sh
./scripts/create-curator.sh --email curator@farmacograph.local
./scripts/install-nginx.sh
```

`create-curator.sh` prompts for a password when `--password` is omitted and **never prints** the password.

Promote to administrator (or use Studio **Users** after promote):

```bash
./scripts/promote-admin.sh --email curator@farmacograph.local
```

Then open https://farmacograph.furkanguven.space/studio/login/ from your browser. Dashboard `GET /api/v1/dashboard` returns **401** until you sign in — that is expected (Studio is not broken).

## Admin user + API key management (live)

Administrators (`admin:org`) manage accounts in Studio at `/users`, backed by:

| Method | Path | Purpose |
|--------|------|---------|
| GET/POST | `/api/v1/users` | List / create users |
| GET/PATCH | `/api/v1/users/{id}` | Detail / update role, password, active |
| GET/POST | `/api/v1/users/{id}/api-keys` | List / create API keys (full `fg_…` secret once) |
| POST | `/api/v1/users/{id}/api-keys/{key_id}/revoke` | Soft-revoke |

If login succeeds but API calls still 401, the browser may hold a JWT signed with an old `FG_JWT_SECRET_KEY`. Clear site data for the origin or use a private window.

See also: [getting-started.md](getting-started.md), [api.md](api.md#auth-current), [development.md](development.md), [deploy-studio.md](deploy-studio.md).
