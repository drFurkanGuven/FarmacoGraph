# Repo visibility — kod gizli, vitrin açık

> FarmacoGraph için önerilen model. **GitHub’da public repo + “kodu görme ama çalamama” diye bir özellik yok.** Public olan her şey klonlanır.

---

## Gerçek

| İstek | Mümkün mü? |
|-------|------------|
| Public repo, kaynak kod görünür ama kopyalanamaz | **Hayır** |
| Private repo (kod gizli) | **Evet** |
| Public dokümantasyon / landing / API docs, kod private | **Evet** (doğru model) |
| Canlı demo (Studio/API), kaynak private | **Evet** (sizde kısmen var) |

Lisans, watermark, “view only” GitHub — **çalmayı engellemez**. Engelleyen tek şey: **kaynağı public etmemek**.

---

## Önerilen mimari

```text
┌─────────────────────────────┐     ┌──────────────────────────────┐
│  GitHub PRIVATE             │     │  PUBLIC vitrin               │
│  FarmacoGraph (monorepo)    │     │  docs site / landing page    │
│  tüm kaynak kod             │     │  mimari, API overview,       │
│  CI, deploy secrets private │     │  screenshot, Swagger link    │
└─────────────────────────────┘     └──────────────────────────────┘
              │                                    ▲
              │ deploy                             │
              ▼                                    │
     farmacograph.furkanguven.space  ──────────────┘
     (canlı API + Studio — kullanım, kaynak değil)
```

### Adımlar

1. **Ana repo’yu Private yap**  
   GitHub → Settings → General → Danger Zone → Change visibility → Private.  
   Collaborator’ları bilinçli ekle; fork hakkı kapalı kalsın.

2. **Public vitrin (seçeneklerden biri)**  
   - **A)** Ayrı public repo: `FarmacoGraph-docs` — sadece `docs/` kopyası / MkDocs / Astro landing (kod yok).  
   - **B)** GitHub Pages veya kendi domain’de statik site (README, mimari diyagram, özellik listesi, canlı linkler).  
   - **C)** Sadece canlı site: `https://farmacograph.furkanguven.space` + Swagger — GitHub’da hiç public repo yok.

3. **Ne göster, ne gösterme**  
   - Göster: ürün amacı, ontology özeti, API endpoint listesi (yüksek seviye), screenshot, demo link.  
   - Gösterme: `farmacograph/`, `apps/studio/src/`, `.env`, deploy anahtarları, staging JSON paketleri (istersen).

4. **OpenAPI**  
   Public Swagger kullanımı normal; bu “API sözleşmesi”, tüm uygulama kaynağı değil. İstersen production’da `/docs`’u auth arkasına alırsın.

---

## “Millet girer, kodu çalamaz” pratik karşılığı

| Katman | Ne yapar |
|--------|----------|
| Private GitHub | Kaynak çalınmaz (repo erişimi yoksa) |
| Canlı Studio/API | Ürünü denerler; Next/Python bundle’ı reverse-engineer edilebilir ama **monorepo + ontology + curator pipeline** kolayca gitmez |
| Public docs repo | Portföy / başvuru / “bak bu proje var” linki |
| NDA + private collaborator | Ortak çalışırken |

Tam koruma yok; hedef **makul zorluk + private kaynak**.

---

## Hemen yapılacak checklist

- [ ] `drFurkanGuven/FarmacoGraph` visibility → **Private**
- [ ] Deploy secrets sadece GitHub Actions secrets / sunucu `.env`
- [ ] İstersen `FarmacoGraph-docs` public repo veya landing page
- [ ] README’deki GitHub linkini private repo yerine **docs/site** linkine çevir (public yüz)
- [ ] Bu handoff’u oku: [handoff-curator-mvp.md](handoff-curator-mvp.md)

---

## Cursor / yerel

- `.cursor/` commit etme (zaten untracked bırakılıyor).  
- Agent’a private repo ile devam; public’e sadece docs push et.
