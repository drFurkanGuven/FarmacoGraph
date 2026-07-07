# API Roadmap — Yavaş ve planlı ilerleme

> Sistem yorulmasın: her faz küçük, test edilebilir, deploy edilebilir.

**Canlı:** https://farmacograph.furkanguven.space/api/v1  
**Rehber:** [getting-started.md](getting-started.md)

---

## Tamamlanan (Phase 3–4)

| Bileşen | Durum |
|---------|--------|
| Health, drugs, modules, statistics | ✅ |
| Curator workflow API | ✅ |
| Explain / compare / learning (iskelet) | ✅ |
| Swagger + getting-started | ✅ |
| Search | Null provider (boş sonuç) |

---

## Phase API 5.1 — Discovery + temel arama ← **şimdi**

| # | Deliverable | Yük |
|---|-------------|-----|
| 5.1.1 | `GET /api/v1/info` — API meta, auth bilgisi, dataset sürümü | Düşük |
| 5.1.2 | Neo4j üzerinde basit ilaç araması (`GraphSearchProvider`) | Düşük |
| 5.1.3 | Search meta → snapshot `dataset_version` | Düşük |

**Deploy:** `git pull && docker compose up -d --build`

---

## Phase API 5.2 — Kimlik doğrulama (sonraki)

| # | Deliverable |
|---|-------------|
| 5.2.1 | API key doğrulama `deps.py` (PostgreSQL `api_keys`) |
| 5.2.2 | `POST /auth/token` (dev/admin JWT üretimi) |
| 5.2.3 | Anonim erişimi `FG_ALLOW_ANONYMOUS_READ=false` ile kapatma (production) |

---

## Phase API 5.3 — Koruma ve limitler

| # | Deliverable |
|---|-------------|
| 5.3.1 | In-memory rate limit middleware |
| 5.3.2 | `429` + `Retry-After` |
| 5.3.3 | CORS yapılandırması (public docs origin) |

---

## Phase API 5.4 — Sözleşme kalitesi

| # | Deliverable |
|---|-------------|
| 5.4.1 | OpenAPI ↔ FastAPI senkron (curator, info, validate) |
| 5.4.2 | Schemathesis contract test CI |
| 5.4.3 | `GET /drugs/{slug}` (slug ile erişim) |

---

## Phase API 5.5 — Geliştirici deneyimi

| # | Deliverable |
|---|-------------|
| 5.5.1 | Python SDK (openapi-generator) |
| 5.5.2 | TypeScript SDK |
| 5.5.3 | Mock server CI artifact |

---

## Phase API 5.6 — Derin graph API (veri geldikçe)

| # | Deliverable | Bağımlılık |
|---|-------------|------------|
| 5.6.1 | Explain — tam mekanizma path | CV drugs in Neo4j |
| 5.6.2 | Compare — özellik matrisi | CV drugs |
| 5.6.3 | Meilisearch / FTS plugin | Search worker |

---

## Kural

1. **Bir faz = bir deploy** — karıştırma  
2. **Veri olmadan ağır graph API ekleme** — önce kürasyon  
3. **Her faz sonunda** `pytest` + sunucuda `curl /health` + `/info`  
4. Curator ve content pipeline **API fazlarından bağımsız** devam eder
