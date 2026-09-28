"use client";

import Link from "next/link";
import { Suspense, useState } from "react";
import { useSearchParams } from "next/navigation";
import { Braces, GitBranch, Network, Pencil, Route } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { KnowledgeSurface, commonKnowledgeLinks } from "@/components/knowledge/knowledge-surface";
import { DrugFocusPicker } from "@/components/knowledge/drug-focus-picker";
import { PresentationToggle, usePresentation } from "@/components/knowledge/presentation";
import { InteractiveGraphCanvas, nodeLabel } from "@/components/graph";
import { useDrugMechanism, useDrugWorkflowState, useExplain } from "@/lib/api/react-query/hooks";
import { useLanguage } from "@/lib/i18n/context";
import type { DrugPackage, GraphEdgeData } from "@/lib/api";

const UUID_RE = /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{12}$/i;

function isUuid(value: string): boolean {
  return UUID_RE.test(value);
}

function edgeLabel(edge: GraphEdgeData): string {
  return edge.relationship_type.replaceAll("_", " ");
}

function asRecord(value: unknown): Record<string, unknown> {
  return value && typeof value === "object" && !Array.isArray(value)
    ? (value as Record<string, unknown>)
    : {};
}

function stringValue(value: unknown): string | null {
  return typeof value === "string" && value.trim().length > 0 ? value : null;
}

function draftMechanismRoots(
  pkg: DrugPackage | null | undefined
): Array<{ id: string; label: string }> {
  if (!pkg) return [];
  const payload = asRecord(pkg.entity_payload);
  const payloadRelationships = asRecord(payload.relationships);
  const groupedRoot = payloadRelationships.HAS_MECHANISM_ROOT;
  const fromGrouped = (Array.isArray(groupedRoot) ? groupedRoot : groupedRoot ? [groupedRoot] : [])
    .map((entry) => {
      if (typeof entry === "string" && entry.trim()) {
        return { id: entry.trim(), label: entry.trim() };
      }
      const row = asRecord(entry);
      const id = stringValue(row.target_id) || stringValue(row.to_id) || stringValue(row.id);
      return id ? { id, label: id } : null;
    })
    .filter((row): row is { id: string; label: string } => Boolean(row));

  const directRelationships = Array.isArray(pkg.relationships) ? pkg.relationships : [];
  const fromEdges = directRelationships
    .map(asRecord)
    .filter((relationship) => {
      const type =
        stringValue(relationship.relationship_type) ||
        stringValue(relationship.type) ||
        stringValue(relationship.kind);
      return type === "HAS_MECHANISM_ROOT";
    })
    .map((relationship) => {
      const id =
        stringValue(relationship.target_id) ||
        stringValue(relationship.to_id) ||
        stringValue(relationship.target);
      return id ? { id, label: id } : null;
    })
    .filter((row): row is { id: string; label: string } => Boolean(row));

  const seen = new Set<string>();
  const merged: Array<{ id: string; label: string }> = [];
  for (const row of [...fromGrouped, ...fromEdges]) {
    if (seen.has(row.id)) continue;
    seen.add(row.id);
    merged.push(row);
  }
  return merged;
}

function extractPackageDAG(pkg: DrugPackage | null | undefined) {
  if (!pkg) return { nodes: [], edges: [], rootId: null };
  const related = Array.isArray(pkg.related_entities) ? pkg.related_entities : [];
  const nodes = related
    .filter(
      (e) =>
        e &&
        typeof e === "object" &&
        (e as Record<string, unknown>).entity_type === "MechanismFragment"
    )
    .map((e) => {
      const ent = e as Record<string, unknown>;
      return {
        id: String(ent.id),
        label: String(ent.label || ent.slug || ent.id),
        entity_type: "MechanismFragment",
        slug: ent.slug ? String(ent.slug) : undefined,
        status: String(ent.status || "draft"),
        properties: ent,
      };
    });

  const relationships = Array.isArray(pkg.relationships) ? pkg.relationships : [];
  let rootId: string | null = null;
  const edges: GraphEdgeData[] = [];
  for (const r of relationships as Record<string, unknown>[]) {
    if (!r) continue;
    const type = String(r.relationship_type || r.type || "");
    if (type === "HAS_MECHANISM_ROOT") {
      rootId = String(r.target_id || r.to_id || r.id);
      edges.push({
        id: `${r.source_id}->${r.target_id}`,
        relationship_type: "HAS_MECHANISM_ROOT",
        source_id: String(r.source_id),
        target_id: String(r.target_id),
        properties: (r.properties as Record<string, unknown>) || {},
      });
    } else if (["PRECEDES", "RESULTS_IN", "BRANCHES_TO", "MERGES_INTO"].includes(type)) {
      edges.push({
        id: `${r.source_id}->${r.target_id}`,
        relationship_type: type,
        source_id: String(r.source_id),
        target_id: String(r.target_id),
        properties: (r.properties as Record<string, unknown>) || {},
      });
    }
  }
  return { nodes, edges, rootId };
}

function FocusedMechanismPanel({ drug }: { drug: string }) {
  const [selectedNodeId, setSelectedNodeId] = useState<string | null>(null);
  const { t } = useLanguage();
  const { presentation } = usePresentation();
  const slugMode = !isUuid(drug);
  const workflowState = useDrugWorkflowState(slugMode ? drug : "");
  const resolvedDrugId = isUuid(drug) ? drug : (workflowState.data?.data.entity_id ?? "");
  const mechanismQuery = useDrugMechanism(resolvedDrugId);
  const explainQuery = useExplain(drug);
  const draftRoots = draftMechanismRoots(workflowState.data?.data.package);
  const mechanism = mechanismQuery.data?.data;
  const publishedNodes = mechanism?.nodes ?? [];
  const publishedEdges = mechanism?.edges ?? [];

  const draftDAG = extractPackageDAG(workflowState.data?.data.package);
  const nodes = publishedNodes.length > 0 ? publishedNodes : draftDAG.nodes;
  const edges = publishedEdges.length > 0 ? publishedEdges : draftDAG.edges;
  const rootId = mechanism?.root_fragment_id || draftDAG.rootId;
  const isDraftFallback = publishedNodes.length === 0 && draftDAG.nodes.length > 0;
  const root = nodes.find((node) => node.id === rootId);
  const labelById = new Map(nodes.map((node) => [node.id, nodeLabel(node)]));

  // Synthesize draft explain chain if explain API has no graph path yet
  const draftExplainChain = (() => {
    if (explainQuery.data?.data?.reasoning_chain?.length) return null;
    if (!root) return null;
    const pkgPayload =
      (workflowState.data?.data?.package?.entity_payload as Record<string, unknown>) || {};
    const drugLabel = String(pkgPayload.label || pkgPayload.generic_name || drug);
    const rootEdge = edges.find((e) => e.relationship_type === "HAS_MECHANISM_ROOT");
    const steps = [
      {
        step: 1,
        relationship: "HAS_MECHANISM_ROOT",
        explanation:
          String(
            (rootEdge?.properties as Record<string, unknown> | undefined)?.explanation || ""
          ) ||
          `${drugLabel} selectively binds and initiates causal signaling at ${nodeLabel(root)}.`,
      },
    ];
    let currId = root.id;
    const visited = new Set<string>([currId]);
    while (true) {
      const nextEdge = edges.find(
        (e) =>
          ["PRECEDES", "RESULTS_IN", "BRANCHES_TO"].includes(e.relationship_type) &&
          e.source_id === currId &&
          !visited.has(e.target_id)
      );
      if (!nextEdge) break;
      visited.add(nextEdge.target_id);
      const nextNode = nodes.find((n) => n.id === nextEdge.target_id);
      steps.push({
        step: steps.length + 1,
        relationship: nextEdge.relationship_type,
        explanation:
          String((nextEdge.properties as Record<string, unknown> | undefined)?.explanation || "") ||
          `Signaling propagates to ${nextNode ? nodeLabel(nextNode) : nextEdge.target_id}.`,
      });
      currId = nextEdge.target_id;
    }
    return {
      answer_summary: `${drugLabel} mechanism initiates at ${nodeLabel(root)} and propagates through ${steps.length - 1} causal stages.`,
      steps,
    };
  })();

  return (
    <div className="space-y-4">
      <div className="grid gap-4 lg:grid-cols-[minmax(0,1fr)_340px]">
        <Card className="rounded-md">
          <CardHeader>
            <div className="flex flex-wrap items-center justify-between gap-3">
              <div>
                <CardTitle className="flex items-center gap-2 text-base">
                  <Route className="h-4 w-4" />
                  {isDraftFallback ? "Mechanism DAG (Staging / Draft)" : "Published mechanism DAG"}
                  {isDraftFallback && (
                    <Badge
                      variant="outline"
                      className="text-amber-600 border-amber-500/30 text-xs font-normal"
                    >
                      Draft Preview
                    </Badge>
                  )}
                </CardTitle>
                <CardDescription>
                  Interactive /drugs/{"{uuid}"}/mechanism preview for the focused drug.
                </CardDescription>
              </div>
              <Button asChild size="sm" variant="outline">
                <Link href={`/knowledge/drugs/${encodeURIComponent(drug)}`}>
                  <Pencil className="h-4 w-4" />
                  Edit
                </Link>
              </Button>
              <PresentationToggle />
            </div>
          </CardHeader>
          <CardContent className="space-y-4">
            {slugMode && workflowState.isLoading ? (
              <p className="text-sm text-muted-foreground">Resolving draft drug identity...</p>
            ) : mechanismQuery.isLoading ? (
              <p className="text-sm text-muted-foreground">Loading mechanism graph...</p>
            ) : nodes.length === 0 ? (
              <div className="rounded-md border bg-muted/30 p-3 text-sm space-y-1">
                <p className="text-foreground">
                  {t(
                    "knowledge.mechanisms.emptyReader",
                    "No published mechanism for this drug yet."
                  )}
                </p>
                {!presentation && (
                  <p className="text-muted-foreground">
                    {t(
                      "knowledge.mechanisms.emptyCurator",
                      "Author roots and pathway steps in the Drug Editor, then publish."
                    )}
                  </p>
                )}
              </div>
            ) : (
              <>
                <InteractiveGraphCanvas
                  nodes={nodes}
                  edges={edges}
                  selectedNodeId={selectedNodeId}
                  onSelectNode={setSelectedNodeId}
                  emptyMessage="No published mechanism graph yet."
                />
                <div className="grid gap-3 md:grid-cols-4">
                  <div className="rounded-md border bg-muted/30 p-3">
                    <p className="text-xs text-muted-foreground">Root</p>
                    <p className="truncate text-sm font-semibold">
                      {root ? nodeLabel(root) : "Missing"}
                    </p>
                  </div>
                  <div className="rounded-md border bg-muted/30 p-3">
                    <p className="text-xs text-muted-foreground">Nodes</p>
                    <p className="text-lg font-semibold">{nodes.length}</p>
                  </div>
                  <div className="rounded-md border bg-muted/30 p-3">
                    <p className="text-xs text-muted-foreground">Edges</p>
                    <p className="text-lg font-semibold">{edges.length}</p>
                  </div>
                  <div className="rounded-md border bg-muted/30 p-3">
                    <p className="text-xs text-muted-foreground">Acyclic</p>
                    <p className="text-lg font-semibold">
                      {(mechanism?.is_acyclic ?? nodes.length > 0) ? "Yes" : "No"}
                    </p>
                  </div>
                </div>

                <div className="grid gap-3 md:grid-cols-2">
                  <div className="space-y-2">
                    <p className="text-xs font-medium uppercase text-muted-foreground">Fragments</p>
                    {nodes.slice(0, 8).map((node) => (
                      <button
                        key={node.id}
                        type="button"
                        className="w-full rounded-md border px-3 py-2 text-left hover:bg-muted/40"
                        onClick={() =>
                          setSelectedNodeId(node.id === selectedNodeId ? null : node.id)
                        }
                      >
                        <p className="truncate text-sm font-medium">{nodeLabel(node)}</p>
                        <p className="truncate text-xs text-muted-foreground">
                          {node.entity_type ?? "Node"}
                        </p>
                      </button>
                    ))}
                  </div>
                  <div className="space-y-2">
                    <p className="text-xs font-medium uppercase text-muted-foreground">
                      Relationships
                    </p>
                    {edges.slice(0, 8).map((edge) => (
                      <div key={edge.id} className="rounded-md border px-3 py-2">
                        <p className="truncate text-sm font-medium">{edgeLabel(edge)}</p>
                        <p className="truncate text-xs text-muted-foreground">
                          {labelById.get(edge.source_id) ?? edge.source_id}
                          {" → "}
                          {labelById.get(edge.target_id) ?? edge.target_id}
                        </p>
                      </div>
                    ))}
                  </div>
                </div>
              </>
            )}
          </CardContent>
        </Card>

        {!presentation && (
          <Card className="rounded-md">
            <CardHeader>
              <CardTitle className="flex items-center gap-2 text-base">
                <GitBranch className="h-4 w-4" />
                Draft context
              </CardTitle>
              <CardDescription>
                Mechanism root links detected in the curator package.
              </CardDescription>
            </CardHeader>
            <CardContent className="space-y-3">
              {slugMode && workflowState.isLoading ? (
                <p className="text-sm text-muted-foreground">Loading draft package...</p>
              ) : draftRoots.length === 0 ? (
                <p className="text-sm text-muted-foreground">
                  No draft HAS_MECHANISM_ROOT link found. Use the Drug Editor Mechanism picker.
                </p>
              ) : (
                draftRoots.map((rootRow) => (
                  <div key={rootRow.id} className="rounded-md border bg-muted/30 p-3">
                    <p className="text-xs font-medium text-muted-foreground">HAS_MECHANISM_ROOT</p>
                    <p className="mt-1 break-all text-sm">{rootRow.label}</p>
                  </div>
                ))
              )}
              {resolvedDrugId && (
                <div className="rounded-md border bg-muted/30 p-3">
                  <p className="text-xs text-muted-foreground">Resolved entity ID</p>
                  <p className="mt-1 break-all text-xs">{resolvedDrugId}</p>
                </div>
              )}
            </CardContent>
          </Card>
        )}
      </div>

      <Card className="rounded-md">
        <CardHeader>
          <CardTitle className="flex items-center gap-2 text-base">
            <Network className="h-4 w-4" />
            Explain API preview
          </CardTitle>
          <CardDescription>
            The student-facing `/explain?drug=...&question_type=mechanism` response.
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-3">
          {explainQuery.isLoading ? (
            <p className="text-sm text-muted-foreground">Loading explain preview...</p>
          ) : explainQuery.data?.data ? (
            <>
              <div className="rounded-md border bg-muted/30 p-3">
                <p className="text-xs font-medium text-muted-foreground">Summary</p>
                <p className="mt-1 text-sm">
                  {explainQuery.data.data.answer_summary ?? "No summary yet."}
                </p>
              </div>
              <div className="space-y-2">
                {explainQuery.data.data.reasoning_chain.map((step) => (
                  <div key={step.step} className="rounded-md border px-3 py-2">
                    <div className="flex flex-wrap items-center gap-2">
                      <Badge variant="muted">Step {step.step}</Badge>
                      <span className="text-sm font-medium">{step.relationship}</span>
                    </div>
                    <p className="mt-2 text-sm text-muted-foreground">{step.explanation}</p>
                  </div>
                ))}
              </div>
              {!presentation && (
                <div className="rounded-md border bg-muted/30">
                  <div className="flex items-center gap-2 border-b px-3 py-2 text-xs font-medium text-muted-foreground">
                    <Braces className="h-3.5 w-3.5" />
                    Explain JSON
                  </div>
                  <pre className="minimal-scrollbar max-h-72 overflow-auto p-3 text-xs">
                    {JSON.stringify(explainQuery.data.data, null, 2)}
                  </pre>
                </div>
              )}
            </>
          ) : draftExplainChain ? (
            <>
              <div className="flex items-center gap-2">
                <Badge variant="outline" className="text-amber-600 border-amber-500/30 text-xs">
                  Draft Causal Reasoning Chain
                </Badge>
              </div>
              <div className="rounded-md border bg-muted/30 p-3">
                <p className="text-xs font-medium text-muted-foreground">Summary</p>
                <p className="mt-1 text-sm">{draftExplainChain.answer_summary}</p>
              </div>
              <div className="space-y-2">
                {draftExplainChain.steps.map((step) => (
                  <div key={step.step} className="rounded-md border px-3 py-2">
                    <div className="flex flex-wrap items-center gap-2">
                      <Badge variant="muted">Step {step.step}</Badge>
                      <span className="text-sm font-medium">{step.relationship}</span>
                    </div>
                    <p className="mt-2 text-sm text-muted-foreground">{step.explanation}</p>
                  </div>
                ))}
              </div>
            </>
          ) : (
            <p className="text-sm text-destructive">No published explain path yet.</p>
          )}
        </CardContent>
      </Card>
    </div>
  );
}

function MechanismsSurface() {
  const searchParams = useSearchParams();
  const focusedDrug = searchParams.get("drug");
  const { t } = useLanguage();

  return (
    <div className="space-y-6">
      <KnowledgeSurface
        eyebrow={t("knowledge.mechanisms.eyebrow", "Mechanism layer")}
        title={t("knowledge.mechanisms.title", "Mechanisms")}
        status="MVP live"
        description={t(
          "knowledge.mechanisms.description",
          "Pick a drug to inspect its published mechanism DAG and Explain preview. Author the pathway on the Drug Editor canvas (Add node, set roots, connect steps)."
        )}
        primary={{
          label: focusedDrug
            ? t("knowledge.mechanisms.editPathway", "Edit pathway")
            : t("knowledge.mechanisms.openBrowser", "Open drug browser"),
          href: focusedDrug
            ? `/knowledge/drugs/${encodeURIComponent(focusedDrug)}`
            : "/knowledge/drugs",
          icon: focusedDrug ? Pencil : GitBranch,
          description: focusedDrug
            ? "Open the focused Drug Editor pathway canvas."
            : "Choose a drug, author the mechanism pathway on the canvas, then publish.",
        }}
        signals={[
          { label: "Pathway canvas", value: "live", tone: "success" },
          { label: "Root + step edges", value: "live", tone: "success" },
          { label: "Published DAG preview", value: "interactive", tone: "success" },
        ]}
        links={commonKnowledgeLinks}
        deferred={[
          "Assertion-level SUPPORTED_BY evidence on mechanism edges",
          "RESULTS_IN outcomes (SideEffect / ClinicalOutcome) on the canvas",
        ]}
      />
      <DrugFocusPicker
        title={t("knowledge.pickDrug", "Pick a drug")}
        description="Select a drug to load /drugs/{uuid}/mechanism. Author roots and steps on the Drug Editor canvas, then publish before expecting a multi-step DAG."
      />
      {focusedDrug ? <FocusedMechanismPanel drug={focusedDrug} /> : null}
    </div>
  );
}

export default function MechanismsPage() {
  return (
    <Suspense fallback={null}>
      <MechanismsSurface />
    </Suspense>
  );
}
