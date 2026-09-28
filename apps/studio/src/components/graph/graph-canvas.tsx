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

export const FRAGMENT_LEVELS = ["molecular", "cellular", "tissue", "organ", "clinical"] as const;

/** Biological scale of a mechanism fragment, when the data carries it. */
export function fragmentLevel(node: GraphNodeData): string | null {
  const properties = node.properties as Record<string, unknown> | undefined;
  const raw = properties?.fragment_type;
  return typeof raw === "string" && (FRAGMENT_LEVELS as readonly string[]).includes(raw)
    ? raw
    : null;
}

const FRAGMENT_LEVEL_FILL: Record<string, string> = {
  molecular: "fill-indigo-500",
  cellular: "fill-cyan-500",
  tissue: "fill-violet-500",
  organ: "fill-amber-500",
  clinical: "fill-emerald-500",
};

export function nodeTone(node: GraphNodeData): string {
  const type = node.entity_type ?? node.labels?.[0] ?? "Node";
  if (type === "Drug") return "fill-emerald-500";
  if (type === "Disease") return "fill-rose-500";
  if (type === "MechanismFragment") {
    const level = fragmentLevel(node);
    if (level && FRAGMENT_LEVEL_FILL[level]) return FRAGMENT_LEVEL_FILL[level];
    return "fill-sky-500";
  }
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
  if (!root) return [];
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

function isMechanismFragment(node: GraphNodeData): boolean {
  const type = node.entity_type ?? node.labels?.[0];
  return type === "MechanismFragment";
}

/**
 * Layered layout for mechanism chains: one column per biological scale,
 * left to right (molecular → clinical), non-fragment nodes in a lead column.
 * Falls back to {@link buildRadialLayout} when no level data is present.
 */
export function buildLayeredLayout(nodes: GraphNodeData[]): PositionedNode[] {
  const capped = nodes.slice(0, 24);
  const lead = capped.filter((node) => !isMechanismFragment(node));
  const columns: GraphNodeData[][] = lead.length > 0 ? [lead] : [];
  for (const level of FRAGMENT_LEVELS) {
    const group = capped.filter(
      (node) => isMechanismFragment(node) && fragmentLevel(node) === level
    );
    if (group.length > 0) columns.push(group);
  }
  const unleveled = capped.filter((node) => isMechanismFragment(node) && !fragmentLevel(node));
  if (unleveled.length > 0) columns.push(unleveled);
  if (columns.length === 0) return [];

  const width = 720;
  const height = 380;
  const positioned: PositionedNode[] = [];
  columns.forEach((group, columnIndex) => {
    const x =
      columns.length === 1 ? width / 2 : 80 + (columnIndex * (width - 160)) / (columns.length - 1);
    group.forEach((node, rowIndex) => {
      const gap = Math.min(96, (height - 120) / Math.max(1, group.length));
      const y = height / 2 + (rowIndex - (group.length - 1) / 2) * gap;
      positioned.push({ ...node, x, y: Math.min(height - 50, Math.max(50, y)) });
    });
  });
  return positioned;
}

/** Layered when level data exists, radial otherwise. */
export function buildSmartLayout(nodes: GraphNodeData[]): PositionedNode[] {
  const hasLevels = nodes.some((node) => isMechanismFragment(node) && fragmentLevel(node) !== null);
  return hasLevels ? buildLayeredLayout(nodes) : buildRadialLayout(nodes);
}

export interface GraphCanvasProps {
  nodes: GraphNodeData[];
  edges: GraphEdgeData[];
  ariaLabel?: string;
}

const ENTITY_LEGEND: Array<{ label: string; fill: string }> = [
  { label: "Drug", fill: "bg-emerald-500" },
  { label: "Disease", fill: "bg-rose-500" },
  { label: "Evidence", fill: "bg-violet-500" },
  { label: "Education", fill: "bg-amber-500" },
];

const LEVEL_LEGEND: Array<{ label: string; fill: string }> = [
  { label: "molecular", fill: "bg-indigo-500" },
  { label: "cellular", fill: "bg-cyan-500" },
  { label: "tissue", fill: "bg-violet-500" },
  { label: "organ", fill: "bg-amber-500" },
  { label: "clinical", fill: "bg-emerald-500" },
];

/** Color key: entity types present, plus mechanism levels when present. */
export function GraphLegend({ nodes }: { nodes: GraphNodeData[] }) {
  const types = new Set(nodes.map((node) => node.entity_type ?? node.labels?.[0] ?? "Node"));
  const showLevels = nodes.some(
    (node) => node.entity_type === "MechanismFragment" && fragmentLevel(node) !== null
  );
  const entries = ENTITY_LEGEND.filter((entry) =>
    entry.label === "Education" ? types.has("EducationResource") : types.has(entry.label)
  );
  return (
    <div className="flex flex-wrap items-center gap-x-3 gap-y-1 text-[11px] text-muted-foreground">
      {entries.map((entry) => (
        <span key={entry.label} className="inline-flex items-center gap-1.5">
          <span className={`h-2.5 w-2.5 rounded-full ${entry.fill}`} />
          {entry.label}
        </span>
      ))}
      {showLevels && (
        <span className="inline-flex items-center gap-1.5">
          <span className="text-muted-foreground">levels:</span>
          {LEVEL_LEGEND.map((entry) => (
            <span key={entry.label} className="inline-flex items-center gap-1">
              <span className={`h-2.5 w-2.5 rounded-full ${entry.fill}`} />
              {entry.label}
            </span>
          ))}
        </span>
      )}
    </div>
  );
}

/** Static SVG neighborhood preview — extracted from Graph Explorer MVP. */
export function GraphCanvas({
  nodes,
  edges,
  ariaLabel = "Graph neighborhood preview",
}: GraphCanvasProps) {
  const positioned = useMemo(() => buildSmartLayout(nodes), [nodes]);
  const nodeById = new Map(positioned.map((node) => [node.id, node]));
  const visibleEdges = edges
    .map((edge) => ({
      edge,
      source: nodeById.get(edge.source_id),
      target: nodeById.get(edge.target_id),
    }))
    .filter(
      (item): item is { edge: GraphEdgeData; source: PositionedNode; target: PositionedNode } =>
        Boolean(item.source && item.target)
    )
    .slice(0, 24);

  if (positioned.length === 0) {
    return (
      <div className="flex aspect-[16/9] min-h-72 items-center justify-center rounded-md border bg-muted/30 text-sm text-muted-foreground">
        No graph nodes published yet.
      </div>
    );
  }

  const hiddenNodes = Math.max(0, nodes.length - positioned.length);
  const hiddenEdges = Math.max(0, edges.length - visibleEdges.length);

  return (
    <div className="overflow-hidden rounded-md border bg-muted/20">
      <div className="flex flex-wrap items-center justify-between gap-2 border-b px-3 py-2">
        <GraphLegend nodes={nodes} />
        {(hiddenNodes > 0 || hiddenEdges > 0) && (
          <span className="text-[11px] text-muted-foreground">
            Showing {positioned.length} of {nodes.length} nodes
            {hiddenEdges > 0 ? ` · ${visibleEdges.length} of ${edges.length} edges` : ""}
          </span>
        )}
      </div>
      <svg viewBox="0 0 720 380" role="img" aria-label={ariaLabel} className="h-auto w-full">
        {" "}
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
            <circle
              cx={node.x}
              cy={node.y}
              r="31"
              className="fill-none stroke-background stroke-2"
            />
            <text
              x={node.x}
              y={node.y + 48}
              textAnchor="middle"
              className="fill-foreground text-[11px] font-medium"
            >
              {nodeLabel(node).slice(0, 26)}
            </text>
            <text
              x={node.x}
              y={node.y + 62}
              textAnchor="middle"
              className="fill-muted-foreground text-[9px]"
            >
              {(node.entity_type ?? node.labels?.[0] ?? "Node").slice(0, 22)}
            </text>
          </g>
        ))}
      </svg>
    </div>
  );
}
