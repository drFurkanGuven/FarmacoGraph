# Cardiovascular Module — Phase 4.4

Structural stub only. **No real pharmacology content.**

## Bootstrap publish

1. Fetch stub template:
   ```bash
   curl -s https://farmacograph.furkanguven.space/api/v1/curator/stubs/cardiovascular | jq
   ```

2. Create workflow with `entity_id` from stub (`00000000-0000-4000-8000-000000000001`)

3. `submit` → `approve` → `publish` with full package body

4. Verify:
   ```bash
   curl -s 'https://farmacograph.furkanguven.space/api/v1/drugs?module=cardiovascular'
   curl -s https://farmacograph.furkanguven.space/api/v1/health
   curl -s https://farmacograph.furkanguven.space/api/v1/modules
   ```

Expected after publish:
- `dataset_version`: `2026.1.0`
- cardiovascular module: `status: in_progress`, `drug_count: 1`
- health `latest_snapshot`: `2026.1.0`
