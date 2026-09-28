# Full-Stack E2E — PostgreSQL + Neo4j + API + Studio, mocksuz

Bu belge **tam-stack kanıtını** anlatır: küratörün yayımladığı ilaç Neo4j'ye
gerçekten yazılır ve okuyucu ekranında staging fallback olmadan görünür.
Staging-demo dilimi için `docs/staging-demo-e2e.md` (ayrı kapsam, ayrı test).

## Ne doğrular

Backend (`tests/integration/test_fullstack_publish_read.py`, `FG_FULLSTACK=1`):

1. Gerçek giriş → paket kaydı → doğrulama/onay → yayın (`graph_write.success`).
2. `GET /drugs/{id}`, `/mechanism`, `/graph`, `/evidence`, `/compare`
   yanıtlarında `meta.provenance` **yok** (staging-fallback sızıntısı yok).

UI (`apps/studio/e2e/full-stack/published-read.spec.ts`, `FG_FULLSTACK_E2E=1`):

1. Gerçek giriş.
2. Explore'da yayımlanmış ilaç: `published graph` etiketi görünür,
   `curator staging (unpublished)` metni **sıfır** kez geçer.
3. Compare'da ilaç değişimi backend içeriğini değiştirir, staging rozeti yok.

## Çalıştırma (bu Mac'te Docker ile doğrulandı)

```bash
# 0. Docker CLI (Docker Desktop kuruluysa):
export PATH="$HOME/.docker/bin:$PATH"

# 1. Veri servisleri
docker compose up -d postgres neo4j
# postgres: 127.0.0.1:5433, neo4j bolt: 127.0.0.1:7687 (healthcheck'leri bekleyin)

# 2. API (gerçek PG + gerçek Neo4j)
FG_ENVIRONMENT=development \
FG_DATABASE_URL='postgresql+asyncpg://farmacograph:farmacograph@localhost:5433/farmacograph' \
FG_NEO4J_ENABLED=true FG_NEO4J_URI='bolt://localhost:7687' \
FG_NEO4J_USER=neo4j FG_NEO4J_PASSWORD=farmacograph FG_LOG_JSON=false \
.venv/bin/python -m uvicorn farmacograph.api.main:app \
  --host 127.0.0.1 --port 8011

# 3. Yayın akışı en az bir ilaç için koşmalı (metoprolol örneği):
#    login → POST /curator/workflows → PUT .../package (staging paketi) →
#    submit → approve → publish → graph_write.success

# 4. Backend kanıtı
FG_FULLSTACK=1 FG_DATABASE_URL='postgresql+asyncpg://farmacograph:farmacograph@localhost:5433/farmacograph' \
FG_NEO4J_ENABLED=true FG_NEO4J_URI='bolt://localhost:7687' \
FG_NEO4J_USER=neo4j FG_NEO4J_PASSWORD=farmacograph \
.venv/bin/python -m pytest tests/integration/test_fullstack_publish_read.py -o addopts='' -q

# 5. Studio + UI kanıtı
cd apps/studio
NEXT_PUBLIC_API_URL='http://127.0.0.1:8011/api/v1' ./node_modules/.bin/next dev --port 3003
FG_FULLSTACK_E2E=1 PLAYWRIGHT_BASE_URL=http://127.0.0.1:3003 \
  npx playwright test e2e/full-stack --reporter=list
```

Notlar:

- `FG_FULLSTACK=1` / `FG_FULLSTACK_E2E=1` yoksa testler kendini skip eder.
- Yayınlanan veri PG + Neo4j'de kalır (MERGE idempotent, tekrar koşu güvenli).
- Bu makinede 8001. portta başka bir API çalışıyorsa çakışmamak için 8011
  kullanıldı; compose varsayılanları (`FG_HOST_*`) değiştirilmedi.
- Üç durumun kanıtı:
  - graf başarılı → yukarıdaki koşular (yeşil),
  - graf erişilemez → birim suite'te `test_publish_without_graph_fails_with_503_and_keeps_approved`
    (sqlite, Neo4j kapalı) + `test_publish_graph_write_failure_keeps_approved`
    (yazım patlaması simülasyonu),
  - prod-anonim → `FG_ENVIRONMENT=production FG_ALLOW_ANONYMOUS_READ=false` ile
    `/drugs`, `/compare` anonim 401; Studio `ApiErrorPanel` giriş çağrısı
    gösterir (`api-error-panel.test.tsx`).
