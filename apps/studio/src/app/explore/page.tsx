"use client";

import { useEffect, useMemo, useState } from "react";
import {
  Activity,
  BookOpen,
  CheckCircle2,
  ChevronRight,
  GraduationCap,
  HeartPulse,
  Pill,
  RefreshCw,
  Search,
  ShieldAlert,
  Sparkles,
} from "lucide-react";
import { apiClient } from "@/lib/api";
import { ApiErrorPanel } from "@/components/ui/api-error-panel";
import { useLanguage } from "@/lib/i18n/context";
import { useUIMode } from "@/lib/ui-mode/context";
import type { GraphEdgeData, GraphNodeData } from "@/lib/api/types";

type MechanismLevel = "molecular" | "cellular" | "tissue" | "organ" | "clinical" | "unknown";

interface MechanismStep {
  step: number;
  title: string;
  description: string;
  level: MechanismLevel;
}

interface EvidenceRow {
  id: string;
  title: string;
  type: string;
  year: string;
}

interface DrugDetail {
  id: string;
  slug: string;
  name: string;
  genericName: string;
  class: string;
  rxnorm: string;
  atc: string;
  mechanismSummary: string | null;
  clinicalPearl: string | null;
  routes: string[];
  halfLife: string | null;
  bioavailability: string | null;
  proteinBinding: string | null;
  hasBlackBoxWarning: boolean;
  blackBoxText?: string;
  indications: string[];
  mechanismSteps: MechanismStep[];
  evidence: EvidenceRow[];
  provenance: string | null;
  datasetVersion: string;
  graphAvailable: boolean;
}

interface DrugListItem {
  id: string;
  slug: string;
  name: string;
  curationStatus?: string | null;
  source?: string | null;
}

const KNOWN_LEVELS: MechanismLevel[] = ["molecular", "cellular", "tissue", "organ", "clinical"];

function nodeLevel(node: GraphNodeData): MechanismLevel {
  const raw = node.properties?.fragment_type;
  if (typeof raw === "string" && (KNOWN_LEVELS as string[]).includes(raw)) {
    return raw as MechanismLevel;
  }
  return "unknown";
}

function nodeText(node: GraphNodeData): string {
  const props = node.properties ?? {};
  const description = props.description;
  if (typeof description === "string" && description.trim()) return description;
  return "";
}

/** Order fragments by breadth-first traversal from the mechanism root. */
function orderMechanismSteps(
  nodes: GraphNodeData[],
  edges: GraphEdgeData[],
  rootId: string | null
): MechanismStep[] {
  const byId = new Map(nodes.map((node) => [String(node.id), node]));
  const adjacency = new Map<string, GraphEdgeData[]>();
  for (const edge of edges) {
    if (
      !["PRECEDES", "RESULTS_IN", "BRANCHES_TO", "MERGES_INTO"].includes(edge.relationship_type)
    ) {
      continue;
    }
    const list = adjacency.get(String(edge.source_id)) ?? [];
    list.push(edge);
    adjacency.set(String(edge.source_id), list);
  }
  const start =
    rootId && byId.has(String(rootId)) ? String(rootId) : nodes[0] ? String(nodes[0].id) : null;
  if (!start) return [];
  const visited = new Set<string>();
  const queue: string[] = [start];
  const ordered: GraphNodeData[] = [];
  while (queue.length > 0) {
    const current = queue.shift()!;
    if (visited.has(current)) continue;
    visited.add(current);
    const node = byId.get(current);
    if (node) ordered.push(node);
    for (const edge of adjacency.get(current) ?? []) {
      const target = String(edge.target_id);
      if (!visited.has(target)) queue.push(target);
    }
  }
  // Include fragments unreachable from the root (no silent drops).
  for (const node of nodes) {
    if (!visited.has(String(node.id))) ordered.push(node);
  }
  return ordered.map((node, index) => ({
    step: index + 1,
    title: String(node.label ?? node.slug ?? node.id),
    description: nodeText(node),
    level: nodeLevel(node),
  }));
}

function str(value: unknown): string | null {
  return typeof value === "string" && value.trim() ? value : null;
}

export default function ExplorePage() {
  return <ExplorePageInner />;
}

function DraftBadge() {
  const { t } = useLanguage();
  return (
    <span
      className="flex items-center gap-1 text-[10px] text-amber-600 font-bold ml-1"
      title={t("fallback.draftBadge", "Draft / offline sample — no curator approval")}
    >
      • {t("fallback.draftBadge", "Draft / offline sample — no curator approval")}
    </span>
  );
}

function ExplorePageInner() {
  const { t } = useLanguage();
  const { isSimple } = useUIMode();
  const [availableDrugs, setAvailableDrugs] = useState<DrugListItem[]>([]);
  const [activeSlug, setActiveSlug] = useState<string | null>(null);
  const [searchQuery, setSearchQuery] = useState("");
  const [detail, setDetail] = useState<DrugDetail | null>(null);
  const [loadingList, setLoadingList] = useState(true);
  const [loadingDetail, setLoadingDetail] = useState(false);
  const [listError, setListError] = useState<unknown>(null);
  const [detailError, setDetailError] = useState<unknown>(null);

  // 1. Public drug list — knowledge:read, no curator scope needed.
  useEffect(() => {
    async function loadDrugs() {
      setLoadingList(true);
      setListError(null);
      try {
        const response = await apiClient.drugs({ limit: 100 });
        const items = (response.data ?? []).map((item) => ({
          id: String(item.id),
          slug: String(item.slug),
          name: String(item.label || item.slug),
          curationStatus: item.curation_status ?? null,
          source: item.source ?? null,
        }));
        setAvailableDrugs(items);
        setActiveSlug((current) => current ?? items[0]?.slug ?? null);
      } catch (error) {
        setListError(error);
      } finally {
        setLoadingList(false);
      }
    }
    loadDrugs();
  }, []);

  // 2. Public drug detail: payload + mechanism DAG + graph + evidence + education.
  useEffect(() => {
    if (!activeSlug) return;
    const entry = availableDrugs.find((item) => item.slug === activeSlug);
    if (!entry) return;
    const entryId = entry.id;
    const entryName = entry.name;
    const entrySlug = entry.slug;
    async function loadDetail() {
      setLoadingDetail(true);
      setDetailError(null);
      setDetail(null);
      try {
        const [drugRes, mechanismRes, graphRes, evidenceRes, educationRes] = await Promise.all([
          apiClient.getDrug(entryId),
          apiClient.getDrugMechanism(entryId).catch(() => null),
          apiClient.getDrugGraph(entryId).catch(() => null),
          apiClient.listDrugEvidence(entryId).catch(() => null),
          apiClient.getDrugEducation(entryId).catch(() => null),
        ]);
        const payload = (drugRes.data ?? {}) as Record<string, unknown>;
        const externalIds = (payload.external_ids ?? {}) as Record<string, unknown>;
        const atc = externalIds.atc;
        const mechanism = mechanismRes?.data;
        const graph = graphRes?.data;
        const evidenceRows = evidenceRes?.data ?? [];
        const educationItems = educationRes?.data ?? [];

        const graphNodes: GraphNodeData[] = Array.isArray(graph?.nodes) ? graph.nodes : [];
        const indications = graphNodes
          .filter((node) => node.entity_type === "Disease")
          .map((node) => String(node.label ?? node.slug ?? node.id));

        const relatedClasses = graphNodes.filter((node) => node.entity_type === "DrugClass");
        const drugClass = relatedClasses[0]?.label ?? relatedClasses[0]?.slug ?? null;

        const pearl = educationItems.find(
          (item) => item.kind === "BoardExamPearl" && str(item.text)
        );

        const steps = mechanism
          ? orderMechanismSteps(
              mechanism.nodes ?? [],
              mechanism.edges ?? [],
              mechanism.root_fragment_id ?? null
            )
          : [];

        const evidence: EvidenceRow[] = evidenceRows.map((row) => {
          const record = (row.evidence ?? {}) as Record<string, unknown>;
          return {
            id: String(row.evidence_id ?? record.id ?? ""),
            title: String(record.title ?? record.label ?? "Evidence"),
            type: String(record.evidence_type ?? "unknown"),
            year: record.year !== undefined && record.year !== null ? String(record.year) : "—",
          };
        });

        const metas = [drugRes.meta, mechanismRes?.meta, graphRes?.meta, evidenceRes?.meta];
        const provenance = metas.some((meta) => meta?.provenance === "staging-fallback")
          ? "staging-fallback"
          : null;

        setDetail({
          id: entryId,
          slug: entrySlug,
          name: String(payload.label ?? payload.generic_name ?? entryName),
          genericName: String(payload.generic_name ?? payload.label ?? entryName),
          class: drugClass ? String(drugClass) : "",
          rxnorm: str(externalIds.rxnorm) ?? "",
          atc: Array.isArray(atc) ? String(atc[0] ?? "") : (str(atc) ?? ""),
          mechanismSummary:
            steps[0]?.description ||
            str((payload as Record<string, unknown>).mechanism_summary) ||
            null,
          clinicalPearl: pearl ? str(pearl.text) : null,
          routes: Array.isArray(payload.routes) ? (payload.routes as unknown[]).map(String) : [],
          halfLife: str(payload.half_life),
          bioavailability: str(payload.bioavailability),
          proteinBinding: str(payload.protein_binding),
          hasBlackBoxWarning: payload.has_black_box_warning === true,
          blackBoxText: str(payload.black_box_text) ?? undefined,
          indications,
          mechanismSteps: steps,
          evidence,
          provenance,
          datasetVersion: String(drugRes.meta?.dataset_version ?? "unpublished"),
          graphAvailable: graphNodes.length > 0,
        });
      } catch (error) {
        setDetailError(error);
      } finally {
        setLoadingDetail(false);
      }
    }
    loadDetail();
  }, [activeSlug, availableDrugs]);

  const filteredDrugs = useMemo(
    () =>
      availableDrugs.filter(
        (d) =>
          d.name.toLowerCase().includes(searchQuery.toLowerCase()) ||
          d.slug.toLowerCase().includes(searchQuery.toLowerCase())
      ),
    [availableDrugs, searchQuery]
  );

  const getLevelBadge = (level: MechanismLevel) => {
    switch (level) {
      case "molecular":
        return "bg-indigo-500/10 text-indigo-500 border-indigo-500/20";
      case "cellular":
        return "bg-cyan-500/10 text-cyan-500 border-cyan-500/20";
      case "tissue":
        return "bg-violet-500/10 text-violet-500 border-violet-500/20";
      case "organ":
        return "bg-amber-500/10 text-amber-500 border-amber-500/20";
      case "clinical":
        return "bg-emerald-500/10 text-emerald-500 border-emerald-500/20";
      default:
        return "bg-muted text-muted-foreground border-muted-foreground/20";
    }
  };

  const unknownText = t("fallback.variableEmpty", "Awaiting curator input");

  return (
    <div className="max-w-6xl mx-auto p-6 space-y-8">
      {/* Top Banner */}
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 border-b pb-6">
        <div>
          <div className="inline-flex items-center gap-2 px-3 py-1 rounded-full text-xs font-semibold bg-primary/10 text-primary mb-2">
            <GraduationCap className="w-3.5 h-3.5" />
            {isSimple ? "İlaç Bilgi Sistemi" : "Medical Student & Clinician Explorer"}
            {detail?.provenance === "staging-fallback" && <DraftBadge />}
          </div>
          <h1 className="text-3xl font-extrabold tracking-tight">
            {isSimple ? "İlaç Detayları" : "Biomedical Knowledge Explorer"}
          </h1>
          <p className="text-muted-foreground text-sm mt-1">
            {isSimple
              ? "İlaçların etki mekanizmaları, kullanım alanları ve farmakolojik özellikleri."
              : "Explainable pharmacology at molecular, cellular, organ, and clinical levels with cited evidence chains."}
          </p>
          {detail && !isSimple && (
            <p className="text-muted-foreground text-xs mt-1 font-mono">
              Source:{" "}
              {detail.provenance === "staging-fallback"
                ? "curator staging (unpublished)"
                : "published graph"}{" "}
              · version {detail.datasetVersion}
            </p>
          )}
        </div>

        {/* Search & Dynamic Drug Switcher */}
        <div className="flex flex-col sm:flex-row items-stretch sm:items-center gap-2">
          <div className="relative">
            <Search className="w-3.5 h-3.5 absolute left-3 top-1/2 -translate-y-1/2 text-muted-foreground" />
            <input
              type="text"
              placeholder="Search all drugs..."
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              className="pl-8 pr-3 py-1.5 text-xs rounded-lg border bg-background focus:outline-none focus:ring-2 focus:ring-primary w-full sm:w-44"
            />
          </div>

          <div className="flex items-center gap-1.5 p-1 bg-muted rounded-xl overflow-x-auto max-w-full sm:max-w-md">
            {filteredDrugs.slice(0, 5).map((d) => (
              <button
                key={d.slug}
                onClick={() => setActiveSlug(d.slug)}
                className={`px-3 py-1.5 rounded-lg text-xs font-semibold transition-all cursor-pointer whitespace-nowrap ${
                  activeSlug === d.slug
                    ? "bg-card text-foreground shadow-xs"
                    : "text-muted-foreground hover:text-foreground"
                }`}
              >
                {d.name}
                {d.curationStatus === "external" || d.source === "primekg" ? (
                  <span
                    className="ml-1.5 align-middle text-[9px] font-semibold uppercase tracking-wide text-warning-foreground bg-warning/15 border border-warning/30 rounded px-1 py-0.5"
                    title="PrimeKG'den içe aktarıldı. Küratör incelemesi yoktur, kanıt bağlı değildir. / Imported from PrimeKG: no curator review, no evidence linkage."
                  >
                    PrimeKG
                  </span>
                ) : null}
              </button>
            ))}
          </div>
        </div>
      </div>

      {loadingList ? (
        <div className="p-12 text-center text-muted-foreground flex flex-col items-center justify-center gap-2">
          <RefreshCw className="w-6 h-6 animate-spin text-primary" />
          <span className="text-xs font-medium">Loading drug catalog...</span>
        </div>
      ) : listError ? (
        <ApiErrorPanel error={listError} onRetry={() => window.location.reload()} />
      ) : availableDrugs.length === 0 ? (
        <div className="rounded-2xl border p-6 text-sm text-muted-foreground">
          No drugs in the catalog yet. Publish knowledge via Studio workflows.
        </div>
      ) : loadingDetail || !detail ? (
        <div className="p-12 text-center text-muted-foreground flex flex-col items-center justify-center gap-2">
          <RefreshCw className="w-6 h-6 animate-spin text-primary" />
          <span className="text-xs font-medium">Syncing with Knowledge Graph...</span>
        </div>
      ) : detailError ? (
        <ApiErrorPanel error={detailError} />
      ) : (
        <>
          {/* Drug Hero Card */}
          <div className="rounded-2xl border bg-card p-6 shadow-xs space-y-6">
            <div className="flex flex-col md:flex-row md:items-start justify-between gap-4">
              <div className="space-y-1.5">
                <div className="inline-flex items-center gap-2 text-xs font-mono font-medium text-primary">
                  <span>ATC: {detail.atc || "—"}</span>
                  <span>•</span>
                  <span>RxNorm: {detail.rxnorm || "—"}</span>
                </div>
                <h2 className="text-2xl font-bold tracking-tight">{detail.name}</h2>
                <div className="text-sm font-medium text-muted-foreground">
                  {detail.class || unknownText}
                </div>
              </div>

              <div className="flex items-center gap-2 flex-wrap">
                {detail.indications.length > 0 ? (
                  detail.indications.map((ind, idx) => (
                    <span
                      key={idx}
                      className="px-2.5 py-1 rounded-md text-xs font-medium bg-secondary text-secondary-foreground"
                    >
                      {ind}
                    </span>
                  ))
                ) : (
                  <span className="text-xs text-muted-foreground">{unknownText}</span>
                )}
              </div>
            </div>

            {/* Mechanism of Action Summary */}
            <div className="bg-muted/30 rounded-xl p-4 border text-sm leading-relaxed">
              <div className="text-xs font-bold uppercase tracking-wider text-muted-foreground mb-1">
                {isSimple ? "Etki Mekanizması" : "Mechanism of Action (MoA) Overview"}
              </div>
              <p className="text-foreground">{detail.mechanismSummary ?? unknownText}</p>
            </div>

            {/* High-Yield Clinical Pearl */}
            <div className="bg-primary/5 border border-primary/20 rounded-xl p-4 space-y-2">
              <div className="flex items-center gap-2 text-primary font-bold text-xs uppercase tracking-wider">
                <Sparkles className="w-4 h-4" />
                {isSimple ? "Klinik Önemli Bilgi" : "High-Yield Clinical & Exam Pearl"}
              </div>
              <p className="text-xs leading-relaxed text-foreground">
                {detail.clinicalPearl ?? unknownText}
              </p>
            </div>

            {/* Black Box Warning if present */}
            {detail.hasBlackBoxWarning && (
              <div className="bg-red-500/10 border border-red-500/30 rounded-xl p-4 text-xs space-y-1">
                <div className="flex items-center gap-2 font-bold text-red-500 uppercase tracking-wider">
                  <ShieldAlert className="w-4 h-4" />
                  {isSimple ? "Kara Kutu Uyarısı" : "FDA Black Box Warning"}
                </div>
                <p className="text-foreground leading-relaxed">
                  {detail.blackBoxText ?? unknownText}
                </p>
              </div>
            )}
          </div>

          {/* Mechanism Reasoning Flow (Visual DAG) */}
          <div className="rounded-2xl border bg-card p-6 shadow-xs space-y-4">
            <div className="flex items-center justify-between">
              <div>
                <h3 className="text-lg font-bold tracking-tight">
                  {isSimple ? "Etki Mekanizması Adımları" : "Step-by-Step Mechanism Traversal"}
                </h3>
                <p className="text-xs text-muted-foreground mt-0.5">
                  {isSimple
                    ? "İlacın molekül düzeyinden klinik etkiye uzanan zinciri"
                    : "Knowledge graph causal chain connecting molecular target to downstream clinical outcome"}
                </p>
              </div>
            </div>

            {detail.mechanismSteps.length === 0 ? (
              <p className="text-xs text-muted-foreground">{unknownText}</p>
            ) : (
              <div className="grid grid-cols-1 md:grid-cols-4 gap-3 relative">
                {detail.mechanismSteps.map((step, idx) => (
                  <div
                    key={idx}
                    className="rounded-xl border bg-background p-4 space-y-2 relative flex flex-col justify-between"
                  >
                    <div className="space-y-2">
                      <div className="flex items-center justify-between">
                        <span className="w-6 h-6 rounded-full bg-primary text-primary-foreground font-bold text-xs flex items-center justify-center">
                          {step.step}
                        </span>
                        <span
                          className={`px-2 py-0.5 rounded text-[10px] font-bold uppercase tracking-wider border ${getLevelBadge(
                            step.level
                          )}`}
                        >
                          {step.level}
                        </span>
                      </div>
                      <h4 className="text-xs font-bold text-foreground">{step.title}</h4>
                      <p className="text-[11px] text-muted-foreground leading-relaxed">
                        {step.description || unknownText}
                      </p>
                    </div>

                    {idx < detail.mechanismSteps.length - 1 && (
                      <div className="hidden md:block absolute -right-3 top-1/2 -translate-y-1/2 z-10">
                        <div className="w-6 h-6 rounded-full bg-muted border flex items-center justify-center text-muted-foreground">
                          <ChevronRight className="w-3.5 h-3.5" />
                        </div>
                      </div>
                    )}
                  </div>
                ))}
              </div>
            )}
          </div>

          {/* Pharmacokinetics Profile */}
          <div className="rounded-2xl border bg-card p-6 shadow-xs space-y-4">
            <h3 className="text-lg font-bold tracking-tight">
              {isSimple ? "Farmakokinetik Özellikler" : "Clinical Pharmacokinetics"}
            </h3>
            <div className="grid grid-cols-2 sm:grid-cols-4 gap-4 text-xs">
              <div className="p-3 rounded-xl bg-muted/40 border">
                <div className="text-muted-foreground font-medium">
                  {isSimple ? "Kullanım Yolları" : "Administration Routes"}
                </div>
                <div className="font-semibold text-foreground mt-1 capitalize">
                  {detail.routes.length > 0 ? detail.routes.join(", ") : "—"}
                </div>
              </div>
              <div className="p-3 rounded-xl bg-muted/40 border">
                <div className="text-muted-foreground font-medium">
                  {isSimple ? "Yarı Ömür" : "Elimination Half-Life"}
                </div>
                <div className="font-semibold text-foreground mt-1">{detail.halfLife ?? "—"}</div>
              </div>
              <div className="p-3 rounded-xl bg-muted/40 border">
                <div className="text-muted-foreground font-medium">
                  {isSimple ? "Biyoyararlanım" : "Oral Bioavailability"}
                </div>
                <div className="font-semibold text-foreground mt-1">
                  {detail.bioavailability ?? "—"}
                </div>
              </div>
              <div className="p-3 rounded-xl bg-muted/40 border">
                <div className="text-muted-foreground font-medium">
                  {isSimple ? "Protein Bağlanması" : "Plasma Protein Binding"}
                </div>
                <div className="font-semibold text-foreground mt-1">
                  {detail.proteinBinding ?? "—"}
                </div>
              </div>
            </div>
          </div>

          {/* Evidence */}
          <div className="rounded-2xl border bg-card p-6 shadow-xs space-y-4">
            <div className="flex items-center gap-2">
              <BookOpen className="w-4 h-4 text-primary" />
              <h3 className="text-lg font-bold tracking-tight">
                {isSimple ? "Kaynaklar ve Referanslar" : "Supporting Evidence"}
              </h3>
            </div>
            {detail.evidence.length === 0 ? (
              <p className="text-xs text-muted-foreground">{unknownText}</p>
            ) : (
              <ul className="space-y-2">
                {detail.evidence.map((row) => (
                  <li key={row.id} className="rounded-lg border bg-muted/20 px-3 py-2.5 text-xs">
                    <p className="font-medium text-sm">{row.title}</p>
                    <p className="mt-0.5 font-mono text-[11px] text-muted-foreground">
                      {row.type} · {row.year}
                    </p>
                  </li>
                ))}
              </ul>
            )}
          </div>

          {/* Status strip */}
          <div className="flex flex-wrap items-center gap-x-4 gap-y-1 text-[11px] text-muted-foreground">
            <span className="inline-flex items-center gap-1">
              <Pill className="w-3.5 h-3.5" /> {detail.slug}
            </span>
            <span className="inline-flex items-center gap-1">
              <HeartPulse className="w-3.5 h-3.5" /> {detail.indications.length} indications
            </span>
            <span className="inline-flex items-center gap-1">
              <Activity className="w-3.5 h-3.5" /> {detail.mechanismSteps.length} mechanism steps
            </span>
            <span className="inline-flex items-center gap-1">
              <CheckCircle2 className="w-3.5 h-3.5" /> {detail.evidence.length} evidence links
            </span>
          </div>
        </>
      )}
    </div>
  );
}
