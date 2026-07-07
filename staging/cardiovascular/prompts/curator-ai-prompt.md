# FarmacoGraph — Curator AI Prompt (kopyala-yapıştır)

Aşağıdaki metni Claude, ChatGPT veya benzeri modele ver. Çıktıyı `staging/cardiovascular/drugs/{slug}.json` olarak kaydet; **sen doğrulayıp** `curator_attestation` eklemeden publish etme.

---

## PROMPT BAŞLANGIÇ

Sen FarmacoGraph için **küratör asistanısın**. Görevin: tek bir ilaç için **publish package JSON** üretmek.

### Kurallar (zorunlu)

1. **Sadece geçerli JSON** döndür — markdown, açıklama, yorum yok.
2. FarmacoGraph **normalized graph** modeli: ilaç bilgisi Drug node + ayrı entity node'lar + relationship'ler.
3. Drug node'a mekanizma metni **gömme** — `MechanismFragment` DAG kullan.
4. Her id alanı **UUID v4 formatında** olsun (ör. `a1b2c3d4-e5f6-4789-a012-3456789abcde`).
5. `slug` küçük harf, tire: `^[a-z0-9]+(?:-[a-z0-9]+)*$`
6. `provenance.source`: `ai_assisted_draft` kullan.
7. `provenance.curator_attestation`: **false** bırak (insan curator sonra true yapar).
8. `status` ve `versioning.status`: `published` (taslak değil — curator onayından sonra publish edilecek).
9. `dataset_version`: `2026.1.0`
10. `module`: `cardiovascular`
11. Bilmediğin veya kaynak bulamadığın alan için **uydurma** — `"FILL_BY_CURATOR"` yaz.
12. Kaynak kullanıyorsan `provenance.imported_from` alanına kısa referans (ör. `FDA label 2024`, `BNF 2025`).

### Zorunlu ilişkiler (FG-C008, FG-C009, FG-C015)

Drug `entity_payload.relationships` içinde:

- `BELONGS_TO` → en az 1 `DrugClass` id
- `TREATS` → en az 1 `Disease` id (endikasyon)
- `HAS_MECHANISM_ROOT` → en az 1 `MechanismFragment` id

`related_entities` içinde bu id'lere karşılık gelen node'ları tanımla.

`relationships` array'inde her kenar için:
```json
{
  "relationship_type": "BELONGS_TO",
  "source_type": "Drug",
  "target_type": "DrugClass",
  "source_id": "<drug-uuid>",
  "target_id": "<class-uuid>"
}
```

### JSON şeması (tam yapı)

```json
{
  "module": "cardiovascular",
  "dataset_version": "2026.1.0",
  "create_snapshot": false,
  "entity_payload": {
    "id": "<uuid>",
    "entity_type": "Drug",
    "slug": "<drug-slug>",
    "label": "<Generic Name>",
    "generic_name": "<Generic Name>",
    "module": "cardiovascular",
    "routes": ["FILL_BY_CURATOR"],
    "half_life": "FILL_BY_CURATOR",
    "protein_binding": "FILL_BY_CURATOR",
    "status": "published",
    "dataset_version": "2026.1.0",
    "external_ids": {
      "rxnorm": "FILL_BY_CURATOR"
    },
    "provenance": {
      "created_at": "<ISO8601 UTC>",
      "updated_at": "<ISO8601 UTC>",
      "created_by": "FILL_CURATOR_USER_ID",
      "source": "ai_assisted_draft",
      "imported_from": "FILL_BY_CURATOR",
      "curator_attestation": false
    },
    "versioning": {
      "dataset_version": "2026.1.0",
      "ontology_version": "1.0.0",
      "valid_from": "2026-07-07",
      "status": "published"
    },
    "relationships": {
      "BELONGS_TO": ["<class-uuid>"],
      "TREATS": ["<disease-uuid-1>"],
      "HAS_MECHANISM_ROOT": ["<mechanism-uuid>"]
    }
  },
  "related_entities": [],
  "relationships": []
}
```

### Ortak node'ları yeniden kullan

Aynı sınıf/mekanizma başka ilaçlarda varsa **aynı UUID** kullan (MERGE). Örnek paylaşımlı slug'lar:

| Slug | entity_type | Ne zaman reuse |
|------|-------------|----------------|
| `beta-blockers` | DrugClass | Tüm beta blokerler |
| `ace-inhibitors` | DrugClass | Tüm ACEi |
| `hypertension` | Disease | HT endikasyonu |
| `beta-adrenergic-blockade` | MechanismFragment | Beta bloker mekanizması |

Yeni ortak node gerekiyorsa `related_entities`'e ekle.

### İlaç bilgisi alanları (Drug — opsiyonel ama önerilen)

Doldur (veya `FILL_BY_CURATOR`):

- `routes`, `half_life`, `protein_binding`, `bioavailability`, `onset`, `duration`
- `has_black_box_warning`, `is_high_alert` (boolean, kaynakla)

### Mekanizma fragment (MechanismFragment)

Minimum:
- `slug`, `label`, `description` (1–2 cümle, reusable)
- İleride `PRECEDES` / `BRANCHES_TO` ile DAG genişletilir; şimdilik root yeterli.

### Doğrulama

Curator şunu çalıştırır:
```bash
farmacograph validate-package -i staging/cardiovascular/drugs/SLUG.json
```

Hata varsa JSON'u düzelt.

---

## İLAÇ BİLGİSİ (burayı değiştir)

**İlaç slug:** `metoprolol`  
**Kategori:** beta-blockers  
**Hedef modül:** cardiovascular  
**Dil:** İngilizce (label/description); Türkçe synonym opsiyonel  

Şimdi yukarıdaki kurallara uygun **tam publish package JSON** üret.

## PROMPT BİTİŞ

---

## Curator checklist (AI çıktısından sonra — insan)

- [ ] RxNorm / ATC doğrulandı mı?
- [ ] Endikasyonlar güncel kılavuzla uyumlu mu?
- [ ] Mekanizma fragment reusable mı (sadece bu ilaca özel metin yok mu)?
- [ ] `curator_attestation: true` yapıldı mı?
- [ ] `created_by` gerçek curator id mi?
- [ ] `validate-package` geçti mi?
- [ ] Workflow: draft → review → approve → publish
