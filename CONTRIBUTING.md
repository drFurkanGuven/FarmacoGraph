# Contributing to FarmacoGraph

Thank you for your interest in FarmacoGraph. This guide covers how to contribute code, documentation, and knowledge curation.

## Project principles

1. **API-first** — The REST API is the product. No client accesses Neo4j or PostgreSQL directly.
2. **Ontology-first** — Entity types and relationships are defined before data entry.
3. **Evidence-backed** — Published knowledge requires provenance and validation.
4. **Education separation** — Educational content is a distinct layer, never mixed with biomedical assertions.
5. **Module completeness** — Organ-system modules are finished before the next begins.

Read [docs/architecture.md](docs/architecture.md) and [docs/api-first.md](docs/api-first.md) before making structural changes.

---

## Ways to contribute

| Area | How to help |
|------|-------------|
| **Code** | API, Studio, validators, tests — see Development below |
| **Documentation** | Fix or extend `docs/`, `README.md`, OpenAPI spec |
| **Ontology** | Propose relationship or constraint changes via PR |
| **Curation** | Use [Curation Studio](docs/curation-studio.md) or the curator API |
| **Issues** | Bug reports, feature requests, architecture discussions |

---

## Development setup

See [docs/development.md](docs/development.md) for full instructions.

```bash
cp .env.example .env
./scripts/dev.sh install
./scripts/dev.sh test
```

For Studio work:

```bash
cd apps/studio && npm install && npm run dev
```

---

## Branching and pull requests

1. Fork the repository (or create a feature branch if you have write access).
2. Branch from `main` or `develop`: `feature/short-description` or `fix/issue-description`.
3. Keep PRs focused — one concern per pull request.
4. Ensure CI passes: `ruff check`, `pytest`, OpenAPI/ontology validation.
5. For Studio changes, run `npm run typecheck` and `npm run lint`.
6. Open a PR with a clear description of what changed and why.

### Commit messages

Use imperative mood, concise subject line:

```
Add curator validation summary endpoint

Wire Studio dashboard to /curator/validation-summary and display
grouped error counts by rule ID.
```

---

## Code standards

### Python (`farmacograph/`)

- Python 3.9+ compatible (CI tests 3.12)
- Type hints required — `mypy strict` is the target
- Lint with `ruff` (E, F, I, UP, B, SIM rules)
- Architecture: `router → service → repository → database`
- No biomedical facts in PostgreSQL models
- Tests in `tests/` mirroring package structure

### TypeScript (`apps/studio/`)

- Next.js 15 App Router conventions
- Typed API client — no raw `fetch` in page components
- React Query for server state
- shadcn/ui patterns for components

### Documentation

- Markdown in `docs/` — professional tone, no fabricated biomedical data
- Mermaid for architecture diagrams
- Update [repository-structure.md](docs/repository-structure.md) when adding top-level directories
- New architectural decisions: add to [docs/adr/README.md](docs/adr/README.md)

---

## Testing requirements

| Change type | Required tests |
|-------------|----------------|
| API endpoint | `tests/api/` or `tests/integration/` |
| Curator workflow | `tests/curator/` |
| Validator rule | `tests/validation/` |
| Studio utility / component | `apps/studio/src/**/__tests__/` |
| Drug browser / editor | `apps/studio/src/components/drugs/__tests__/`, `drug-editor/__tests__/` |
| Validation center | `apps/studio/src/components/validation/__tests__/` |

Run before submitting:

```bash
./scripts/dev.sh test
cd apps/studio && npx vitest run
```

---

## Curation contributions

**Do not** add production knowledge via `scripts/dev-only/` or raw JSON commits unless explicitly requested for bootstrap fixtures. Those scripts are **deprecated for curators** — development, CI, and emergency recovery only.

The curator workflow is:

```
draft → review → approved → published
```

**Canonical path:** Curation Studio (`/knowledge/drugs`, `/knowledge/drugs/[id]`, `/validation`) autosaves drafts via `PUT /api/v1/curator/workflows/{id}/package`. Alternatively, use the curator API directly. All packages pass validators before publish. See [docs/phase4-curator.md](docs/phase4-curator.md) and [docs/studio-roadmap.md](docs/studio-roadmap.md#canonical-autosave-workflow).

`staging/` is for development fixtures only.

---

## OpenAPI and API changes

1. Update `openapi/openapi.yaml` for new or changed endpoints.
2. Implement in `farmacograph/api/routers/`.
3. Add service logic in `farmacograph/services/`.
4. Document in [docs/api.md](docs/api.md) with implementation status.
5. Add integration tests.

Breaking changes require discussion in an issue before implementation.

---

## Security

- Never commit secrets, API keys, or `.env` files.
- Report security issues privately to the repository maintainer — do not open public issues for vulnerabilities.
- JWT secret must be changed in production (`FG_JWT_SECRET_KEY`).

---

## License

By contributing, you agree that your contributions are licensed under:

- **Code:** Apache License 2.0
- **Documentation:** Creative Commons Attribution 4.0 (CC BY 4.0)

See [docs/licensing.md](docs/licensing.md).

---

## Getting help

| Resource | Link |
|----------|------|
| Development guide | [docs/development.md](docs/development.md) |
| API getting started | [docs/getting-started.md](docs/getting-started.md) |
| Architecture | [docs/architecture.md](docs/architecture.md) |
| Roadmap | [docs/roadmap.md](docs/roadmap.md) |
| GitHub Issues | Repository issue tracker |
