# Phase 4.5 — Cardiovascular Drug Curation

> Curator workflow for **real** drug entries. FarmacoGraph does not auto-generate pharmacology.

## Curation queue

63 drug slugs in `staging/cardiovascular/curriculum.yaml` — identifiers only, all `pending`.

```bash
# API
curl -s https://farmacograph.furkanguven.space/api/v1/modules/cardiovascular/curriculum

# CLI
farmacograph curriculum-stats --module cardiovascular
```

## AI-assisted curation

- **Prompt:** `staging/cardiovascular/prompts/curator-ai-prompt.md`
- **Metoprolol örneği:** `prompts/metoprolol.prompt.md` + `drugs/metoprolol.json` (iskelet)
- **Paylaşılan node index:** `shared/nodes.index.json`

AI çıktısı → curator doğrular → `curator_attestation: true` → validate → publish.

## Phased rollout (63 drugs)

| Faz | Ne | Komut |
|-----|-----|--------|
| **0** | Platform test (structural stub) | `./scripts/bootstrap-cv.sh` |
| **1** | Pilot ilaç — metoprolol | Curator doldurur → `publish-drug.sh` |
| **2** | Kategori batch (ör. beta-blockers) | `init-drug-entry --slug propranolol` → doldur → publish |
| **3** | Shared node genişletme | `shared/nodes.index.json` güncelle |
| **4** | Modül tamamlama | 63/63 + snapshot `create_snapshot: true` |

```bash
# Sunucuda (dev/bootstrap only — not for curators)
cd /opt/FarmacoGraph && git pull
./scripts/dev-only/bootstrap-cv.sh

# Sıradaki ilaçlar
python3 -m farmacograph next-drugs -n 10

# Yeni iskelet JSON
python3 -m farmacograph init-drug-entry --slug propranolol

# Doldurulmuş paket yayınla
./scripts/publish-drug.sh staging/cardiovascular/drugs/metoprolol.json --mark-curriculum
```

**Önemli:** Farmakoloji içeriği curator doldurur; repo otomatik üretmez. `FILL_BY_CURATOR` alanları publish öncesi tamamlanmalı ve `curator_attestation: true` olmalı.

## Per-drug workflow

### 1. Copy template

```bash
cp staging/cardiovascular/drug-entry.template.json staging/cardiovascular/drugs/metoprolol.json
```

### 2. Fill content (curator-authored)

Required for publish (FG-C008/009/015/018):

| Field | Source |
|-------|--------|
| Drug identity | RxNorm, generic name, routes |
| `BELONGS_TO` | DrugClass node (reuse shared class when possible) |
| `TREATS` | Disease/indication node |
| `HAS_MECHANISM_ROOT` | MechanismFragment DAG entry |
| `provenance` | Curator ID, source, attestation |

**Reuse shared nodes:** DrugClass, MechanismFragment, Disease nodes should be MERGE'd once and referenced by multiple drugs.

### 3. Validate (dry-run)

```bash
farmacograph validate-package -i staging/cardiovascular/drugs/metoprolol.json
```

```bash
curl -X POST https://farmacograph.furkanguven.space/api/v1/curator/validate \
  -H "Content-Type: application/json" \
  -d @staging/cardiovascular/drugs/metoprolol.json
```

### 4. Curator workflow

```
POST /curator/workflows          → draft
POST .../submit                  → review
POST .../approve                 → approved
POST .../publish                 → published (+ Neo4j)
```

Use full package JSON as publish body.

### 5. Update curriculum

After publish, set slug `status: published` in `curriculum.yaml` and commit.

## Module completion (2026.1.0)

From `docs/roadmap.md`:

- [ ] 63/63 drugs published
- [ ] Each drug: class + indication + mechanism root
- [ ] ≥90% key side effects / interactions
- [ ] ≥80% education summaries
- [ ] All edges have evidence
- [ ] Final snapshot `create_snapshot: true` on last drug or dedicated release job

## What NOT to do

- Do not embed mechanism text in Drug node — use MechanismFragment DAG
- Do not skip validation
- Do not import DrugBank text without license
- Do not publish without curator attestation

## File layout

```
staging/cardiovascular/
  curriculum.yaml           # curation queue (63 slugs)
  drug-entry.template.json  # publish package template
  drugs/                    # one JSON per drug (curator fills)
    metoprolol.json
    ...
```
