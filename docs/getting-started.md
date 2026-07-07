# FarmacoGraph API — Başlangıç Rehberi

> **Canlı API:** https://farmacograph.furkanguven.space  
> **Swagger UI:** https://farmacograph.furkanguven.space/docs  
> **OpenAPI JSON:** https://farmacograph.furkanguven.space/openapi.json

Bu rehber, `/docs` sayfasına gelen geliştiriciler ve entegratörler içindir: API’ye nasıl erişilir, hangi endpoint’ler açık, kimlik doğrulama nasıl çalışır.

---

## 1. Hızlı deneme (API key olmadan)

**Early access** döneminde aşağıdaki **okuma** endpoint’leri anonim çalışır (geliştirme ortamı politikası):

```bash
# Sağlık kontrolü
curl -s https://farmacograph.furkanguven.space/api/v1/health | jq

# Modüller
curl -s https://farmacograph.furkanguven.space/api/v1/modules | jq

# İlaç listesi (modül filtresi)
curl -s 'https://farmacograph.furkanguven.space/api/v1/drugs?module=cardiovascular' | jq

# Arama
curl -s 'https://farmacograph.furkanguven.space/api/v1/search?q=metoprolol' | jq
```

Swagger UI’da (**Try it out**) aynı endpoint’leri doğrudan deneyebilirsin; çoğu GET isteği için **Authorize** gerekmez.

---

## 2. API hizmeti nasıl alınır?

FarmacoGraph şu an **self-hosted / erken erişim** aşamasında. Resmi self-service kayıt portalı henüz yok.

| Kullanım tipi | Nasıl erişim | Durum |
|---------------|--------------|--------|
| **Okuma** (drugs, modules, search, health) | Anonim veya API key | Early access: anonim açık |
| **Explain / Compare** | API key önerilir | `knowledge:explain` scope |
| **Curator** (içerik yayınlama) | Davet + API key / JWT | `curator:write`, `curator:publish` |
| **Kurumsal / yüksek kota** | İletişim | Planlanıyor |

### API key talep etmek

1. GitHub repo sahibi veya platform yöneticisi ile iletişime geç:  
   [github.com/drFurkanGuven/FarmacoGraph](https://github.com/drFurkanGuven/FarmacoGraph)
2. Kullanım amacını belirt (eğitim uygulaması, araştırma, entegrasyon).
3. Size verilecek **scope** seti ve **API key** ile istek atarsın.

> Self-service key üretimi (`POST /auth/api-keys`) roadmap’te; şu an manuel provisioning.

---

## 3. Kimlik doğrulama

### Bearer token (JWT veya API key)

```http
GET /api/v1/drugs HTTP/1.1
Host: farmacograph.furkanguven.space
Authorization: Bearer fg_xxxxxxxx_yyyyyyyy
Accept: application/json
```

`curl` örneği:

```bash
export FG_API_KEY="fg_xxxxxxxx_yyyyyyyy"
curl -s -H "Authorization: Bearer $FG_API_KEY" \
  https://farmacograph.furkanguven.space/api/v1/drugs
```

Swagger UI’da: sağ üst **Authorize** → `Bearer <token>` yapıştır.

### Scope’lar (izinler)

| Scope | Ne yapar |
|-------|----------|
| `knowledge:read` | İlaçlar, modüller, istatistik |
| `knowledge:search` | `/search` |
| `knowledge:explain` | `/explain`, `/compare` |
| `education:read` | Öğrenme grafiği endpoint’leri |
| `curator:write` | Curator workflow (draft, submit) |
| `curator:publish` | Onay ve publish |
| `admin:org` | Tüm scope’lar (yönetici) |

---

## 4. Base URL ve sürümleme

| Öğe | Değer |
|-----|--------|
| Base URL | `https://farmacograph.furkanguven.space/api/v1` |
| API sürümü | `v1` (URL prefix) |
| Dataset sürümü | Response `meta.dataset_version` (ör. `2026.1.0`) |
| Ontology | `meta.ontology_version` (ör. `1.0.0`) |

Dataset sürümü snapshot yayınlarıyla güncellenir; client’lar `meta.dataset_version` ile hangi bilgi kümesini okuduklarını bilir.

---

## 5. Yanıt formatı

Tüm endpoint’ler JSON envelope kullanır:

```json
{
  "data": { },
  "meta": {
    "api_version": "v1",
    "dataset_version": "2026.1.0"
  }
}
```

Hata:

```json
{
  "error": {
    "code": "VALIDATION_ERROR",
    "message": "..."
  }
}
```

---

## 6. Rate limit (planlanan / varsayılan)

| Kimlik | Limit |
|--------|--------|
| Anonim | ~30 istek/dk |
| JWT / API key | ~300–1000 istek/dk |
| Kurumsal | Özel kota |

`429 Too Many Requests` dönerse `Retry-After` header’ına bak veya key tier yükselt.

---

## 7. Entegrasyon yolları

### curl / HTTP

Yukarıdaki örnekler yeterli.

### Python (gelecek SDK)

```python
# Planlanan — openapi-generator ile
from farmacograph import Client

client = Client(
    base_url="https://farmacograph.furkanguven.space",
    api_key="fg_...",
)
drugs = client.drugs.list(module="cardiovascular")
```

Şimdilik: `httpx` + OpenAPI spec veya Swagger’dan üretilen client.

### OpenAPI ile client üretme

```bash
curl -o openapi.yaml https://farmacograph.furkanguven.space/openapi.json
# openapi-generator-cli generate -i openapi.yaml -g python -o ./client
```

---

## 8. Swagger UI kullanımı

1. https://farmacograph.furkanguven.space/docs adresine git
2. Endpoint seç → **Try it out**
3. Parametreleri doldur → **Execute**
4. Key gerekiyorsa **Authorize** (sağ üst kilit ikonu)

**Curator** endpoint’leri (`/api/v1/curator/*`) içerik yayınlama içindir; genel entegratörler için değil.

---

## 9. Destek ve lisans

| | |
|---|---|
| Kod | Apache 2.0 |
| Dokümantasyon | CC BY 4.0 |
| Tıbbi içerik | Eğitim amaçlı; klinik karar için resmi kaynaklara başvur |
| Sorular | GitHub Issues (private deployment için repo sahibi) |

---

## 10. Sık sorulan sorular

**API key olmadan ne kullanabilirim?**  
Early access: `health`, `modules`, `drugs`, `search`, `statistics` (GET).

**Veri ne zaman dolacak?**  
Cardiovascular modülü kürasyon aşamasında; `dataset_version: unpublished` → `2026.1.0` snapshot ile güncellenir.

**Neo4j’ye doğrudan bağlanabilir miyim?**  
Hayır. API-first mimari — tüm erişim REST üzerinden.

**Production’da anonim erişim kapanacak mı?**  
Evet, planlanan: read için ücretsiz tier API key veya kayıt.
