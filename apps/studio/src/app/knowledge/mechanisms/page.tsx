"use client";

import Link from "next/link";
import { Suspense } from "react";
import { useSearchParams } from "next/navigation";
import { Braces, GitBranch, Network, Pencil, Route } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { KnowledgeSurface, commonKnowledgeLinks } from "@/components/knowledge/knowledge-surface";
import {
  useDrugMechanism,
  useDrugWorkflowState,
  useExplain,
} from "@/lib/api/react-query/hooks";
import type { DrugPackage, GraphEdgeData, GraphNodeData } from "@/lib/api";

const UUID_RE = /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{12}$/i;

function isUuid(value: string): boolean {
  return UUID_RE.test(value);
}

function nodeLabel(node: GraphNodeData): string {
  return node.label || node.slug || node.id;
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

function draftMechanismRoots(pkg: DrugPackage | null | undefined): Array<Record<string, unknown>> {
  if (!pkg) return [];
  const directRelationships = Array.isArray(pkg.relationships) ? pkg.relationships : [];
  const payload = asRecord(pkg.entity_payload);
  const payloadRelationships = asRecord(payload.relationships);
  const groupedRoot = payloadRelationships.HAS_MECHANISM_ROOT;
  const groupedRoots = Array.isArray(groupedRoot) ? groupedRoot : groupedRoot ? [groupedRoot] : [];
  return [...directRelationships, ...groupedRoots]
    .map(asRecord)
    .filter((relationship) => {
      const type =
        stringValue(relationship.relationship_type) ||
        stringValue(relationship.type) ||
        stringValue(relationship.kind);
      return type === "HAS_MECHANISM_ROOT";
    });
}

function FocusedMechanismPanel({ drug }: { drug: string }) {
  const slugMode = !isUuid(drug);
  const workflowState = useDrugWorkflowState(slugMode ? drug : "");
  const resolvedDrugId = isUuid(drug) ? drug : (workflowState.data?.data.entity_id ?? "");
  const mechanismQuery = useDrugMechanism(resolvedDrugId);
  const explainQuery = useExplain(drug);
  const draftRoots = draftMechanismRoots(workflowState.data?.data.package);
  const mechanism = mechanismQuery.data?.data;
  const nodes = mechanism?.nodes ?? [];
  const edges = mechanism?.edges ?? [];
  const root = nodes.find((node) => node.id === mechanism?.root_fragment_id);

  return (
    <div className="space-y-4">
      <div className="grid gap-4 lg:grid-cols-[minmax(0,1fr)_340px]">
        <Card className="rounded-md">
          <CardHeader>
            <div className="flex flex-wrap items-center justify-between gap-3">
              <div>
                <CardTitle className="flex items-center gap-2 text-base">
                  <Route className="h-4 w-4" />
                  Published mechanism DAG
                </CardTitle>
                <CardDescription>
                  Graph-backed /drugs/{"{uuid}"}/mechanism preview for the focused drug.
                </CardDescription>
              </div>
              <Button asChild size="sm" variant="outline">
                <Link href={`/knowledge/drugs/${encodeURIComponent(drug)}`}>
                  <Pencil className="h-4 w-4" />
                  Edit
                </Link>
              </Button>
            </div>
          </CardHeader>
          <CardContent className="space-y-4">
            {slugMode && workflowState.isLoading ? (
              <p className="text-sm text-muted-foreground">Resolving draft drug identity...</p>
            ) : mechanismQuery.isLoading ? (
              <p className="text-sm text-muted-foreground">Loading mechanism graph...</p>
            ) : mechanismQuery.error ? (
              <p className="text-sm text-destructive">Unable to load published mechanism graph.</p>
            ) : !mechanism || nodes.length === 0 ? (
              <p className="rounded-md border bg-muted/30 p-3 text-sm text-muted-foreground">
                No published mechanism graph yet. Publish the drug after adding mechanism root data.
              </p>
            ) : (
              <>
                <div className="grid gap-3 md:grid-cols-4">
                  <div className="rounded-md border bg-muted/30 p-3">
                    <p className="text-xs text-muted-foreground">Root</p>
                    <p className="truncate text-sm font-semibold">{root ? nodeLabel(root) : "Missing"}</p>
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
                    <p className="text-lg font-semibold">{mechanism.is_acyclic ? "Yes" : "No"}</p>
                  </div>
                </div>

                <div className="grid gap-3 md:grid-cols-2">
                  <div className="space-y-2">
                    <p className="text-xs font-medium uppercase text-muted-foreground">Fragments</p>
                    {nodes.slice(0, 8).map((node) => (
                      <div key={node.id} className="rounded-md border px-3 py-2">
                        <p className="truncate text-sm font-medium">{nodeLabel(node)}</p>
                        <p className="truncate text-xs text-muted-foreground">{node.entity_type ?? "Node"}</p>
                      </div>
                    ))}
                  </div>
                  <div className="space-y-2">
                    <p className="text-xs font-medium uppercase text-muted-foreground">Relationships</p>
                    {edges.slice(0, 8).map((edge) => (
                      <div key={edge.id} className="rounded-md border px-3 py-2">
                        <p className="truncate text-sm font-medium">{edgeLabel(edge)}</p>
                        <p className="truncate text-xs text-muted-foreground">
                          {edge.source_id} {"->"} {edge.target_id}
                        </p>
                      </div>
                    ))}
                  </div>
                </div>
              </>
            )}
          </CardContent>
        </Card>

        <Card className="rounded-md">
          <CardHeader>
            <CardTitle className="flex items-center gap-2 text-base">
              <GitBranch className="h-4 w-4" />
              Draft context
            </CardTitle>
            <CardDescription>Mechanism root links detected in the curator package.</CardDescription>
          </CardHeader>
          <CardContent className="space-y-3">
            {slugMode && workflowState.isLoading ? (
              <p className="text-sm text-muted-foreground">Loading draft package...</p>
            ) : draftRoots.length === 0 ? (
              <p className="text-sm text-muted-foreground">No draft HAS_MECHANISM_ROOT link found.</p>
            ) : (
              draftRoots.map((relationship, index) => (
                <div key={`${relationship.target_id ?? relationship.to_id ?? index}`} className="rounded-md border bg-muted/30 p-3">
                  <p className="text-xs font-medium text-muted-foreground">HAS_MECHANISM_ROOT</p>
                  <p className="mt-1 break-all text-sm">
                    {String(relationship.target_id ?? relationship.to_id ?? relationship.target ?? "Target pending")}
                  </p>
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
          ) : explainQuery.error ? (
            <p className="text-sm text-destructive">No published explain path yet.</p>
          ) : explainQuery.data?.data ? (
            <>
              <div className="rounded-md border bg-muted/30 p-3">
                <p className="text-xs font-medium text-muted-foreground">Summary</p>
                <p className="mt-1 text-sm">{explainQuery.data.data.answer_summary ?? "No summary yet."}</p>
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
              <div className="rounded-md border bg-muted/30">
                <div className="flex items-center gap-2 border-b px-3 py-2 text-xs font-medium text-muted-foreground">
                  <Braces className="h-3.5 w-3.5" />
                  Explain JSON
                </div>
                <pre className="minimal-scrollbar max-h-72 overflow-auto p-3 text-xs">
                  {JSON.stringify(explainQuery.data.data, null, 2)}
                </pre>
              </div>
            </>
          ) : null}
        </CardContent>
      </Card>
    </div>
  );
}

function MechanismsSurface() {
  const searchParams = useSearchParams();
  const focusedDrug = searchParams.get("drug");

  return (
    <div className="space-y-6">
      <KnowledgeSurface
        eyebrow="Mechanism layer"
        title="Mechanisms"
        status="API preview live"
        description="Mechanism fields are still curated through the Drug Editor, while the published mechanism DAG and Explain API preview are now visible from this surface."
        primary={{
          label: focusedDrug ? "Edit mechanism" : "Open graph context",
          href: focusedDrug ? `/knowledge/drugs/${encodeURIComponent(focusedDrug)}` : "/graph",
          icon: focusedDrug ? Pencil : GitBranch,
          description: focusedDrug
            ? "Open the focused Drug Editor mechanism fields."
            : "Inspect the graph surface state before adding a full DAG editor.",
        }}
        signals={[
          { label: "Drug mechanism fields", value: "live", tone: "success" },
          { label: "Published DAG API", value: "MVP live", tone: "success" },
          { label: "DAG editor", value: "deferred", tone: "warning" },
        ]}
        links={commonKnowledgeLinks}
        deferred={[
          "React Flow DAG editor with validation-safe writes",
          "Assertion-level SUPPORTED_BY evidence attachment",
          "Interactive pharmacology pathway diagrams",
        ]}
      />
      {focusedDrug && <FocusedMechanismPanel drug={focusedDrug} />}
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
