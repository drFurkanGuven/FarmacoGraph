# Staging-Demo E2E — mocksuz, grafsız dilim testi

Bu belge `apps/studio/e2e/staging-demo/vertical.spec.ts` koşusunu anlatır.

**Kapsam (bilerek dardır):** gerçek API (SQLite + staging dosyaları, Neo4j
kapalı) + gerçek Studio + gerçek JWT girişi. Sahte oturum, route intercept
veya mock API yoktur — ama bu test **tam-stack kanıtı değildir**: graf
yazımı/okuması staging fallback üzerinden doğrulanır.

## Ne doğrular

1. Gerçek küratör girişi (JWT) — `/login` formu, API `/auth/token`.
2. Yanlış kimlikte hata + oturumsuz kalma (sahte "başarılı" yok).
3. Dikey dilim: Explore (API detayı + staging etiket) → Compare (ilaç değişince
   backend karşılaştırması değişir) → Interactions (gerçek motor sonucu).

## Çalıştırma

```bash
# 1. API (staging verili, Neo4j kapalı)
FG_ENVIRONMENT=development \
FG_DATABASE_URL='sqlite+aiosqlite:////tmp/fg_live.db' \
FG_NEO4J_ENABLED=false FG_LOG_JSON=false \
.venv/bin/python -m uvicorn farmacograph.api.main:app \
  --host 127.0.0.1 --port 8002

# 2. Studio (API URL'si bu terminalden verilir — dev'de runtime okunur)
cd apps/studio
NEXT_PUBLIC_API_URL='http://127.0.0.1:8002/api/v1' \
  ./node_modules/.bin/next dev --port 3002

# 3. Spec
cd apps/studio
FG_STAGING_DEMO_E2E=1 PLAYWRIGHT_BASE_URL=http://127.0.0.1:3002 \
  npx playwright test e2e/staging-demo --reporter=list
```

Giriş bilgileri: `curator@farmacograph.local` / `curator-dev-password`
(API açılışında development ortamında otomatik seed'lenir).

Notlar:

- İlk çalıştırmada Next.js derlemesi yavaş olabilir; login adımı soğuk
  derlemeye denk gelirse zaman aşımı alınabilir — tekrar koşun.
- Bu modda beklenen etiket `curator staging (unpublished)` + `staging-fallback`
  provenance'dır. `published graph` etiketi görülürse ortam yanlıştır.
- `FG_STAGING_DEMO_E2E=1` yoksa spec kendini skip eder; varsayılan
  `npm run test:e2e` koşusunu bozmaz.
- Tam-stack (Neo4j publish→read) kanıtı için `docs/full-stack-e2e.md`.
