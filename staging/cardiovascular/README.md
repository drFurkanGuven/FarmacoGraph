# Cardiovascular Module — dev fixtures only

> **Official workflow:** [Curation Studio](../../docs/curation-studio.md) (`apps/studio`)  
> Do not use this directory for production curation.

Structural stub (4.4) + curriculum queue metadata. JSON drug packages here are **bootstrap fixtures**, not the authoring interface.

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
