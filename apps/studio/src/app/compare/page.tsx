"use client";

import { useEffect, useMemo, useState } from "react";
import { ArrowLeftRight, RefreshCw, ShieldAlert } from "lucide-react";
import { apiClient } from "@/lib/api";
import { ApiErrorPanel } from "@/components/ui/api-error-panel";
import { useLanguage } from "@/lib/i18n/context";
import { useUIMode } from "@/lib/ui-mode/context";

interface DrugOption {
  id: string;
  slug: string;
  name: string;
}

interface NameRef {
  id?: string;
  slug?: string;
  label?: string;
}

interface DimensionResult {
  status?: string;
  by_drug?: Record<string, unknown>;
  shared?: unknown;
}

interface CompareData {
  drug_ids?: string[];
  comparison?: Record<string, DimensionResult>;
}

const DIMENSIONS = ["classes", "indications", "mechanisms", "pharmacokinetics", "warnings"];

function names(value: unknown): string[] {
  if (!Array.isArray(value)) return [];
  return (value as NameRef[])
    .map((entry) => (typeof entry === "string" ? entry : String(entry.label ?? entry.slug ?? "")))
    .filter(Boolean);
}

function pkField(profile: Record<string, unknown> | undefined, key: string): string {
  if (!profile) return "—";
  const value = profile[key];
  if (Array.isArray(value)) return value.length > 0 ? value.map(String).join(", ") : "—";
  if (typeof value === "boolean") return value ? "Yes" : "No";
  return typeof value === "string" && value.trim() ? value : "—";
}

export default function ComparePage() {
  const { t } = useLanguage();
  const { isSimple } = useUIMode();
  const [options, setOptions] = useState<DrugOption[]>([]);
  const [drugA, setDrugA] = useState("");
  const [drugB, setDrugB] = useState("");
  const [data, setData] = useState<CompareData | null>(null);
  const [provenance, setProvenance] = useState<string | null>(null);
  const [datasetVersion, setDatasetVersion] = useState("unpublished");
  const [loadingList, setLoadingList] = useState(true);
  const [loadingCompare, setLoadingCompare] = useState(false);
  const [error, setError] = useState<unknown>(null);

  // Public drug list — knowledge:read, no curator scope needed.
  useEffect(() => {
    async function loadDrugs() {
      setLoadingList(true);
      try {
        const response = await apiClient.drugs({ limit: 100 });
        const items = (response.data ?? []).map((item) => ({
          id: String(item.id),
          slug: String(item.slug),
          name: String(item.label || item.slug),
        }));
        setOptions(items);
        setDrugA((current) => current || items[0]?.id || "");
        setDrugB((current) => current || items[1]?.id || items[0]?.id || "");
      } catch (err) {
        setError(err);
      } finally {
        setLoadingList(false);
      }
    }
    loadDrugs();
  }, []);

  // Real backend comparison — refetched whenever the selected drugs change.
  useEffect(() => {
    if (!drugA || !drugB) return;
    async function loadComparison() {
      setLoadingCompare(true);
      setError(null);
      try {
        const response = await apiClient.compare({
          drug_ids: [drugA, drugB],
          dimensions: DIMENSIONS,
        });
        setData((response.data ?? {}) as CompareData);
        setProvenance(
          typeof response.meta?.provenance === "string" ? response.meta.provenance : null
        );
        setDatasetVersion(String(response.meta?.dataset_version ?? "unpublished"));
      } catch (err) {
        setData(null);
        setError(err);
      } finally {
        setLoadingCompare(false);
      }
    }
    loadComparison();
  }, [drugA, drugB]);

  const nameOf = useMemo(() => {
    const map = new Map(options.map((item) => [item.id, item.name]));
    return (id: string) => map.get(id) ?? id.slice(0, 8);
  }, [options]);

  const comparison = data?.comparison ?? {};
  const unknownText = t("fallback.variableEmpty", "Awaiting curator input");

  const rows: Array<{ dimension: string; a: React.ReactNode; b: React.ReactNode }> = [
    {
      dimension: isSimple ? "İlaç Sınıfı" : "Class",
      a: <ListCell values={names(comparison.classes?.by_drug?.[drugA])} fallback={unknownText} />,
      b: <ListCell values={names(comparison.classes?.by_drug?.[drugB])} fallback={unknownText} />,
    },
    {
      dimension: isSimple ? "Kullanım Alanları" : "Primary Indications",
      a: (
        <ListCell values={names(comparison.indications?.by_drug?.[drugA])} fallback={unknownText} />
      ),
      b: (
        <ListCell values={names(comparison.indications?.by_drug?.[drugB])} fallback={unknownText} />
      ),
    },
    {
      dimension: isSimple ? "Etki Mekanizması" : "Mechanism Roots",
      a: (
        <ListCell values={names(comparison.mechanisms?.by_drug?.[drugA])} fallback={unknownText} />
      ),
      b: (
        <ListCell values={names(comparison.mechanisms?.by_drug?.[drugB])} fallback={unknownText} />
      ),
    },
    {
      dimension: isSimple ? "Yarı Ömür" : "Elimination Half-Life",
      a: (
        <MonoCell
          value={pkField(
            comparison.pharmacokinetics?.by_drug?.[drugA] as Record<string, unknown>,
            "half_life"
          )}
        />
      ),
      b: (
        <MonoCell
          value={pkField(
            comparison.pharmacokinetics?.by_drug?.[drugB] as Record<string, unknown>,
            "half_life"
          )}
        />
      ),
    },
    {
      dimension: isSimple ? "Biyoyararlanım" : "Oral Bioavailability",
      a: (
        <MonoCell
          value={pkField(
            comparison.pharmacokinetics?.by_drug?.[drugA] as Record<string, unknown>,
            "bioavailability"
          )}
        />
      ),
      b: (
        <MonoCell
          value={pkField(
            comparison.pharmacokinetics?.by_drug?.[drugB] as Record<string, unknown>,
            "bioavailability"
          )}
        />
      ),
    },
    {
      dimension: isSimple ? "Protein Bağlanması" : "Plasma Protein Binding",
      a: (
        <MonoCell
          value={pkField(
            comparison.pharmacokinetics?.by_drug?.[drugA] as Record<string, unknown>,
            "protein_binding"
          )}
        />
      ),
      b: (
        <MonoCell
          value={pkField(
            comparison.pharmacokinetics?.by_drug?.[drugB] as Record<string, unknown>,
            "protein_binding"
          )}
        />
      ),
    },
    {
      dimension: isSimple ? "Kara Kutu Uyarısı" : "Black Box Warning",
      a: (
        <WarningCell
          profile={comparison.warnings?.by_drug?.[drugA] as Record<string, unknown>}
          fallback={unknownText}
        />
      ),
      b: (
        <WarningCell
          profile={comparison.warnings?.by_drug?.[drugB] as Record<string, unknown>}
          fallback={unknownText}
        />
      ),
    },
  ];

  return (
    <div className="max-w-5xl mx-auto p-6 space-y-8">
      {/* Header */}
      <div>
        <div className="inline-flex items-center gap-2 px-3 py-1 rounded-full text-xs font-medium bg-primary/10 text-primary mb-3">
          <ArrowLeftRight className="w-3.5 h-3.5" />
          {isSimple ? "İlaç Karşılaştırma" : "Comparative Pharmacology"}
          {provenance === "staging-fallback" && (
            <span className="text-[10px] text-amber-600 font-bold ml-1">
              • {t("fallback.draftBadge", "Draft / offline sample — no curator approval")}
            </span>
          )}
        </div>
        <h1 className="text-3xl font-bold tracking-tight">
          {isSimple ? "İki İlacı Karşılaştırın" : "Side-by-Side Drug Comparator"}
        </h1>
        <p className="text-muted-foreground mt-1 text-sm">
          {isSimple
            ? "İki ilacın etki mekanizmalarını, farmakokinetik özelliklerini ve yan etkilerini karşılaştırın."
            : "Contrast mechanisms of action, pharmacokinetics, molecular targets, and clinical nuances across cardiovascular agents. All values come from the comparison API."}
        </p>
        {!isSimple && (
          <p className="text-muted-foreground text-xs mt-1 font-mono">
            Source:{" "}
            {provenance === "staging-fallback" ? "curator staging (unpublished)" : "published graph"}{" "}
            · version {datasetVersion}
          </p>
        )}
      </div>

      {loadingList ? (
        <LoadingState label="Loading drug catalog..." />
      ) : error && options.length === 0 ? (
        <ApiErrorPanel error={error} />
      ) : options.length === 0 ? (
        <div className="rounded-xl border p-6 text-sm text-muted-foreground">
          No drugs in the catalog yet. Publish knowledge via Studio workflows.
        </div>
      ) : (
        <>
          {/* Selectors */}
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <DrugSelect
              label={isSimple ? "Birinci İlaç" : "Reference Agent (Drug A)"}
              value={drugA}
              options={options}
              onChange={setDrugA}
            />
            <DrugSelect
              label={isSimple ? "İkinci İlaç" : "Comparative Agent (Drug B)"}
              value={drugB}
              options={options}
              onChange={setDrugB}
            />
          </div>

          {loadingCompare ? (
            <LoadingState label="Comparing via knowledge graph..." />
          ) : error ? (
            <ApiErrorPanel error={error} />
          ) : !data ? (
            <div className="rounded-xl border p-6 text-sm text-muted-foreground">{unknownText}</div>
          ) : (
            <div className="rounded-xl border bg-card overflow-hidden shadow-xs">
              <table className="w-full text-left border-collapse">
                <thead>
                  <tr className="border-b bg-muted/50">
                    <th className="p-4 text-xs font-semibold uppercase tracking-wider text-muted-foreground w-1/3">
                      {isSimple ? "Özellik" : "Pharmacological Dimension"}
                    </th>
                    <th className="p-4 text-sm font-bold text-foreground w-1/3 border-l">
                      {nameOf(drugA)}
                    </th>
                    <th className="p-4 text-sm font-bold text-foreground w-1/3 border-l">
                      {nameOf(drugB)}
                    </th>
                  </tr>
                </thead>
                <tbody className="divide-y text-xs">
                  {rows.map((row) => (
                    <tr key={row.dimension}>
                      <td className="p-4 font-semibold text-muted-foreground bg-muted/20">
                        {row.dimension}
                      </td>
                      <td className="p-4 font-medium border-l">{row.a}</td>
                      <td className="p-4 font-medium border-l">{row.b}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </>
      )}
    </div>
  );
}

function DrugSelect({
  label,
  value,
  options,
  onChange,
}: {
  label: string;
  value: string;
  options: DrugOption[];
  onChange: (id: string) => void;
}) {
  return (
    <div className="p-4 rounded-xl border bg-card space-y-2">
      <label className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">
        {label}
      </label>
      <select
        value={value}
        onChange={(e) => onChange(e.target.value)}
        className="w-full px-3 py-2 rounded-lg border bg-background text-sm font-medium focus:outline-none focus:ring-2 focus:ring-primary"
      >
        {options.map((d) => (
          <option key={d.id} value={d.id}>
            {d.name}
          </option>
        ))}
      </select>
    </div>
  );
}

function ListCell({ values, fallback }: { values: string[]; fallback: string }) {
  if (values.length === 0) return <span className="text-muted-foreground">{fallback}</span>;
  return (
    <div className="flex flex-wrap gap-1">
      {values.map((value, idx) => (
        <span
          key={idx}
          className="px-2 py-0.5 rounded bg-secondary text-secondary-foreground text-[11px]"
        >
          {value}
        </span>
      ))}
    </div>
  );
}

function MonoCell({ value }: { value: string }) {
  return <span className="font-mono">{value}</span>;
}

function WarningCell({
  profile,
  fallback,
}: {
  profile: Record<string, unknown> | undefined;
  fallback: string;
}) {
  if (!profile) return <span className="text-muted-foreground">{fallback}</span>;
  if (profile.has_black_box_warning === true) {
    return (
      <div className="text-red-500 flex items-start gap-1.5 font-medium">
        <ShieldAlert className="w-4 h-4 shrink-0 mt-0.5" />
        <span>
          {typeof profile.black_box_text === "string" ? profile.black_box_text : "Warning"}
        </span>
      </div>
    );
  }
  return <span className="text-muted-foreground">None</span>;
}

function LoadingState({ label }: { label: string }) {
  return (
    <div className="p-12 text-center text-muted-foreground flex flex-col items-center justify-center gap-2">
      <RefreshCw className="w-6 h-6 animate-spin text-primary" />
      <span className="text-xs font-medium">{label}</span>
    </div>
  );
}
