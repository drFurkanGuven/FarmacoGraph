# FarmacoGraph API — Başlangıç Rehberi

> **Canlı API:** https://farmacograph.furkanguven.space
>
> **API landing:** https://farmacograph.furkanguven.space/docs
>
> **Swagger API Explorer:** https://farmacograph.furkanguven.space/api/v1/docs
>
> **Canlı OpenAPI JSON:** https://farmacograph.furkanguven.space/api/v1/openapi.json

Bu rehber canlı FarmacoGraph API’sine ve Curation Studio’ya erişmek isteyen kullanıcılar içindir. Production ortamında yalnızca sağlık ve keşif uçları anonimdir; bilgi, arama ve kürasyon uçları uygun scope’a sahip kimlik bilgisi ister.

## 1. Kimlik doğrulamasız kontrol

```bash
curl -s https://farmacograph.furkanguven.space/api/v1/health | jq
curl -s https://farmacograph.furkanguven.space/api/v1/info | jq
```

Production’da aşağıdaki gibi korumalı bir istek kimlik bilgisi olmadan `401 Unauthorized` döndürür:

```bash
curl -i https://farmacograph.furkanguven.space/api/v1/modules
```

Geliştirme ve test ortamlarında `FG_ALLOW_ANONYMOUS_READ=true` ise bazı read/search/explain uçları anonim çalışabilir. Production ayar doğrulaması bu seçeneği zorunlu olarak kapatır.

## 2. Studio demo erişimi

Salt-okunur Studio değerlendirme hesabı için:

1. https://farmacograph.furkanguven.space/demo-request sayfasını aç.
2. Ad, e-posta, kurum ve kullanım amacını gönder.
3. Yönetici onayından sonra oluşturulan geçici kullanıcı bilgilerini yöneticiden al.
4. https://farmacograph.furkanguven.space/studio/login/ adresinden giriş yap.

Onaylanan demo hesapları `viewer` rolüyle oluşturulur. `knowledge:read`, `knowledge:search` ve `education:read` scope’larına sahiptir; entity ID’lerini, taslakları, kullanıcıları veya API key’leri değiştiremez ve yayın yapamaz.

## 3. API ve küratör erişimi

FarmacoGraph self-hosted/erken erişim aşamasındadır. Genel kullanıma açık self-service hesap veya API key kayıt portalı yoktur.

| Kullanım | Erişim yöntemi | Gerekli izin |
|----------|----------------|--------------|
| Health ve discovery | Anonim | Yok |
| Bilgi okuma | Yönetici tarafından oluşturulan hesap/API key | `knowledge:read` |
| Arama | Hesap/API key | `knowledge:search` |
| Explain | Hesap/API key | `knowledge:explain` |
| Eğitim içeriği | Hesap/API key | `education:read` |
| Draft düzenleme | Küratör daveti | `curator:write` |
| Onay ve yayınlama | Reviewer/yönetici daveti | `curator:publish` |
| Kullanıcı ve key yönetimi | Yönetici hesabı | `admin:org` |

API erişimi için repository yöneticisiyle iletişime geçip kullanım amacını ve gereken scope’ları belirt. Yöneticiler Studio’daki **Users** ekranından kullanıcı ve API key oluşturabilir. Tam API key yalnızca oluşturulduğu anda bir kez gösterilir.

## 4. Token alma

### E-posta ve parola

```bash
curl -s -X POST https://farmacograph.furkanguven.space/api/v1/auth/token \
  -H 'Content-Type: application/json' \
  -d '{
    "grant_type": "password",
    "username": "user@example.org",
    "password": "your-password"
  }' | jq
```

### API key’i JWT ile değiştirme

```bash
curl -s -X POST https://farmacograph.furkanguven.space/api/v1/auth/token \
  -H 'Content-Type: application/json' \
  -d '{
    "grant_type": "api_key",
    "api_key": "fg_..."
  }' | jq
```

Her iki akış da `access_token`, `refresh_token`, süre ve scope listesini doğrudan JSON nesnesi olarak döndürür.

## 5. Yetkili istek gönderme

JWT access token:

```bash
export FG_ACCESS_TOKEN='eyJ...'
curl -s \
  -H "Authorization: Bearer ${FG_ACCESS_TOKEN}" \
  https://farmacograph.furkanguven.space/api/v1/modules | jq
```

Ham API key iki şekilde kullanılabilir:

```bash
export FG_API_KEY='fg_...'

curl -s -H "Authorization: Bearer ${FG_API_KEY}" \
  https://farmacograph.furkanguven.space/api/v1/drugs | jq

curl -s -H "X-API-Key: ${FG_API_KEY}" \
  https://farmacograph.furkanguven.space/api/v1/drugs | jq
```

`/api/v1/docs` Swagger UI’daki **Authorize** alanına JWT veya API key girerken `Bearer ` önekini arayüz kendisi ekler; alana yalnızca token/key değerini yapıştır. Kök `/docs` landing sayfasıdır ve API operasyonlarını listelemez.

Refresh token korumalı API çağrılarında Bearer olarak kullanılamaz. Yeni token çifti almak için:

```bash
curl -s -X POST https://farmacograph.furkanguven.space/api/v1/auth/refresh \
  -H 'Content-Type: application/json' \
  -d '{"refresh_token":"eyJ..."}' | jq
```

## 6. Scope’lar

| Scope | Yetki |
|-------|-------|
| `knowledge:read` | Dashboard, drugs, diseases, modules ve statistics |
| `knowledge:search` | `/search` |
| `knowledge:explain` | `/explain` |
| `education:read` | Eğitim/öğrenme içeriği |
| `graph:query` | İzin verilen graph sorguları |
| `curator:write` | Draft oluşturma, düzenleme, doğrulama ve submit |
| `curator:publish` | Review, approve ve publish |
| `admin:org` | Kullanıcı yönetimi ve tüm scope’lar |
| `admin:api_keys` | API key yönetimi için ek yönetim yetkisi |

Yetersiz scope ile yapılan kimliği doğrulanmış istek `403 Forbidden`; kimlik bilgisi olmayan korumalı istek `401 Unauthorized` döndürür.

## 7. Base URL ve yanıtlar

| Öğe | Değer |
|-----|-------|
| Base URL | `https://farmacograph.furkanguven.space/api/v1` |
| API sürümü | `v1` |
| Dataset sürümü | Uygun yanıtlardaki `meta.dataset_version` |
| Ontology sürümü | Uygun yanıtlardaki `meta.ontology_version` |

Çoğu domain endpoint’i `{ "data": ..., "meta": ... }` zarfı kullanır. Auth endpoint’leri (`/auth/token`, `/auth/refresh`, `/auth/introspect`) response modelini doğrudan döndürür. FastAPI doğrulama ve yetki hataları `{ "detail": ... }`; bazı domain hataları `{ "error": ... }` şeklinde olabilir.

## 8. Rate limiting durumu

Rate-limit ayarları tanımlıdır ancak uygulama middleware’i henüz devrede değildir. Belgelerdeki istek/dakika değerleri hedef kapasitedir; production garantisi veya aktif kota olarak değerlendirilmemelidir. Şu anda `429`/`Retry-After` davranışına güvenen client mantığı kurma.

## 9. Client üretme

```bash
curl -o openapi.json https://farmacograph.furkanguven.space/api/v1/openapi.json
# openapi-generator-cli generate -i openapi.json -g python -o ./client
```

Resmi Python/TypeScript SDK henüz yayınlanmadı. Şimdilik `httpx`, `fetch` veya OpenAPI tabanlı üretilen client kullanılabilir.

## 10. Lisans ve destek

| Öğe | Lisans/durum |
|-----|---------------|
| Kaynak kod | [GNU GPLv3](../LICENSE) |
| Dokümantasyon ve özgün kürasyon içeriği | CC BY 4.0 |
| Üretilen dataset’ler | Kaynak bazlı; bkz. [licensing.md](licensing.md) |
| Sorular | GitHub Issues veya repository yöneticisi |

FarmacoGraph eğitim amaçlıdır; klinik karar desteği yerine kullanılmamalıdır.
