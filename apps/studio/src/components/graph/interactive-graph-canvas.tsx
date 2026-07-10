"use client";

import { useCallback, useMemo } from "react";
import {
  Background,
  Controls,
  MiniMap,
  ReactFlow,
  Handle,
  Position,
  MarkerType,
  type Edge,
  type Node,
  type NodeProps,
} from "@xyflow/react";
import "@xyflow/react/dist/style.css";
import { cn } from "@/lib/utils";
import type { GraphEdgeData, GraphNodeData } from "@/lib/api";
import { buildRadialLayout, nodeLabel } from "./graph-canvas";

function toneClass(entityType: string | undefined): string {
  if (entityType === "Drug") return "border-emerald-500/70 bg-emerald-500/15";
  if (entityType === "Disease") return "border-rose-500/70 bg-rose-500/15";
  if (entityType === "MechanismFragment") return "border-sky-500/70 bg-sky-500/15";
  if (entityType === "EducationResource") return "border-amber-500/70 bg-amber-500/15";
  if (entityType === "Evidence") return "border-violet-500/70 bg-violet-500/15";
  return "border-border bg-card";
}

function GraphEntityNode({ data, selected }: NodeProps) {
  const entityType = String(data.entityType ?? "Node");
  return (
    <div
      className={cn(
        "min-w-[9rem] max-w-[12rem] rounded-md border px-3 py-2 shadow-sm",
        toneClass(entityType),
        selected && "ring-2 ring-foreground/40",
      )}
    >
      <Handle type="target" position={Position.Left} className="!h-2 !w-2 !bg-muted-foreground" />
      <p className="truncate text-xs font-semibold">{String(data.label)}</p>
      <p className="truncate text-[10px] text-muted-foreground">{entityType}</p>
      <Handle type="source" position={Position.Right} className="!h-2 !w-2 !bg-muted-foreground" />
    </div>
  );
}

const nodeTypes = { entity: GraphEntityNode };

export interface InteractiveGraphCanvasProps {
  nodes: GraphNodeData[];
  edges: GraphEdgeData[];
  selectedNodeId?: string | null;
  onSelectNode?: (nodeId: string | null) => void;
  className?: string;
  emptyMessage?: string;
}

export function InteractiveGraphCanvas({
  nodes,
  edges,
  selectedNodeId = null,
  onSelectNode,
  className,
  emptyMessage = "No graph nodes published yet.",
}: InteractiveGraphCanvasProps) {
  const flowNodes: Node[] = useMemo(() => {
    const positioned = buildRadialLayout(nodes);
    return positioned.map((node) => ({
      id: node.id,
      type: "entity",
      position: { x: node.x - 70, y: node.y - 24 },
      selected: node.id === selectedNodeId,
      data: {
        label: nodeLabel(node),
        entityType: node.entity_type ?? node.labels?.[0] ?? "Node",
      },
    }));
  }, [nodes, selectedNodeId]);

  const flowEdges: Edge[] = useMemo(
    () =>
      edges.slice(0, 48).map((edge) => ({
        id: edge.id,
        source: edge.source_id,
        target: edge.target_id,
        label: edge.relationship_type.replaceAll("_", " "),
        markerEnd: { type: MarkerType.ArrowClosed, width: 16, height: 16 },
        style: { strokeWidth: 1.5 },
        labelStyle: { fontSize: 10, fill: "var(--muted-foreground)" },
        animated: selectedNodeId
          ? edge.source_id === selectedNodeId || edge.target_id === selectedNodeId
          : false,
      })),
    [edges, selectedNodeId],
  );

  const onNodeClick = useCallback(
    (_: React.MouseEvent, node: Node) => {
      onSelectNode?.(node.id === selectedNodeId ? null : node.id);
    },
    [onSelectNode, selectedNodeId],
  );

  const onPaneClick = useCallback(() => {
    onSelectNode?.(null);
  }, [onSelectNode]);

  if (nodes.length === 0) {
    return (
      <div className="flex aspect-[16/9] min-h-72 items-center justify-center rounded-md border bg-muted/30 text-sm text-muted-foreground">
        {emptyMessage}
      </div>
    );
  }

  return (
    <div className={cn("h-[28rem] overflow-hidden rounded-md border bg-muted/20", className)}>
      <ReactFlow
        nodes={flowNodes}
        edges={flowEdges}
        nodeTypes={nodeTypes}
        fitView
        minZoom={0.35}
        maxZoom={1.75}
        proOptions={{ hideAttribution: true }}
        onNodeClick={onNodeClick}
        onPaneClick={onPaneClick}
      >
        <Background gap={18} size={1} />
        <Controls showInteractive={false} />
        <MiniMap pannable zoomable className="!bg-background" />
      </ReactFlow>
    </div>
  );
}
