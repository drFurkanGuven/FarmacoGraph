"use client";

import { useMemo } from "react";
import type { GraphEdgeData, GraphNodeData } from "@/lib/api";

export interface PositionedNode extends GraphNodeData {
  x: number;
  y: number;
}

export function nodeLabel(node: GraphNodeData): string {
  return node.label || node.slug || node.id;
}

export function nodeTone(node: GraphNodeData): string {
  const type = node.entity_type ?? node.labels?.[0] ?? "Node";
  if (type === "Drug") return "fill-emerald-500";
  if (type === "Disease") return "fill-rose-500";
  if (type === "MechanismFragment") return "fill-sky-500";
  if (type === "EducationResource") return "fill-amber-500";
  if (type === "Evidence") return "fill-violet-500";
  return "fill-slate-500";
}

export function relationshipLabel(edge: GraphEdgeData): string {
  return edge.relationship_type.replaceAll("_", " ");
}

export function buildRadialLayout(nodes: GraphNodeData[]): PositionedNode[] {
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

export interface GraphCanvasProps {
  nodes: GraphNodeData[];
  edges: GraphEdgeData[];
  ariaLabel?: string;
}

/** Static SVG neighborhood preview — extracted from Graph Explorer MVP. */
export function GraphCanvas({
  nodes,
  edges,
  ariaLabel = "Graph neighborhood preview",
}: GraphCanvasProps) {
  const positioned = useMemo(() => buildRadialLayout(nodes), [nodes]);
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
      <svg viewBox="0 0 720 380" role="img" aria-label={ariaLabel} className="h-auto w-full">
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
