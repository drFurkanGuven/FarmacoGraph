"use client";

import Link from "next/link";
import { Suspense, useMemo, useState } from "react";
import { useSearchParams } from "next/navigation";
import { Braces, GitBranch, Network, Pencil, Route } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { KnowledgeSurface, commonKnowledgeLinks } from "@/components/knowledge/knowledge-surface";
import { useDrugGraph, useDrugWorkflowState } from "@/lib/api/react-query/hooks";
import type { GraphEdgeData, GraphNodeData } from "@/lib/api";

const UUID_RE = /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{12}$/i;

interface PositionedNode extends GraphNodeData {
  x: number;
  y: number;
}

function isUuid(value: string): boolean {
  return UUID_RE.test(value);
}

function nodeLabel(node: GraphNodeData): string {
  return node.label || node.slug || node.id;
}

function nodeTone(node: GraphNodeData): string {
  const type = node.entity_type ?? node.labels?.[0] ?? "Node";
  if (type === "Drug") return "fill-emerald-500";
  if (type === "Disease") return "fill-rose-500";
  if (type === "MechanismFragment") return "fill-sky-500";
  if (type === "EducationResource") return "fill-amber-500";
  if (type === "Evidence") return "fill-violet-500";
  return "fill-slate-500";
}

function relationshipLabel(edge: GraphEdgeData): string {
  return edge.relationship_type.replaceAll("_", " ");
}

function buildLayout(nodes: GraphNodeData[]): PositionedNode[] {
  if (nodes.length === 0) return [];
  const center = { x: 360, y: 190 };
  const [root, ...rest] = nodes.slice(0, 16);
  if (rest.length === 0) return [{ ...root, ...center }];
  const radius = rest.length > 8 ? 145 : 120;
  return [
    { ...root, ...center },
    ...rest.map((node, index) => {
      const angle = (Math.PI * 2 * index) / rest.length - Math.PI / 2;
      return {
        ...node,
        x: center.x + Math.cos(angle) * radius,
        y: center.y + Math.sin(angle) * radius,
      };
    }),
  ];
}

function GraphCanvas({ nodes, edges }: { nodes: GraphNodeData[]; edges: GraphEdgeData[] }) {
  const positioned = useMemo(() => buildLayout(nodes), [nodes]);
  const nodeById = new Map(positioned.map((node) => [node.id, node]));
  const visibleEdges = edges
    .map((edge) => ({ edge, source: nodeById.get(edge.source_id), target: nodeById.get(edge.target_id) }))
    .filter((item): item is { edge: GraphEdgeData; source: PositionedNode; target: PositionedNode } =>
      Boolean(item.source && item.target),
    )
    .slice(0, 24);

  if (positioned.length === 0) {
    return (
      <div className="flex aspect-[16/9] min-h-72 items-center justify-center rounded-md border bg-muted/30 text-sm text-muted-foreground">
        No graph nodes published yet.
      </div>
    );
  }

  return (
    <div className="overflow-hidden rounded-md border bg-muted/20">
      <svg viewBox="0 0 720 380" role="img" aria-label="Drug graph neighborhood preview" className="h-auto w-full">
        <defs>
          <marker id="graph-arrow" markerHeight="8" markerWidth="8" orient="auto" refX="7" refY="4">
            <path d="M0,0 L8,4 L0,8 z" className="fill-muted-foreground" />
          </marker>
        </defs>
        <rect width="720" height="380" className="fill-background" />
        {visibleEdges.map(({ edge, source, target }) => (
          <g key={edge.id}>
            <line
              x1={source.x}
              x2={target.x}
              y1={source.y}
              y2={target.y}
              className="stroke-muted-foreground/50"
              markerEnd="url(#graph-arrow)"
              strokeWidth="1.5"
            />
            <text
              x={(source.x + target.x) / 2}
              y={(source.y + target.y) / 2 - 6}
              textAnchor="middle"
              className="fill-muted-foreground text-[9px]"
            >
              {edge.relationship_type}
            </text>
          </g>
        ))}
        {positioned.map((node) => (
          <g key={node.id}>
            <circle cx={node.x} cy={node.y} r="28" className={`${nodeTone(node)} opacity-90`} />
            <circle cx={node.x} cy={node.y} r="31" className="fill-none stroke-background stroke-2" />
            <text x={node.x} y={node.y + 48} textAnchor="middle" className="fill-foreground text-[11px] font-medium">
              {nodeLabel(node).slice(0, 26)}
            </text>
            <text x={node.x} y={node.y + 62} textAnchor="middle" className="fill-muted-foreground text-[9px]">
              {(node.entity_type ?? node.labels?.[0] ?? "Node").slice(0, 22)}
            </text>
          </g>
        ))}
      </svg>
    </div>
  );
}

function FocusedGraphPanel({ drug }: { drug: string }) {
  const [depth, setDepth] = useState(2);
  const slugMode = !isUuid(drug);
  const workflowState = useDrugWorkflowState(slugMode ? drug : "");
  const resolvedDrugId = isUuid(drug) ? drug : (workflowState.data?.data.entity_id ?? "");
  const graphQuery = useDrugGraph(resolvedDrugId, depth);
  const graph = graphQuery.data?.data;
  const nodes = graph?.nodes ?? [];
  const edges = graph?.edges ?? [];

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
                <CardDescription>Published graph projection from /drugs/{"{uuid}"}/graph.</CardDescription>
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
            {slugMode && workflowState.isLoading ? (
              <p className="text-sm text-muted-foreground">Resolving draft drug identity...</p>
            ) : graphQuery.isLoading ? (
              <p className="text-sm text-muted-foreground">Loading graph projection...</p>
            ) : graphQuery.error ? (
              <p className="text-sm text-destructive">Unable to load graph projection.</p>
            ) : (
              <>
                <GraphCanvas nodes={nodes} edges={edges} />
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
                    <p className="text-xs text-muted-foreground">Layout</p>
                    <p className="text-lg font-semibold">{graph?.layout_hint ?? "dagre"}</p>
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
            {resolvedDrugId && (
              <div className="rounded-md border bg-muted/30 p-3">
                <p className="text-xs text-muted-foreground">Resolved UUID</p>
                <p className="mt-1 break-all text-xs">{resolvedDrugId}</p>
              </div>
            )}
            <Button asChild className="w-full" variant="outline">
              <Link href={`/knowledge/drugs/${encodeURIComponent(drug)}`}>
                <Pencil className="h-4 w-4" />
                Open editor
              </Link>
            </Button>
          </CardContent>
        </Card>
      </div>

      <div className="grid gap-4 lg:grid-cols-2">
        <Card className="rounded-md">
          <CardHeader>
            <CardTitle className="text-base">Relationships</CardTitle>
            <CardDescription>First published edges in the focused neighborhood.</CardDescription>
          </CardHeader>
          <CardContent className="space-y-2">
            {edges.length === 0 ? (
              <p className="text-sm text-muted-foreground">No published relationships in this projection.</p>
            ) : (
              edges.slice(0, 10).map((edge) => (
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
        description="The graph explorer now reads the published drug neighborhood projection while the heavier interactive expansion canvas remains deferred."
        primary={{
          label: focusedDrug ? "Open editor" : "Open evidence",
          href: focusedDrug ? `/knowledge/drugs/${encodeURIComponent(focusedDrug)}` : "/knowledge/evidence",
          icon: focusedDrug ? Pencil : GitBranch,
          description: focusedDrug
            ? "Return to the focused drug curation workspace."
            : "Review the evidence layer that supports graph assertions.",
        }}
        signals={[
          { label: "Graph write", value: "publish path", tone: "success" },
          { label: "Graph projection API", value: "MVP live", tone: "success" },
          { label: "Interactive canvas", value: "deferred", tone: "warning" },
        ]}
        links={commonKnowledgeLinks}
        deferred={[
          "Cytoscape or React Flow expansion canvas",
          "Path highlighting between selected entities",
          "Relationship diff views across snapshots",
        ]}
      />
      {focusedDrug && <FocusedGraphPanel drug={focusedDrug} />}
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
