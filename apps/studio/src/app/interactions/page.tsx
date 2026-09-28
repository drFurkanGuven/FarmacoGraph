"use client";

import { useEffect, useState } from "react";
import {
  AlertCircle,
  AlertTriangle,
  CheckCircle2,
  Info,
  Plus,
  Search,
  ShieldAlert,
  Sparkles,
  Stethoscope,
  Trash2,
  X,
} from "lucide-react";
import { apiClient, ApiError } from "@/lib/api";
import { ApiErrorPanel } from "@/components/ui/api-error-panel";
import { useLanguage } from "@/lib/i18n/context";
import { useUIMode } from "@/lib/ui-mode/context";

interface InteractionItem {
  drug_a_id: string;
  drug_b_id: string;
  severity: "contraindicated" | "major" | "moderate" | "minor" | "beneficial_synergy";
  title: string;
  mechanism_explanation: string;
  clinical_action: string;
  pathway_overlap: string[];
  source?: "curator";
  evidence_ids?: string[];
}

interface CheckedDrug {
  id: string;
  slug: string;
  label?: string;
}

export default function InteractionsPage() {
  const [availableDrugs, setAvailableDrugs] = useState<Array<{ slug: string; name: string }>>([]);
  const [selectedSlugs, setSelectedSlugs] = useState<string[]>([]);
  const [checkedDrugs, setCheckedDrugs] = useState<CheckedDrug[]>([]);
  const [searchQuery, setSearchQuery] = useState("");
  const [loading, setLoading] = useState(false);
  const [listError, setListError] = useState<string | null>(null);
  const [error, setError] = useState<unknown>(null);
  const [results, setResults] = useState<InteractionItem[] | null>(null);
  const [usedFallback, setUsedFallback] = useState(false);
  const { isSimple } = useUIMode();
  const { t } = useLanguage();

  // Public drug list — knowledge:read, no curator scope needed.
  useEffect(() => {
    async function loadDrugs() {
      try {
        const response = await apiClient.drugs({ limit: 200 });
        const items = (response.data ?? []).map((d) => ({
          slug: String(d.slug),
          name: String(d.label || d.slug),
        }));
        setAvailableDrugs(items);
        setSelectedSlugs((current) =>
          current.length > 0 ? current : items.slice(0, 2).map((item) => item.slug)
        );
      } catch (err) {
        setListError(err instanceof ApiError ? err.message : "Drug list could not be loaded.");
      }
    }
    loadDrugs();
  }, []);

  const toggleDrug = (slug: string) => {
    setSelectedSlugs((prev) =>
      prev.includes(slug) ? prev.filter((s) => s !== slug) : [...prev, slug]
    );
  };

  const getDrugName = (id: string) => {
    const found = checkedDrugs.find((d) => d.id.toLowerCase() === id.toLowerCase());
    if (found) return found.label || found.slug;
    const matchAvailable = availableDrugs.find((d) => d.slug.toLowerCase() === id.toLowerCase());
    if (matchAvailable) return matchAvailable.name;
    return id.length > 8 ? id.substring(0, 8) + "..." : id;
  };

  const handleCheck = async () => {
    if (selectedSlugs.length < 2) {
      setError("Please select at least 2 drugs to evaluate pairwise interactions.");
      return;
    }
    setLoading(true);
    setError(null);
    try {
      const response = await apiClient.checkInteractions({ slugs: selectedSlugs });
      setResults(response.data.interactions);
      setCheckedDrugs(
        (response.data.checked_drugs || []).map((d: { id?: string | unknown; slug?: string | unknown; label?: string | unknown }) => ({
          id: String(d.id || ""),
          slug: String(d.slug || ""),
          label: String(d.label || d.slug || ""),
        }))
      );
      setUsedFallback(response.meta?.provenance === "staging-fallback");
    } catch (error) {
      // No offline mock: an unreachable API must surface as an error, never as
      // fabricated clinical guidance.
      setResults(null);
      setUsedFallback(false);
      setError(error);
    } finally {
      setLoading(false);
    }
  };

  const getSeverityBadge = (severity: string) => {
    switch (severity) {
      case "contraindicated":
        return {
          bg: "bg-red-500/10 text-red-500 border-red-500/30",
          icon: ShieldAlert,
          label: "CONTRAINDICATED",
        };
      case "major":
        return {
          bg: "bg-orange-500/10 text-orange-500 border-orange-500/30",
          icon: AlertTriangle,
          label: "MAJOR RISK",
        };
      case "moderate":
        return {
          bg: "bg-yellow-500/10 text-yellow-500 border-yellow-500/30",
          icon: AlertCircle,
          label: "MODERATE",
        };
      case "beneficial_synergy":
        return {
          bg: "bg-emerald-500/10 text-emerald-500 border-emerald-500/30",
          icon: Sparkles,
          label: "BENEFICIAL SYNERGY (GDMT)",
        };
      default:
        return {
          bg: "bg-blue-500/10 text-blue-500 border-blue-500/30",
          icon: Info,
          label: "MINOR / INFORMATIONAL",
        };
    }
  };

  const filteredUnselected = availableDrugs.filter(
    (d) =>
      !selectedSlugs.includes(d.slug) &&
      (d.name.toLowerCase().includes(searchQuery.toLowerCase()) ||
        d.slug.toLowerCase().includes(searchQuery.toLowerCase()))
  );

  return (
    <div className="max-w-5xl mx-auto p-6 space-y-8">
      {/* Header */}
      <div>
        <div className="inline-flex items-center gap-2 px-3 py-1 rounded-full text-xs font-medium bg-primary/10 text-primary mb-3">
          <Stethoscope className="w-3.5 h-3.5" />
          {isSimple ? "İlaç Etkileşim Kontrolü" : "Clinical Pharmacologic Intelligence"}
          {usedFallback && results && (
            <span className="text-[10px] text-amber-600 font-bold ml-1">
              • {t("fallback.draftBadge", "Draft / offline sample — no curator approval")}
            </span>
          )}
        </div>
        {isSimple ? (
          <>
            <h1 className="text-2xl font-bold tracking-tight">İlaç Etkileşim Kontrolü</h1>
            <p className="text-muted-foreground mt-1 text-sm">
              İlaçlarınız arasındaki etkileşimleri kontrol edin. Sonuçları doktorunuzla paylaşın.
            </p>
          </>
        ) : (
          <>
            <h1 className="text-3xl font-bold tracking-tight">Drug Interaction & Synergy Analyzer</h1>
            <p className="text-muted-foreground mt-1 text-sm">
              Küratör onaylı biyomedikal kanıtlara dayalı ilaç-ilaç etkileşim analizi.
            </p>
          </>
        )}
      </div>

      {/* Drug Selection Card */}
      <div className="rounded-xl border bg-card p-6 shadow-sm space-y-5">
        <div className="flex items-center justify-between">
          <h2 className="text-sm font-semibold uppercase tracking-wider text-muted-foreground">
            Selected Drugs to Evaluate ({selectedSlugs.length})
          </h2>
          {selectedSlugs.length > 0 && (
            <button
              onClick={() => setSelectedSlugs([])}
              className="text-xs text-muted-foreground hover:text-foreground inline-flex items-center gap-1 cursor-pointer"
            >
              <Trash2 className="w-3.5 h-3.5" /> Clear All
            </button>
          )}
        </div>

        {/* Selected Tags */}
        <div className="flex flex-wrap gap-2 min-h-10 p-2 rounded-lg bg-muted/30 border border-dashed items-center">
          {selectedSlugs.length === 0 ? (
            <span className="text-xs text-muted-foreground italic px-2">
              No drugs selected. Search and add drugs below.
            </span>
          ) : (
            selectedSlugs.map((slug) => {
              const drugName = availableDrugs.find((d) => d.slug === slug)?.name || slug;
              return (
                <span
                  key={slug}
                  className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full bg-primary/10 text-primary font-medium text-xs border border-primary/20 shadow-2xs"
                >
                  {drugName}
                  <button
                    onClick={() => toggleDrug(slug)}
                    className="hover:text-red-500 transition-colors cursor-pointer"
                  >
                    <X className="w-3.5 h-3.5" />
                  </button>
                </span>
              );
            })
          )}
        </div>
        {listError ? <ApiErrorPanel error={listError} /> : null}
        <div className="space-y-2 pt-2">
          <label className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">
            Search &amp; Add from Knowledge Graph ({availableDrugs.length} drugs)
          </label>
          <div className="relative">
            <Search className="w-4 h-4 absolute left-3 top-1/2 -translate-y-1/2 text-muted-foreground" />
            <input
              type="text"
              placeholder="Search drug by name or slug (e.g. ramipril, spironolactone, metoprolol)..."
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              className="w-full pl-9 pr-4 py-2 text-xs rounded-lg border bg-background focus:outline-none focus:ring-2 focus:ring-primary"
            />
          </div>

          <div className="flex flex-wrap gap-1.5 pt-1 max-h-32 overflow-y-auto">
            {filteredUnselected.slice(0, 10).map((drug) => (
              <button
                key={drug.slug}
                onClick={() => toggleDrug(drug.slug)}
                className="inline-flex items-center gap-1 px-2.5 py-1 rounded-md text-xs border bg-background hover:bg-muted text-foreground transition-colors cursor-pointer"
              >
                <Plus className="w-3 h-3 text-muted-foreground" />
                {drug.name}
              </button>
            ))}
          </div>
        </div>

        {error ? <ApiErrorPanel error={error} /> : null}

        <div className="flex items-center justify-end pt-3 border-t">
          <button
            onClick={handleCheck}
            disabled={loading || selectedSlugs.length < 2}
            className="px-5 py-2.5 rounded-lg bg-primary text-primary-foreground font-medium text-sm hover:opacity-90 transition-opacity disabled:opacity-50 cursor-pointer shadow-sm"
          >
            {loading ? "Analyzing Graph Traversal..." : "Analyze Interactions"}
          </button>
        </div>
      </div>

      {/* Results Section */}
      {results && (
        <div className="space-y-4">
          <div className="flex items-center justify-between">
            <h2 className="text-lg font-semibold tracking-tight">
              {isSimple
                ? `Sonuçlar (${results.length} etkileşim bulundu)`
                : `Analysis Results (${results.length} interaction${results.length === 1 ? "" : "s"} identified)`}
            </h2>
            {!isSimple && (
              <div className="text-xs text-muted-foreground">
                Doğrulanmış küratör kayıtları
              </div>
            )}
          </div>

          {results.length === 0 ? (
            isSimple ? (
              <div className="p-8 rounded-xl border border-emerald-500/30 bg-emerald-500/5 text-center space-y-3">
                <div className="w-12 h-12 rounded-full bg-emerald-500/10 flex items-center justify-center mx-auto text-emerald-600 dark:text-emerald-400">
                  <CheckCircle2 className="w-7 h-7" />
                </div>
                <div className="font-semibold text-lg text-foreground">
                  Bilinen Bir Etkileşim Bulunamadı
                </div>
                <p className="text-sm text-muted-foreground max-w-md mx-auto leading-relaxed">
                  Seçtiğiniz ilaçlar arasında sistemimizde kayıtlı bir etkileşim bulunmuyor.
                </p>
                <div className="p-4 bg-amber-500/10 rounded-lg border border-amber-500/20 max-w-md mx-auto text-left space-y-2">
                  <div className="text-sm font-semibold text-amber-700 dark:text-amber-400 flex items-center gap-2">
                    <ShieldAlert className="w-4 h-4 shrink-0" />
                    Önemli Uyarı
                  </div>
                  <p className="text-sm text-muted-foreground leading-relaxed">
                    Burada bilgi bulunmaması, ilaçların birlikte güvenli olduğu anlamına gelmez.
                    İlaçlarınızı kullanmadan önce mutlaka doktorunuza veya eczacınıza danışın.
                  </p>
                </div>
              </div>
            ) : (
              <div className="p-8 rounded-xl border border-amber-500/30 bg-amber-500/5 text-center space-y-3">
                <div className="w-10 h-10 rounded-full bg-amber-500/10 flex items-center justify-center mx-auto text-amber-600 dark:text-amber-400">
                  <AlertCircle className="w-6 h-6" />
                </div>
                <div className="font-semibold text-base text-foreground">
                  Küratör Tarafından Doğrulanmış Kayıt Bulunmuyor
                </div>
                <p className="text-xs text-muted-foreground max-w-lg mx-auto leading-relaxed">
                  Seçilen ilaç çiftleri arasında bilgi grafında doğrulanmış bir etkileşim tespit edilmedi.
                </p>
                <div className="p-3 bg-background/80 rounded-lg border border-amber-500/20 max-w-lg mx-auto text-left space-y-1 shadow-2xs">
                  <div className="text-[11px] font-semibold text-amber-700 dark:text-amber-400 flex items-center gap-1.5">
                    <ShieldAlert className="w-3.5 h-3.5 shrink-0" />
                    Klinik Güvenlik Uyarısı: Bilgi Yokluğu ≠ Güvenlik
                  </div>
                  <p className="text-[11px] text-muted-foreground leading-normal">
                    Kayıt bulunamaması kombinasyonun farmakolojik olarak kesinlikle güvenli olduğu anlamına gelmez. Bilgi grafı henüz tüm literatürü kapsamamaktadır; klinik karar vermeden önce mutlaka güncel resmi ürün özetlerine (KÜB/KT), laboratuvar değerlerine ve klinik kılavuzlara başvurunuz.
                  </p>
                </div>
              </div>
            )
          ) : (
            <div className="space-y-4">
              {results.map((item, idx) => {
                const badge = getSeverityBadge(item.severity);
                const BadgeIcon = badge.icon;

                if (isSimple) {
                  return (
                    <div
                      key={idx}
                      className="rounded-xl border bg-card p-5 shadow-xs space-y-3"
                    >
                      <div className="flex items-start justify-between gap-4">
                        <div className="space-y-1">
                          <div className="flex items-center gap-2 flex-wrap">
                            <span className="text-sm font-medium text-foreground">
                              {getDrugName(item.drug_a_id)} + {getDrugName(item.drug_b_id)}
                            </span>
                          </div>
                          <h3 className="text-base font-semibold text-foreground mt-1">
                            {item.title}
                          </h3>
                        </div>
                        <div
                          className={`inline-flex items-center gap-1.5 px-3 py-1 rounded-full text-xs font-semibold border shrink-0 ${badge.bg}`}
                        >
                          <BadgeIcon className="w-3.5 h-3.5" />
                          {badge.label}
                        </div>
                      </div>

                      <div className="bg-muted/40 rounded-lg p-4 text-sm leading-relaxed">
                        <p className="text-muted-foreground">{item.mechanism_explanation}</p>
                      </div>

                      <div className="border-t pt-3 text-sm flex items-start gap-2">
                        <Stethoscope className="w-4 h-4 text-primary shrink-0 mt-0.5" />
                        <div>
                          <span className="font-semibold text-foreground">Ne yapmalısınız: </span>
                          <span className="text-muted-foreground">{item.clinical_action}</span>
                        </div>
                      </div>
                    </div>
                  );
                }

                return (
                  <div
                    key={idx}
                    className="rounded-xl border bg-card p-5 shadow-xs transition-shadow hover:shadow-md space-y-4"
                  >
                    <div className="flex items-start justify-between gap-4">
                      <div className="space-y-1">
                        <div className="flex items-center gap-2 flex-wrap">
                          <span className="text-xs font-semibold text-muted-foreground uppercase tracking-wider">
                            {getDrugName(item.drug_a_id)} + {getDrugName(item.drug_b_id)}
                          </span>
                          <span className="inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full text-[10px] font-semibold bg-emerald-500/10 text-emerald-600 dark:text-emerald-400 border border-emerald-500/30">
                            <CheckCircle2 className="w-3 h-3" /> Doğrulanmış Küratör Kaydı
                          </span>
                        </div>
                        <h3 className="text-base font-semibold text-foreground mt-0.5">
                          {item.title}
                        </h3>
                      </div>
                      <div
                        className={`inline-flex items-center gap-1.5 px-3 py-1 rounded-full text-xs font-semibold border shrink-0 ${badge.bg}`}
                      >
                        <BadgeIcon className="w-3.5 h-3.5" />
                        {badge.label}
                      </div>
                    </div>

                    <div className="bg-muted/40 rounded-lg p-3 text-xs leading-relaxed space-y-1">
                      <div className="font-semibold text-foreground">
                        Pharmacological Mechanism:
                      </div>
                      <p className="text-muted-foreground">{item.mechanism_explanation}</p>
                    </div>

                    {item.evidence_ids && item.evidence_ids.length > 0 && (
                      <div className="flex items-center gap-2 flex-wrap text-xs pt-1">
                        <span className="font-semibold text-foreground text-[11px]">
                          Doğrulayıcı Kanıtlar (Evidence IDs):
                        </span>
                        {item.evidence_ids.map((ev, evIdx) => (
                          <span
                            key={evIdx}
                            className="px-2 py-0.5 rounded bg-primary/10 text-primary font-mono text-[10px] border border-primary/20"
                          >
                            {ev}
                          </span>
                        ))}
                      </div>
                    )}

                    {item.pathway_overlap && item.pathway_overlap.length > 0 && (
                      <div className="flex items-center gap-2 flex-wrap">
                        <span className="text-[11px] font-medium text-muted-foreground">
                          Overlapping Graph Pathways:
                        </span>
                        {item.pathway_overlap.map((p, pIdx) => (
                          <span
                            key={pIdx}
                            className="px-2 py-0.5 rounded text-[10px] font-mono bg-secondary text-secondary-foreground"
                          >
                            {p}
                          </span>
                        ))}
                      </div>
                    )}

                    <div className="border-t pt-3 text-xs flex items-start gap-2">
                      <Stethoscope className="w-4 h-4 text-primary shrink-0 mt-0.5" />
                      <div>
                        <span className="font-semibold text-foreground">
                          Recommended Clinical Action:{" "}
                        </span>
                        <span className="text-muted-foreground">{item.clinical_action}</span>
                      </div>
                    </div>
                  </div>
                );
              })}
            </div>
          )}
        </div>
      )}
    </div>
  );
}
