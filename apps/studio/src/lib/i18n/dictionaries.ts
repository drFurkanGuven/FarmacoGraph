"use client";

/**
 * Studio UI dictionaries — chrome text only (TR default, EN fallback).
 *
 * RED LINE: graph data is NEVER translated. Entity labels/slugs,
 * relationship types (TREATS, PRECEDES, ...), ATC/RxNorm codes,
 * evidence_type values and quality scores stay in English. Dictionary keys
 * below cover navigation, buttons, form labels, wizard steps and curator
 * guidance sentences only.
 */

export type StudioLocale = "tr" | "en";

export const STUDIO_LOCALES: StudioLocale[] = ["tr", "en"];
export const DEFAULT_STUDIO_LOCALE: StudioLocale = "tr";
export const STUDIO_LOCALE_COOKIE = "farmacograph.studio.lang";

const tr = {
  "nav.sections.identity.title": "Kimlik",
  "nav.sections.identity.description": "İlaç varlığı için temel tanımlayıcılar ve adlandırma.",
  "nav.sections.classification.title": "Sınıflandırma",
  "nav.sections.classification.description": "Terapötik ve farmakolojik sınıf ilişkileri.",
  "nav.sections.indications.title": "Endikasyonlar",
  "nav.sections.indications.description":
    "İlacın tedavi ettiği hastalıkları bağlayın ve her TREATS ilişkisi için yayın meta verisi ekleyin.",
  "nav.sections.mechanism.title": "Mekanizma",
  "nav.sections.mechanism.description":
    "Mekanizma yolunu tuvalde yazın: fragman ekleyin, Drug düğümünden kök seçin ve adımları bağlayın.",
  "nav.sections.education.title": "Eğitim",
  "nav.sections.education.description":
    "Biyomedikal gerçeklerin dışında tutulan, öğrenciye yönelik özetler ve sınav incileri.",
  "nav.sections.evidence.title": "Kanıt",
  "nav.sections.evidence.description":
    "Bu ilaç için atıflar, köken bağlantıları ve doğrulama eksikleri.",
  "nav.sections.provenance.title": "Köken",
  "nav.sections.provenance.description": "Doğrulayıcıların istediği atıf ve kürasyon meta verisi.",
  "nav.sections.pharmacokinetics.title": "Farmakokinetik",
  "nav.sections.pharmacokinetics.description":
    "İlaca özgü PK özet değerleri (etimad). Birimle yazın; kanıtı DailyMed bağlantısıyla verin.",
  "nav.sections.safety.title": "Güvenlilik",
  "nav.sections.safety.description":
    "Kara kutu uyarısı ve yüksek risk bayrakları. Uyarı varsa FDA etiketi kanıtı bağlayın.",
  "nav.edited": "Düzenlendi",

  "topnav.search": "Ara",
  "topnav.module": "Modül",
  "topnav.activeModule": "Aktif modül",
  "topnav.light": "Açık",
  "topnav.dark": "Koyu",
  "topnav.system": "Sistem",
  "topnav.current": "Geçerli",
  "topnav.language": "Dil",

  "evidence.title": "Kanıt",
  "evidence.subtitle": "Bu ilaç paketine ait ekli atıflar, doğrulama eksikleri ve kanıt kalitesi.",
  "evidence.attachExisting": "Mevcut kanıtı bağla",
  "evidence.createEvidence": "Kanıt oluştur",
  "evidence.attached": "Bağlı",
  "evidence.missing": "Eksik",
  "evidence.missingHintNone": "Eksik bildirilmedi",
  "evidence.missingHintSome": "Doğrulama provasından",
  "evidence.avgQuality": "Ort. kalite",
  "evidence.attachedEvidence": "Bağlı kanıtlar",
  "evidence.attachedEvidenceHint": "Genel API üzerinden bu ilaca bağlı kanıt düğümleri.",
  "evidence.noEvidence": "Bağlı kanıt yok",
  "evidence.noEvidenceHint": "Mevcut bir kanıt kaydını bağlayın ya da yeni yapısal atıf oluşturun.",
  "evidence.missingEvidence": "Eksik kanıt",
  "evidence.missingEvidenceHint": "Eksik ya da yetersiz kanıta işaret eden doğrulama sorunları.",
  "evidence.noMissing": "Son doğrulama provasında eksik kanıt sorunu bildirilmedi.",
  "evidence.searchTitle": "Mevcut kanıtı bağla",
  "evidence.searchHint": "Kanıt kataloğunda arayın ve kaydı bu ilaca bağlayın.",
  "evidence.searchPlaceholder": "Başlık ya da ID ile ara",
  "evidence.searchEmpty": "Bağlanacak kanıt kaydı bulmak için arayın.",
  "evidence.attachedLabel": "Bağlı",
  "evidence.attachLabel": "Bağla",
  "evidence.createTitle": "Kanıt oluştur",
  "evidence.createHint":
    "Yapısal bir kanıt kaydı oluşturup bu ilaca bağlayın. Biyomedikal iddia türetilmez.",
  "evidence.fieldTitle": "Başlık",
  "evidence.fieldTitlePlaceholder": "Atıf ya da kaynak başlığı",
  "evidence.fieldType": "Kanıt türü",
  "evidence.fieldQuality": "Kalite puanı (0–1)",
  "evidence.fieldYear": "Yıl (opsiyonel)",
  "evidence.fieldAuthors": "Yazarlar (virgülle ayırın)",
  "evidence.fieldJournal": "Dergi / kaynak",
  "evidence.fieldJournalPlaceholder": "Dergi ya da düzenleyici kurum",
  "evidence.fieldSupportsClaim": "Desteklediği iddia",
  "evidence.fieldSupportsClaimPlaceholder": "Bu kaynak hangi klinik iddiayı destekliyor?",
  "evidence.fieldExtract": "Alıntı",
  "evidence.fieldExtractPlaceholder": "Kaynaktan ilgili alıntı ya da özet",
  "evidence.fieldLinkIndication": "Endikasyona bağla (opsiyonel)",
  "evidence.fieldLinkIndicationNone": "Bağlama — sonra endikasyon kartından seçilir",
  "evidence.cancel": "Vazgeç",
  "evidence.createAndAttach": "Oluştur ve bağla",

  "treats.clinicalExplanation": "Klinik gerekçe",
  "treats.clinicalExplanationPlaceholder": "Bu ilaç bu hastalığı neden tedavi ediyor?",
  "treats.clinicalExplanationHint":
    "Her TREATS ilişkisinde yayın için klinik gerekçe, güven meta verisi ve kanıt düzeyi gerekir. Ayrı atıf yoksa Provenance bölümünde uzman görüşü onayını kullanın.",
  "treats.confidence": "Güven puanı (0–1)",
  "treats.evidenceLevel": "Kanıt düzeyi",
  "treats.attestationWarning":
    "Uzman görüşü, Provenance bölümünde küratör onayı ya da aşağıdan destek kanıtı gerektirir.",
  "treats.statusReady": "Hazır",
  "treats.statusPartial": "Eksik var",
  "treats.statusMissing": "Eksik",
  "treats.supportingEvidence": "Destek kanıtı (uzman görüşü + onay için opsiyonel)",
  "treats.supportingEvidenceHint":
    "Bu ilaca bağlı atıfları bağlayın. Seçili kayıtlar TREATS ilişkisine evidence_ids olarak yazılır ve yayın doğrulaması (FG-C012) için SUPPORTED_BY satırı olarak yansıtılır.",
  "treats.noEvidenceYet":
    "Bu ilaca henüz kanıt bağlı değil. Önce Kanıt bölümünden kayıt bağlayın, sonra burada endikasyona bağlayın.",
  "treats.quickCreateTitle": "Hızlı kanıt oluştur ve bağla",
  "treats.quickCreateHint":
    "Başlık ve tür yeterli — kayıt oluşturulur, ilaca bağlanır ve bu endikasyona işlenir.",
  "treats.quickCreatePlaceholder": "Atıf ya da kaynak başlığı",
  "treats.quickCreateButton": "Oluştur ve işle",
  "treats.indicationMetadata": "Endikasyon meta verisi",

  "wizard.title": "Yayın sihirbazı",
  "wizard.confirm": "İşlemi onayla",
  "wizard.result": "İş akışı güncellemesi",
  "wizard.goToSection": "Bölüme git",
  "wizard.ready": "Hazır",
  "wizard.blocked": "Engelli",
  "wizard.pending": "Bekliyor",
  "wizard.unknown": "Bilinmiyor",
  "wizard.stepDraft": "Taslak",
  "wizard.stepDraftHint": "Paketi düzenleyin ve doğrulayın",
  "wizard.stepReview": "İnceleme",
  "wizard.stepReviewHint": "Küratör incelemesine gönderildi",
  "wizard.stepApproved": "Onaylandı",
  "wizard.stepApprovedHint": "Grafa yayınlanmaya hazır",
  "wizard.stepPublished": "Yayınlandı",
  "wizard.stepPublishedHint": "Bilgi grafında canlı",
  "wizard.refreshValidation": "Doğrulamayı yenile",

  "validation.blockingErrors": "Engelleyici hata",
  "validation.evidenceBlockers": "Kanıt engelleri",
  "validation.missingEvidence": "Eksik kanıt",
  "validation.lowConfidence": "Düşük güvenli",
  "validation.evidenceWarnings": "Kanıt uyarıları",
  "validation.graphFailures": "Graf hataları",
  "validation.graphPending": "Graf bekleyenleri",
  "validation.publishReady": "Yayın hazır",
  "validation.yes": "Evet",
  "validation.no": "Hayır",

  "fallback.draftBadge": "Taslak / çevrimdışı örnek — küratör onayı yok",
  "fallback.variableEmpty": "Küratör girişi bekleniyor",

  "mechanism.fragmentType": "Fragman düzeyi",
  "mechanism.direction": "Yön",
  "mechanism.newFragment": "Yeni fragman",
  "mechanism.newFragmentHint": "Yol yazımı için küratör kataloğuna MechanismFragment kaydeder.",
  "mechanism.label": "Etiket",
  "mechanism.slug": "Kısa ad (slug)",
  "mechanism.description": "Açıklama",
  "mechanism.descriptionPlaceholder": "Opsiyonel küratör notu",
  "mechanism.create": "Fragman oluştur",
  "mechanism.creating": "Oluşturuluyor…",
  "mechanism.levelGuideTitle": "Hangi düzey?",
  "mechanism.level.molecular": "molecular — reseptör/enzim bağlanması (örn. ACE inhibisyonu)",
  "mechanism.level.cellular": "cellular — hücre içi sinyal (örn. cAMP düşüşü)",
  "mechanism.level.tissue": "tissue — doku yanıtı (örn. damar düz kas gevşemesi)",
  "mechanism.level.organ": "organ — organ çıktısı (örn. aldosteron azalması)",
  "mechanism.level.clinical": "clinical — hasta-düzeyi sonuç (örn. kan basıncı düşüşü)",

  "safety.hasBlackBox": "Kara kutu uyarısı var",
  "safety.blackBoxText": "Kara kutu metni",
  "safety.blackBoxPlaceholder": "FDA etiketindeki uyarı metnini aynen yazın",
  "safety.isHighAlert": "Yüksek riskli ilaç",
  "safety.fdaEvidenceHint": "Uyarı işaretliyse FDA etiketi türünde kanıt bağlayın.",

  "pk.halfLife": "Yarılanma ömrü",
  "pk.halfLifePlaceholder": "örn. 3–7 sa",
  "pk.bioavailability": "Biyoyararlanım",
  "pk.bioavailabilityPlaceholder": "örn. %50",
  "pk.proteinBinding": "Protein bağlanma",
  "pk.proteinBindingPlaceholder": "örn. %12",
  "pk.onset": "Etki başlangıcı",
  "pk.onsetPlaceholder": "örn. 1–2 sa",
  "pk.duration": "Etki süresi",
  "pk.durationPlaceholder": "örn. 24 sa",
  "pk.importedFrom": "Kaynak (DailyMed URL)",
  "pk.importedFromPlaceholder": "https://dailymed.nlm.nih.gov/…",
  "pk.importedFromHint": "Değerlerin alındığı FDA etiketi / BNF bağlantısı.",

  "provenance.attestationHint": "İçeriği insan küratör onayladığında işaretleyin.",

  "common.retry": "Tekrar dene",
  "common.save": "Kaydet",
  "common.cancel": "Vazgeç",

  "presentation.presentationView": "Sunum",
  "presentation.curatorView": "Küratör görünümü",
  "presentation.hint": "Okuyucular için teknik panelleri gizle",

  "knowledge.mechanisms.eyebrow": "Mekanizma katmanı",
  "knowledge.mechanisms.title": "Mekanizmalar",
  "knowledge.mechanisms.description":
    "Bir ilaç seçip yayımlanmış mekanizma DAG'ini ve Explain önizlemesini inceleyin.",
  "knowledge.mechanisms.editPathway": "Yolu düzenle",
  "knowledge.mechanisms.openBrowser": "İlaç tarayıcısını aç",
  "knowledge.mechanisms.emptyReader": "Bu ilaçta henüz yayımlanmış mekanizma yok.",
  "knowledge.mechanisms.emptyCurator": "Drug Editor'da kök ve yol adımlarını yazıp yayımlayın.",
  "knowledge.graph.eyebrow": "Graf gezgini",
  "knowledge.graph.title": "Graf Gezgini",
  "knowledge.graph.description": "Bir ilaç seçip yayımlanmış Neo4j komşuluğunu inceleyin.",
  "knowledge.graph.editPathway": "Editörde aç",
  "knowledge.graph.openBrowser": "İlaç tarayıcısını aç",
  "knowledge.graph.emptyReader": "Bu ilaçta henüz yayımlanmış graf komşuluğu yok.",
  "knowledge.graph.emptyCurator":
    "Drug Editor'da ilişki yazıp yayımlayın, ardından derinliği artırın.",
  "knowledge.pickDrug": "İlaç seçin",

  "error.unknown": "İstek başarısız oldu.",
  "error.unreachable": "Bilgi API'sine ulaşılamıyor",
  "error.loginRequired": "Giriş gerekli",
  "error.loginHint": "Bu görünüm oturum gerektiriyor. Sunucu herkese açık önizlemeyi kapatmış.",
  "error.noSample":
    "Yerine örnek veri gösterilmiyor — API'nin çalıştığını doğrulayıp tekrar deneyin.",
  "error.signIn": "Giriş yap",

  "study.practice": "Alıştırma",
  "study.list": "Liste",
  "study.mastered": "Öğrenildi",
  "study.learning": "Öğreniliyor",
  "study.newCards": "Yeni",
  "study.reviewed": "Tekrarlanan",
  "study.card": "Kart",
  "study.showAnswer": "Cevabı göster",
  "study.hideAnswer": "Cevabı gizle",
  "study.hint": "İpucu",
  "study.recallFirst": "Önce hatırlamaya çalış, sonra açıp kendini dürüstçe puanla.",
  "study.restart": "Baştan başla",
  "study.shuffle": "Karıştır",
  "study.leitnerHint": "İlerleme bu cihazda ilaç bazında saklanır.",
  "study.emptyDeck":
    "Alıştırma kartı yok. İlaç Editörü'nden flashcard, mnemonik ya da sık hata ekleyin.",
  "study.grade.again": "Tekrar",
  "study.grade.hard": "Zor",
  "study.grade.good": "İyi",
  "study.grade.easy": "Kolay",
} as const;
type TrDict = typeof tr;

const en: Record<keyof TrDict, string> = {
  "nav.sections.identity.title": "Identity",
  "nav.sections.identity.description": "Core identifiers and naming for the drug entity.",
  "nav.sections.classification.title": "Classification",
  "nav.sections.classification.description": "Therapeutic and pharmacologic class relationships.",
  "nav.sections.indications.title": "Indications",
  "nav.sections.indications.description":
    "Link diseases this drug treats and add publish metadata for each TREATS edge.",
  "nav.sections.mechanism.title": "Mechanism",
  "nav.sections.mechanism.description":
    "Author the mechanism pathway on the canvas: add fragments, set roots from the Drug node, and connect steps.",
  "nav.sections.education.title": "Education",
  "nav.sections.education.description":
    "Student-facing summaries and board-exam pearls kept outside biomedical facts.",
  "nav.sections.evidence.title": "Evidence",
  "nav.sections.evidence.description":
    "Citations, provenance links, and validation gaps for this drug.",
  "nav.sections.provenance.title": "Provenance",
  "nav.sections.provenance.description":
    "Attribution and curation metadata required by validators.",
  "nav.sections.pharmacokinetics.title": "Pharmacokinetics",
  "nav.sections.pharmacokinetics.description":
    "Drug-intrinsic PK summary values. Write with units; cite via DailyMed link.",
  "nav.sections.safety.title": "Safety",
  "nav.sections.safety.description":
    "Black box warning and high-alert flags. Link FDA label evidence when flagged.",
  "nav.edited": "Edited",

  "topnav.search": "Search",
  "topnav.module": "Module",
  "topnav.activeModule": "Active module",
  "topnav.light": "Light",
  "topnav.dark": "Dark",
  "topnav.system": "System",
  "topnav.current": "Current",
  "topnav.language": "Language",

  "evidence.title": "Evidence",
  "evidence.subtitle":
    "Attached citations, validation gaps, and evidence quality for this drug package.",
  "evidence.attachExisting": "Attach existing",
  "evidence.createEvidence": "Create evidence",
  "evidence.attached": "Attached",
  "evidence.missing": "Missing",
  "evidence.missingHintNone": "No gaps reported",
  "evidence.missingHintSome": "From validation dry-run",
  "evidence.avgQuality": "Avg. quality",
  "evidence.attachedEvidence": "Attached evidence",
  "evidence.attachedEvidenceHint": "Evidence nodes linked to this drug through the public API.",
  "evidence.noEvidence": "No evidence attached",
  "evidence.noEvidenceHint":
    "Attach an existing evidence record or create a new structural citation entry.",
  "evidence.missingEvidence": "Missing evidence",
  "evidence.missingEvidenceHint":
    "Validation issues that reference missing or insufficient evidence.",
  "evidence.noMissing": "No missing-evidence issues reported by the latest validation dry-run.",
  "evidence.searchTitle": "Attach existing evidence",
  "evidence.searchHint": "Search the evidence catalog and link a record to this drug.",
  "evidence.searchPlaceholder": "Search by title or ID",
  "evidence.searchEmpty": "Search to find evidence records to attach.",
  "evidence.attachedLabel": "Attached",
  "evidence.attachLabel": "Attach",
  "evidence.createTitle": "Create evidence",
  "evidence.createHint":
    "Create a structural evidence record and attach it to this drug. No biomedical assertions are inferred.",
  "evidence.fieldTitle": "Title",
  "evidence.fieldTitlePlaceholder": "Citation or source title",
  "evidence.fieldType": "Evidence type",
  "evidence.fieldQuality": "Quality score (0–1)",
  "evidence.fieldYear": "Year (optional)",
  "evidence.fieldAuthors": "Authors (comma-separated)",
  "evidence.fieldJournal": "Journal / source",
  "evidence.fieldJournalPlaceholder": "Journal or regulator",
  "evidence.fieldSupportsClaim": "Supports claim",
  "evidence.fieldSupportsClaimPlaceholder": "What clinical assertion does this support?",
  "evidence.fieldExtract": "Extract",
  "evidence.fieldExtractPlaceholder": "Relevant quote or summary from the source",
  "evidence.fieldLinkIndication": "Link to indication (optional)",
  "evidence.fieldLinkIndicationNone": "Don't link — select later from the indication card",
  "evidence.cancel": "Cancel",
  "evidence.createAndAttach": "Create and attach",

  "treats.clinicalExplanation": "Clinical explanation",
  "treats.clinicalExplanationPlaceholder": "Why does this drug treat this condition?",
  "treats.clinicalExplanationHint":
    "Publish requires a clinical rationale, confidence metadata, and evidence level on each TREATS edge. Use expert consensus when you attest the link in Provenance without a separate citation.",
  "treats.confidence": "Confidence score (0–1)",
  "treats.evidenceLevel": "Evidence level",
  "treats.attestationWarning":
    "Expert consensus requires curator attestation in the Provenance section, or attach supporting evidence below.",
  "treats.statusReady": "Ready",
  "treats.statusPartial": "Partial",
  "treats.statusMissing": "Missing",
  "treats.supportingEvidence": "Supporting evidence (optional for expert consensus + attestation)",
  "treats.supportingEvidenceHint":
    "Link citations already attached to this drug. Selected records are written to the TREATS edge as evidence_ids and mirrored as SUPPORTED_BY rows for publish validation (FG-C012).",
  "treats.noEvidenceYet":
    "No evidence attached to this drug yet. Attach records in the Evidence section, then return here to link them to this indication.",
  "treats.quickCreateTitle": "Quick create and link evidence",
  "treats.quickCreateHint":
    "Title and type are enough — the record is created, attached to the drug, and linked to this indication.",
  "treats.quickCreatePlaceholder": "Citation or source title",
  "treats.quickCreateButton": "Create and link",
  "treats.indicationMetadata": "Indication metadata",

  "wizard.title": "Publish wizard",
  "wizard.confirm": "Confirm action",
  "wizard.result": "Workflow update",
  "wizard.goToSection": "Go to section",
  "wizard.ready": "Ready",
  "wizard.blocked": "Blocked",
  "wizard.pending": "Pending",
  "wizard.unknown": "Unknown",
  "wizard.stepDraft": "Draft",
  "wizard.stepDraftHint": "Edit and validate the package",
  "wizard.stepReview": "Review",
  "wizard.stepReviewHint": "Submitted for curator review",
  "wizard.stepApproved": "Approved",
  "wizard.stepApprovedHint": "Ready to publish to the graph",
  "wizard.stepPublished": "Published",
  "wizard.stepPublishedHint": "Live in the knowledge graph",
  "wizard.refreshValidation": "Refresh validation",

  "validation.blockingErrors": "Blocking errors",
  "validation.evidenceBlockers": "Evidence blockers",
  "validation.missingEvidence": "Missing evidence",
  "validation.lowConfidence": "Low-confidence",
  "validation.evidenceWarnings": "Evidence warnings",
  "validation.graphFailures": "Graph failures",
  "validation.graphPending": "Graph pending",
  "validation.publishReady": "Publish ready",
  "validation.yes": "Yes",
  "validation.no": "No",

  "fallback.draftBadge": "Draft / offline sample — no curator approval",
  "fallback.variableEmpty": "Awaiting curator input",

  "mechanism.fragmentType": "Fragment level",
  "mechanism.direction": "Direction",
  "mechanism.newFragment": "New fragment",
  "mechanism.newFragmentHint":
    "Registers a MechanismFragment in the curator catalog for pathway authoring.",
  "mechanism.label": "Label",
  "mechanism.slug": "Slug",
  "mechanism.description": "Description",
  "mechanism.descriptionPlaceholder": "Optional curator note",
  "mechanism.create": "Create fragment",
  "mechanism.creating": "Creating…",
  "mechanism.levelGuideTitle": "Which level?",
  "mechanism.level.molecular": "molecular — receptor/enzyme binding (e.g. ACE inhibition)",
  "mechanism.level.cellular": "cellular — intracellular signal (e.g. cAMP decrease)",
  "mechanism.level.tissue": "tissue — tissue response (e.g. vascular smooth muscle relaxation)",
  "mechanism.level.organ": "organ — organ output (e.g. reduced aldosterone)",
  "mechanism.level.clinical": "clinical — patient-level outcome (e.g. blood pressure drop)",

  "safety.hasBlackBox": "Has black box warning",
  "safety.blackBoxText": "Black box text",
  "safety.blackBoxPlaceholder": "Transcribe the FDA label warning verbatim",
  "safety.isHighAlert": "High-alert drug",
  "safety.fdaEvidenceHint": "When flagged, link FDA label evidence.",

  "pk.halfLife": "Half-life",
  "pk.halfLifePlaceholder": "e.g. 3–7 h",
  "pk.bioavailability": "Bioavailability",
  "pk.bioavailabilityPlaceholder": "e.g. 50%",
  "pk.proteinBinding": "Protein binding",
  "pk.proteinBindingPlaceholder": "e.g. 12%",
  "pk.onset": "Onset",
  "pk.onsetPlaceholder": "e.g. 1–2 h",
  "pk.duration": "Duration",
  "pk.durationPlaceholder": "e.g. 24 h",
  "pk.importedFrom": "Source (DailyMed URL)",
  "pk.importedFromPlaceholder": "https://dailymed.nlm.nih.gov/…",
  "pk.importedFromHint": "FDA label / BNF link the values were taken from.",

  "provenance.attestationHint": "Check when a human curator attests the content.",

  "common.retry": "Retry",
  "common.save": "Save",
  "common.cancel": "Cancel",

  "presentation.presentationView": "Presentation",
  "presentation.curatorView": "Curator view",
  "presentation.hint": "Hide technical panels for readers",

  "knowledge.mechanisms.eyebrow": "Mechanism layer",
  "knowledge.mechanisms.title": "Mechanisms",
  "knowledge.mechanisms.description":
    "Pick a drug to inspect its published mechanism DAG and Explain preview.",
  "knowledge.mechanisms.editPathway": "Edit pathway",
  "knowledge.mechanisms.openBrowser": "Open drug browser",
  "knowledge.mechanisms.emptyReader": "No published mechanism for this drug yet.",
  "knowledge.mechanisms.emptyCurator":
    "Author roots and pathway steps in the Drug Editor, then publish.",
  "knowledge.graph.eyebrow": "Graph explorer",
  "knowledge.graph.title": "Graph Explorer",
  "knowledge.graph.description": "Pick a drug to inspect its published Neo4j neighborhood.",
  "knowledge.graph.editPathway": "Open editor",
  "knowledge.graph.openBrowser": "Open drug browser",
  "knowledge.graph.emptyReader": "No published graph neighborhood for this drug yet.",
  "knowledge.graph.emptyCurator":
    "Author relationships in the Drug Editor, publish, then raise the depth.",
  "knowledge.pickDrug": "Pick a drug",

  "error.unknown": "Request failed.",
  "error.unreachable": "Knowledge API unreachable",
  "error.loginRequired": "Sign-in required",
  "error.loginHint":
    "This view needs an authenticated session. Public preview is disabled by the server.",
  "error.noSample":
    "No sample data is shown instead — check that the API is running and reachable, then retry.",
  "error.signIn": "Sign in",

  "study.practice": "Practice",
  "study.list": "List",
  "study.mastered": "Mastered",
  "study.learning": "Learning",
  "study.newCards": "New",
  "study.reviewed": "Reviewed",
  "study.card": "Card",
  "study.showAnswer": "Show answer",
  "study.hideAnswer": "Hide answer",
  "study.hint": "Hint",
  "study.recallFirst": "Recall first, then reveal and grade yourself honestly.",
  "study.restart": "Restart",
  "study.shuffle": "Shuffle",
  "study.leitnerHint": "Progress is saved on this device per drug.",
  "study.emptyDeck":
    "No drillable cards yet. Add flashcards, mnemonics, or common mistakes in the Drug Editor.",
  "study.grade.again": "Again",
  "study.grade.hard": "Hard",
  "study.grade.good": "Good",
  "study.grade.easy": "Easy",
};

export type DictionaryKey = keyof TrDict;

const dictionaries: Record<StudioLocale, Record<DictionaryKey, string>> = { tr, en };

export function getDictionary(locale: StudioLocale): Record<DictionaryKey, string> {
  return dictionaries[locale] ?? dictionaries[DEFAULT_STUDIO_LOCALE];
}

/** Translate with English fallback: `t("wizard.title", lang, "Publish wizard")`. */
export function translate(key: string, locale: StudioLocale, fallback?: string): string {
  const dict = getDictionary(locale);
  const hit = (dict as Record<string, string>)[key];
  if (hit) return hit;
  if (locale !== "en") {
    const enHit = (dictionaries.en as Record<string, string>)[key];
    if (enHit) return enHit;
  }
  return fallback ?? key;
}

/**
 * Curator guidance per ontology constraint code.
 * The FG-C code itself is always preserved in the UI; this adds the human sentence.
 */
const CONSTRAINT_HINTS: Record<string, { tr: string; en: string }> = {
  "FG-C012": {
    tr: "Bu endikasyona kanıt bağlayın ya da uzman görüşü + küratör onayı işaretleyin.",
    en: "Link evidence to this indication, or use expert consensus + curator attestation.",
  },
  "FG-C019": {
    tr: "Güven puanı (0–1) ve kanıt düzeyi eksik.",
    en: "Confidence score (0–1) and evidence level are missing.",
  },
  "FG-C020": {
    tr: "Her ilişkiye 1 cümle klinik gerekçe yazın.",
    en: "Write a one-sentence clinical rationale for each edge.",
  },
  "FG-C008": {
    tr: "Yayınlanan ilacın en az bir ilaç sınıfı (IS_A ya da BELONGS_TO) olmalı.",
    en: "A published drug needs at least one drug class (IS_A or BELONGS_TO).",
  },
  "FG-C009": {
    tr: "Yayınlanan ilacın en az bir endikasyonu (TREATS ya da PREVENTS) olmalı.",
    en: "A published drug needs at least one indication (TREATS or PREVENTS).",
  },
  "FG-C015": {
    tr: "Yayınlanan ilacın mekanizma kökü (HAS_MECHANISM_ROOT) olmalı.",
    en: "A published drug needs a mechanism root (HAS_MECHANISM_ROOT).",
  },
  "FG-C003": {
    tr: "Mekanizma çizgileri döngü oluşturmamalı.",
    en: "Mechanism edges must stay acyclic.",
  },
  "FG-C028": {
    tr: "Yapay zekâ taslağı küratör onayı olmadan yayınlanamaz.",
    en: "AI-assisted drafts cannot be published without curator attestation.",
  },
};

export function getConstraintHint(
  constraintId: string | null | undefined,
  locale: StudioLocale
): string | null {
  if (!constraintId) return null;
  const hit = CONSTRAINT_HINTS[constraintId];
  if (!hit) return null;
  return locale === "tr" ? hit.tr : hit.en;
}
