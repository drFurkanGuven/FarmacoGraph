# Deploy Curation Studio (production)

Studio URL: **https://farmacograph.furkanguven.space/studio/**

## Canonical production bootstrap

Run on the Fedora host (`/opt/FarmacoGraph`):

```bash
cd /opt/FarmacoGraph
git pull
chmod +x scripts/*.sh
./scripts/migrate-schema.sh
./scripts/deploy-production.sh
./scripts/create-curator.sh --email curator@farmacograph.local
```

`deploy-production.sh` pins `FG_HOST_API_PORT` / `FG_HOST_STUDIO_PORT` in `.env`, syncs nginx upstreams, and fails if public `GET /api/v1/health` is not 200 (the usual post-deploy login 502).

Then open **https://farmacograph.furkanguven.space/studio/login/** in a browser (prefer a private window after JWT secret rotation).

| Symptom | Meaning | Fix |
|---------|---------|-----|
| Login / `/api/v1/*` → **502** after every deploy | nginx upstream still points at an old host port (API moved, nginx did not) | `./scripts/diagnose.sh` then `./scripts/install-nginx.sh` — fixed deploys sync this automatically |
| `/studio/` or `/studio/login/` → **502** while API is fine | Studio container still starting | Wait ~60s and run `./scripts/smoke-studio.sh --wait`, or `docker compose ps studio` until **healthy** |
| `/studio/` loads, `/api/v1/dashboard` → **401** without login | **Expected** — Studio/API auth works | Sign in |
| Login → “Invalid email or password” | No curator, wrong password, or **API key tab** selected by mistake | Click **Email & password**; then `./scripts/create-curator.sh --email …` |
| Login OK but `/dashboard` → **500** | Schema drift (`draft_package_json` missing) | `./scripts/migrate-schema.sh` then restart API |
| Chunk 404 under `/studio/_next/static/...` | Studio image missing runtime `basePath=/studio` | `./scripts/deploy-production.sh` (no `--fast`) |

**Do not confuse “Studio is broken” with “production has no user.”** Studio serving HTML while login fails almost always means the curator bootstrap step was skipped.

## Deploy options

```bash
./scripts/deploy-production.sh --env-only          # only create/update .env
./scripts/deploy-production.sh --no-pull           # skip git pull
./scripts/deploy-production.sh --fast              # skip studio --no-cache rebuild
./scripts/deploy-production.sh --public-url https://your-domain.example
```

`deploy-production.sh` will **refuse to start** if:

- `FG_ENVIRONMENT` is not `production`
- `FG_JWT_SECRET_KEY` is missing, short, or a known insecure default
- `FG_DATABASE_URL` is empty or sqlite
- `FG_NEO4J_ENABLED=true` but Neo4j URI/user/password are incomplete

## Create curator

Production does **not** auto-seed users.

```bash
# Interactive password prompt (not echoed, never printed)
./scripts/create-curator.sh --email curator@farmacograph.local

# Non-interactive
./scripts/create-curator.sh --email curator@farmacograph.local --password 'YourStrongPassword'

# Custom display name
./scripts/create-curator.sh --email curator@farmacograph.local --name 'FarmacoGraph Curator'
```

Scopes granted: `knowledge:read`, `knowledge:search`, `knowledge:explain`, `education:read`, `curator:write`, `curator:publish`.

Promote the same account to administrator (edit/deprecate published records):

```bash
./scripts/promote-admin.sh --email curator@farmacograph.local
# or create with admin from the start:
./scripts/create-curator.sh --email curator@farmacograph.local --admin
```

Then **sign out and sign in again** (JWT must include `admin:org`). Admins get **Unpublish to edit** and **Deprecate** on published drug/disease editors — package edits still go through the normal draft → review → approve → publish machine (no silent bypass).

Use a strong password (≥12 chars) and rotate it after the first smoke test.

## Schema migrate

```bash
./scripts/migrate-schema.sh
```

Idempotent and non-destructive. Ensures operational tables exist and adds:

```sql
ALTER TABLE curator_workflows
  ADD COLUMN IF NOT EXISTS draft_package_json JSONB;
```

## Nginx

`deploy-production.sh` syncs nginx upstreams from `.env` at the end of every deploy.

```bash
./scripts/install-nginx.sh
# or:
sudo cp deploy/nginx/farmacograph.conf /etc/nginx/conf.d/farmacograph.conf
sudo nginx -t && sudo systemctl reload nginx
```

**Do not** run `./scripts/find-ports.sh --force-rescan` on a live host unless you immediately re-run `install-nginx.sh`. Changing `FG_HOST_API_PORT` without updating nginx is the usual cause of post-deploy login **502**.

Studio is served at `/studio/` (trailing slash). API is same-origin at `/api/v1`. The browser must **not** call `127.0.0.1` / `localhost` / `host.docker.internal`.

## Automated smoke (HTTP)

From any machine that can reach the public URL (no SSH required):

```bash
chmod +x scripts/smoke-studio.sh
./scripts/smoke-studio.sh
# or (recommended right after docker compose up --force-recreate studio):
./scripts/smoke-studio.sh --wait https://farmacograph.furkanguven.space
```

Checks:

| Check | Expect |
|-------|--------|
| `GET /api/v1/health` | **200**, JSON `status=ok` |
| `GET /studio/` | **200** with real HTML (not empty body), or a single redirect toward login — **not** a redirect loop |
| `GET /studio/login/` | **200** HTML; flag `returnTo=%2Flogin` self-redirect loops |
| `/studio/_next/static/...` | Referenced chunk returns **200** when HTML includes asset URLs |
| HTML | No baked `localhost` / `127.0.0.1` / `host.docker.internal` API URLs |

Exit code **0** = pass, **1** = fail. This is an HTTP gate only — it does not replace the browser checklist below (login, editor, publish).

### Staging authenticated smoke (optional)

Requires explicit credentials — **do not** point at production unless intended:

```bash
FG_SMOKE_EMAIL=curator@farmacograph.local FG_SMOKE_PASSWORD='…' \
  ./scripts/smoke-studio-staging.sh https://staging.example.com
```

Checks: `POST /auth/token` → `GET /dashboard` 200 → `GET /curator/diseases` 200.

## Browser smoke test

1. Open `/studio/` — anonymous users must be redirected to login (no dashboard panel). **Empty 200 HTML = white screen** (fix with `smoke-studio.sh`).
2. Open `/studio/login/`. Confirm it settles (no endless redirects).
3. Log in with the curator created above.
4. Open dashboard — loads without 500. If the UI shows the Studio error fallback, open **API health** from that screen and check browser console (`[FarmacoGraph Studio] Uncaught render error`).
5. Open Drug Browser.
6. Open **ramipril** (or another curriculum slug).
7. Confirm autosave / validate UI loads.
8. Open Evidence section.
9. Open Publish Wizard.
10. If login still fails after a JWT secret change, use a private window or clear site data for the origin.

## Environment (`.env` — auto-written by `scripts/deploy-production.sh`)

```env
FG_ENVIRONMENT=production
FG_ENV=production
FG_HOST_STUDIO_PORT=3001
FG_STUDIO_API_URL=https://farmacograph.furkanguven.space/api/v1
FG_STUDIO_BASE_PATH=/studio
FG_NEO4J_ENABLED=true
FG_DATABASE_URL=postgresql+asyncpg://farmacograph:farmacograph@postgres:5432/farmacograph
FG_JWT_SECRET_KEY=<auto-generated-or-preserved>
FG_SEED_DEV_USERS=false
```

**Production requirements:**

- Non-default `FG_JWT_SECRET_KEY` (script generates on first run; API startup also refuses defaults)
- `FG_NEO4J_ENABLED=true` for evidence writes and publish to the knowledge graph
- PostgreSQL for auth, workflow state, and draft packages
- At least one curator via `create-curator.sh`
- Optional: set `FG_DISEASE_CATALOG_PATH` to a persistent volume path so diseases created via **Add disease** (`POST /curator/diseases`) survive container rebuilds (default file is `staging/cardiovascular/shared/diseases.runtime.json`)

## Auth expectations (do not weaken)

- Protected Studio routes require login.
- Unauthenticated `GET /api/v1/dashboard` → **401** is correct.
- Making `/dashboard` public to silence 401s is **not** allowed.

## Troubleshooting

### 404 / ChunkLoadError on `/studio/_next/static/...`

`next start` re-loads `next.config.ts` at runtime. If `NEXT_PUBLIC_BASE_PATH` is missing in the **runner** container, Next serves at `/` even when `routes-manifest.json` still says `/studio`.

```bash
curl -sSI http://127.0.0.1:3001/studio/ | head -3          # expect 200
curl -sSI http://127.0.0.1:3001/ | head -3                 # expect 404
docker compose exec studio node -e "console.log(require('./.next/routes-manifest.json').basePath)"
# → /studio
```

Fix: `./scripts/deploy-production.sh` (rebuild Studio without `--fast`), then hard-refresh the browser.

```bash
docker compose logs studio --tail 50
docker compose logs api --tail 30
```

If Studio build fails (memory): `docker system prune` and retry with swap enabled.

**Publish failures:** Check API logs for validation errors (`400`), workflow state mismatches, or Neo4j connectivity. Inspect `GET /api/v1/curator/queue?state=review` and `GET /api/v1/curator/validation-summary`.
