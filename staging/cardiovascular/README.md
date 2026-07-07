# Cardiovascular Module — Phase 4.4 / 4.5

Structural stub (4.4) + real curation queue (4.5). **No pharmacology in repo until curator fills JSON files.**

## Phase 4.4 — Structural stub bootstrap

See commands below for one-time platform test.

## Phase 4.5 — Real drug curation

- **Queue:** `curriculum.yaml` — 63 slugs, all `pending`
- **Template:** `drug-entry.template.json`
- **Guide:** `docs/phase4-curation.md`
- **Per-drug files:** `drugs/{slug}.json` (curator creates)

```bash
curl -s .../api/v1/modules/cardiovascular/curriculum
farmacograph validate-package -i staging/cardiovascular/drugs/SLUG.json
```
