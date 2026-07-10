# Handoff — Curator MVP (2026-07-10)

> **Amaç:** İleride afallamamak. Kod yazma fazı (curator data-entry UX) büyük ölçüde bitti; sıradaki iş **içerik doldurma**.  
> **HEAD:** `82cfe12` — *Add mechanism picker and interactive graph*  
> **Önceki:** `ace97bd` disease parity · `41e6ac9` snapshot MVP

---

## 1. Ürün durumu (tek cümle)

Studio’dan ilaç/hastalık curate → validate → publish → snapshot görülebilir. Öğrenci/API tüketimi için veri doldurma sırada.

## 2. Canlı curator döngüsü

```
Login → Drug/Disease Editor → Evidence/Education/Mechanism roots
  → Validation → Publish wizard → Snapshots
```

| Yüzey | Durum | Not |
|-------|--------|-----|
| Drug Editor | **Complete** | Autosave, TREATS, evidence, education, provenance, publish |
| Disease Editor | **MVP** | Identity/clinical/provenance + publish; disease evidence deferred |
| Evidence Manager | **Complete** | Neo4j gerekir (yoksa 503) |
| Mechanism | **MVP** | Catalog picker + interactive published DAG; full pathway authoring yok |
| Graph | **MVP** | React Flow neighborhood; `POST /graph/query` yok |
| Snapshots | **MVP** | List/detail; diff yok |
| `/users` | **Placeholder** | Seed / `create-curator.sh` |

## 3. İçerik doldururken bil

- Publish için tipik: DrugClass UUID, indication, mechanism root, `curator_attestation=true`, evidence kuralları.
- DrugClass hâlâ UUID textarea (picker yok) — sürtünme, blok değil.
- Mechanism: root seçmek yeter; edge çizme UI yok.
- Evidence yazmak için production’da Neo4j açık olmalı.
- Untracked bırak: `.cursor/`, `apps/studio/tsconfig.tsbuildinfo`.

## 4. Bilerek deferred (şimdi kodlama)

1. Full mechanism DAG authoring  
2. `POST /graph/query`  
3. Snapshot diff / release manager  
4. Disease evidence attach  
5. Users admin UI  
6. Side effects / interactions editor  
7. API 5.3+ (rate limit, SDK)  
8. Öğrenci uygulaması / Phase 6  

## 5. İleride kod gerekirse (öncelik)

| # | İş | Neden |
|---|-----|--------|
| 1 | DrugClass picker | Publish sürtünmesi |
| 2 | Side effects / interactions sections | Modül tamamlık |
| 3 | Disease evidence | Disease-centric citations |
| 4 | Assertion SUPPORTED_BY UI | API var, UI yok |
| 5 | Doc sync (`docs/roadmap.md` Phase 4 satırları biraz stale) | Temizlik |

## 6. Doğrulama komutları

```bash
cd apps/studio && npm test && npm run build
.venv/bin/python -m pytest tests/api/test_snapshots_api.py tests/api/test_mechanism_fragments_api.py -q
```

## 7. Repo güvenliği (özet)

- **Kaynak kod:** private GitHub repo (public clone = çalınabilir).  
- **Halka açık vitrin:** ayrı docs/site veya Pages — kod yok, sadece mimari + API yüzeyi.  
- Detay: [repo-visibility.md](repo-visibility.md)

## 8. Sonraki insan işi

Cardiovascular ilaçları Studio’dan doldur → `create_snapshot=true` ile ilk anlamlı release (`2026.1.0` hedefi).
