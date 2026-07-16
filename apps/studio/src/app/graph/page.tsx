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
import { InteractiveGraphCanvas, relationshipLabel } from "@/components/graph";
import {
  GraphNeighborhoodEmptyState,
  resolveGraphEmptyReason,
} from "@/components/graph/graph-neighborhood-empty-state";
import { useDrugGraph, useDrugWorkflowState } from "@/lib/api/react-query/hooks";

const UUID_RE = /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{12}$/i;

function isUuid(value: string): boolean {
  return UUID_RE.test(value);
}

function FocusedGraphPanel({ drug }: { drug: string }) {
  const [depth, setDepth] = useState(2);
  const [selectedNodeId, setSelectedNodeId] = useState<string | null>(null);
  const slugMode = !isUuid(drug);
  const workflowState = useDrugWorkflowState(slugMode ? drug : "");
  const resolvedDrugId = isUuid(drug) ? drug : (workflowState.data?.data.entity_id ?? "");
  const identityResolved = Boolean(resolvedDrugId);
  const workflowStatus = workflowState.data?.data.status ?? null;
  const graphQuery = useDrugGraph(resolvedDrugId, depth);
  const graph = graphQuery.data?.data;
  const nodes = graph?.nodes ?? [];
  const edges = graph?.edges ?? [];
  const visibleEdges = selectedNodeId
    ? edges.filter((edge) => edge.source_id === selectedNodeId || edge.target_id === selectedNodeId)
    : edges;

  const editorHref = `/knowledge/drugs/${encodeURIComponent(drug)}`;
  const publishHref = `${editorHref}?publish=1`;
  const browserHref = "/knowledge/drugs";

  const waitingIdentity = slugMode && workflowState.isLoading;
  const emptyReason =
    waitingIdentity || graphQuery.isLoading
      ? null
      : resolveGraphEmptyReason({
          identityResolved: slugMode
            ? !workflowState.isError && identityResolved
            : identityResolved,
          workflowStatus,
          graph,
          graphError: graphQuery.error,
          nodeCount: nodes.length,
          edgeCount: edges.length,
        });

  return (
    <div className="space-y-4">
      <div className="grid gap-4 lg:grid-cols-[minmax(0,1fr)_340px]">
        <Card className="rounded-md">
          <CardHeader>
            <div className="flex flex-wrap items-center justify-between gap-3">
              <div>
                <CardTitle className="flex items-center gap-2 text-base">
                  <Network className="h-4 w-4" />
                  Drug neighborhood
                </CardTitle>
                <CardDescription>
                  Interactive projection from /drugs/{"{uuid}"}/graph — pan, zoom, and click nodes.
                </CardDescription>
              </div>
              <div className="flex items-center gap-2">
                {[1, 2, 3].map((value) => (
                  <Button
                    key={value}
                    type="button"
                    size="sm"
                    variant={depth === value ? "default" : "outline"}
                    onClick={() => setDepth(value)}
                  >
                    {value}
                  </Button>
                ))}
              </div>
            </div>
          </CardHeader>
          <CardContent className="space-y-4">
            {waitingIdentity ? (
              <p className="text-sm text-muted-foreground">Resolving draft drug identity...</p>
            ) : graphQuery.isLoading ? (
              <p className="text-sm text-muted-foreground">Loading graph projection...</p>
            ) : emptyReason && emptyReason !== "no_relationships" ? (
              <GraphNeighborhoodEmptyState
                reason={emptyReason}
                editorHref={emptyReason === "invalid_identity" ? browserHref : editorHref}
                publishHref={publishHref}
              />
            ) : (
              <>
                {emptyReason === "no_relationships" ? (
                  <GraphNeighborhoodEmptyState
                    reason="no_relationships"
                    editorHref={editorHref}
                    publishHref={publishHref}
                  />
                ) : null}
                <InteractiveGraphCanvas
                  nodes={nodes}
                  edges={edges}
                  selectedNodeId={selectedNodeId}
                  onSelectNode={setSelectedNodeId}
                />
                <div className="grid gap-3 md:grid-cols-4">
                  <div className="rounded-md border bg-muted/30 p-3">
                    <p className="text-xs text-muted-foreground">Depth</p>
                    <p className="text-lg font-semibold">{graph?.depth ?? depth}</p>
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
                    <p className="text-xs text-muted-foreground">Selected</p>
                    <p className="truncate text-sm font-semibold">{selectedNodeId ?? "—"}</p>
                  </div>
                </div>
              </>
            )}
          </CardContent>
        </Card>

        <Card className="rounded-md">
          <CardHeader>
            <CardTitle className="flex items-center gap-2 text-base">
              <Route className="h-4 w-4" />
              Focus
            </CardTitle>
            <CardDescription>Route-safe graph identity for this drug.</CardDescription>
          </CardHeader>
          <CardContent className="space-y-3">
            <div className="rounded-md border bg-muted/30 p-3">
              <p className="text-xs text-muted-foreground">Opened as</p>
              <p className="mt-1 break-all text-sm">{drug}</p>
            </div>
            {resolvedDrugId ? (
              <div className="rounded-md border bg-muted/30 p-3">
                <p className="text-xs text-muted-foreground">Resolved UUID</p>
                <p className="mt-1 break-all text-xs">{resolvedDrugId}</p>
              </div>
            ) : null}
            {workflowStatus ? (
              <div className="rounded-md border bg-muted/30 p-3">
                <p className="text-xs text-muted-foreground">Workflow</p>
                <p className="mt-1 text-sm font-medium capitalize">{workflowStatus}</p>
              </div>
            ) : null}
            {graph && graph.neo4j_available !== undefined ? (
              <div className="rounded-md border bg-muted/30 p-3">
                <p className="text-xs text-muted-foreground">Neo4j</p>
                <p className="mt-1 text-sm font-medium">
                  {graph.neo4j_available
                    ? graph.drug_in_graph
                      ? "Connected · drug in graph"
                      : "Connected · drug not in graph"
                    : "Unavailable"}
                </p>
              </div>
            ) : null}
            <Button asChild className="w-full" variant="outline">
              <Link href={editorHref}>
                <Pencil className="h-4 w-4" />
                Open editor
              </Link>
            </Button>
            {workflowStatus === "draft" ||
            workflowStatus === "review" ||
            workflowStatus === "approved" ||
            (graph?.neo4j_available && graph.drug_in_graph === false) ? (
              <Button asChild className="w-full">
                <Link href={publishHref}>
                  {workflowStatus === "approved" ? "Publish to graph" : "Open Publish Wizard"}
                </Link>
              </Button>
            ) : null}
          </CardContent>
        </Card>
      </div>

      <div className="grid gap-4 lg:grid-cols-2">
        <Card className="rounded-md">
          <CardHeader>
            <CardTitle className="text-base">Relationships</CardTitle>
            <CardDescription>
              {selectedNodeId
                ? "Edges connected to the selected node."
                : "First published edges in the focused neighborhood."}
            </CardDescription>
          </CardHeader>
          <CardContent className="space-y-2">
            {visibleEdges.length === 0 ? (
              <p className="text-sm text-muted-foreground">No published relationships in this projection.</p>
            ) : (
              visibleEdges.slice(0, 10).map((edge) => (
                <div key={edge.id} className="rounded-md border px-3 py-2">
                  <div className="flex flex-wrap items-center gap-2">
                    <Badge variant="muted">{relationshipLabel(edge)}</Badge>
                    {edge.target_type && <Badge variant="outline">{edge.target_type}</Badge>}
                  </div>
                  <p className="mt-2 break-all text-xs text-muted-foreground">
                    {edge.source_id} {"->"} {edge.target_id}
                  </p>
                </div>
              ))
            )}
          </CardContent>
        </Card>

        <Card className="rounded-md">
          <CardHeader>
            <CardTitle className="flex items-center gap-2 text-base">
              <Braces className="h-4 w-4" />
              Graph JSON
            </CardTitle>
            <CardDescription>Native payload available to downstream apps.</CardDescription>
          </CardHeader>
          <CardContent>
            <pre className="minimal-scrollbar max-h-96 overflow-auto rounded-md border bg-muted/30 p-3 text-xs">
              {JSON.stringify(graph ?? { nodes: [], edges: [], depth }, null, 2)}
            </pre>
          </CardContent>
        </Card>
      </div>
    </div>
  );
}

function GraphSurface() {
  const searchParams = useSearchParams();
  const focusedDrug = searchParams.get("drug");

  return (
    <div className="space-y-6">
      <KnowledgeSurface
        eyebrow="Graph explorer"
        title="Graph Explorer"
        status="MVP live"
        description="Pick a drug below to load its published Neo4j neighborhood. Snapshot relationship diffs remain deferred."
        primary={{
          label: focusedDrug ? "Open editor" : "Open drug browser",
          href: focusedDrug ? `/knowledge/drugs/${encodeURIComponent(focusedDrug)}` : "/knowledge/drugs",
          icon: focusedDrug ? Pencil : GitBranch,
          description: focusedDrug
            ? "Return to the focused drug curation workspace."
            : "Browse curriculum drugs, then return here to inspect the graph.",
        }}
        signals={[
          { label: "Graph write", value: "publish path", tone: "success" },
          { label: "Graph projection API", value: "MVP live", tone: "success" },
          { label: "Interactive canvas", value: "live", tone: "success" },
        ]}
        links={commonKnowledgeLinks}
        deferred={[
          "Generic POST /graph/query explorer",
          "Path highlighting between arbitrary entity pairs",
          "Relationship diff views across snapshots",
        ]}
      />
      <DrugFocusPicker
        title="Drug for graph projection"
        description="Select a published drug to render /drugs/{uuid}/graph. Empty canvas usually means the drug is not yet in Neo4j."
      />
      {focusedDrug ? <FocusedGraphPanel drug={focusedDrug} /> : null}
    </div>
  );
}

export default function GraphPage() {
  return (
    <Suspense fallback={null}>
      <GraphSurface />
    </Suspense>
  );
}
