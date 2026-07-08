# API Roadmap — Yavaş ve planlı ilerleme

> Sistem yorulmasın: her faz küçük, test edilebilir, deploy edilebilir.

**Canlı:** https://farmacograph.furkanguven.space/api/v1  
**Rehber:** [getting-started.md](getting-started.md)

---

## Tamamlanan (Phase 3–4 + API 5.1)

| Bileşen | Durum |
|---------|--------|
| Health, drugs, modules, statistics | ✅ |
| Curator workflow API | ✅ |
| Dashboard, audit-logs, jobs (Studio ops) | ✅ |
| Explain / compare / learning (iskelet) | ✅ |
| Swagger + getting-started | ✅ |
| `GET /api/v1/info` | ✅ |
| Neo4j `GraphSearchProvider` | ✅ (`FG_NEO4J_ENABLED=true`) |
| `GET /search` — public arama sayfası | ✅ |
| Curation Studio 4.1 | ✅ |

---

## Phase API 5.1 — Discovery + temel arama ✅

| # | Deliverable | Durum |
|---|-------------|--------|
| 5.1.1 | `GET /api/v1/info` | ✅ |
| 5.1.2 | Neo4j `GraphSearchProvider` | ✅ |
| 5.1.3 | **`GET /search` — public arama sayfası** | ✅ |
| 5.1.4 | İlk test verisi (curator publish) | Kısmi — structural stub |

---

## Phase API 5.2 — Kimlik doğrulama ✅

| # | Deliverable | Durum |
|---|-------------|--------|
| 5.2.1 | API key doğrulama `deps.py` (PostgreSQL `api_keys`) | ✅ |
| 5.2.2 | `POST /auth/token`, `POST /auth/refresh` | ✅ |
| 5.2.3 | Anonim erişimi `FG_ALLOW_ANONYMOUS_READ=false` ile kapatma (production) | ✅ (production auto-off) |

---

## Phase API 5.3 — Koruma ve limitler ← **şimdi**

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
