"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import {
  Background,
  Controls,
  MarkerType,
  MiniMap,
  ReactFlow,
  ReactFlowProvider,
  Handle,
  Position,
  useEdgesState,
  useNodesState,
  type Connection,
  type Edge,
  type Node,
  type NodeProps,
  type OnConnect,
} from "@xyflow/react";
import "@xyflow/react/dist/style.css";
import { GitBranch, Trash2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";
import { AddPathwayNodePanel } from "./add-pathway-node-panel";
import { CreateMechanismFragmentDialog } from "./create-mechanism-fragment-dialog";
import {
  PATHWAY_EDGE_TYPES,
  addPathwayEdge,
  addPathwayNode,
  isPathwayAcyclic,
  listMechanismRootIds,
  listPathwayEdges,
  listPathwayNodeIds,
  readFragmentLabel,
  removePathwayEdge,
  removePathwayNode,
  setMechanismRoot,
  type PathwayEdgeType,
} from "./mechanism-pathway";
import type { DrugPublishPackage } from "./types";

const DRUG_NODE_TYPE = "drug";
const FRAGMENT_NODE_TYPE = "pathway";

function DrugGraphNode({ data, selected }: NodeProps) {
  return (
    <div
      className={cn(
        "min-w-[10rem] max-w-[13rem] rounded-md border border-emerald-500/80 bg-emerald-500/15 px-3 py-2 shadow-sm",
        selected && "ring-2 ring-foreground/40",
      )}
    >
      <p className="truncate text-xs font-semibold">{String(data.label)}</p>
      <p className="truncate text-[10px] text-muted-foreground">Drug</p>
      <Handle type="source" position={Position.Right} className="!h-2 !w-2 !bg-muted-foreground" />
    </div>
  );
}

function PathwayNode({ data, selected }: NodeProps) {
  const isRoot = Boolean(data.isRoot);
  return (
    <div
      className={cn(
        "min-w-[10rem] max-w-[13rem] rounded-md border px-3 py-2 shadow-sm",
        isRoot ? "border-sky-500/80 bg-sky-500/15" : "border-border bg-card",
        selected && "ring-2 ring-foreground/40",
      )}
    >
      <Handle type="target" position={Position.Left} className="!h-2 !w-2 !bg-muted-foreground" />
      <p className="truncate text-xs font-semibold">{String(data.label)}</p>
      <p className="truncate text-[10px] text-muted-foreground">
        {isRoot ? "Mechanism root" : "Pathway fragment"}
      </p>
      <Handle type="source" position={Position.Right} className="!h-2 !w-2 !bg-muted-foreground" />
    </div>
  );
}

const nodeTypes = {
  [DRUG_NODE_TYPE]: DrugGraphNode,
  [FRAGMENT_NODE_TYPE]: PathwayNode,
};

function defaultFragmentPosition(index: number): { x: number; y: number } {
  const col = index % 3;
  const row = Math.floor(index / 3);
  return { x: 260 + col * 220, y: 40 + row * 140 };
}

function isPathwayEdgeTypeValue(value: unknown): value is PathwayEdgeType {
  return typeof value === "string" && (PATHWAY_EDGE_TYPES as readonly string[]).includes(value);
}

function drugLabel(pkg: DrugPublishPackage): string {
  const payload = pkg.entity_payload;
  if (typeof payload.label === "string" && payload.label.trim()) return payload.label;
  if (typeof payload.generic_name === "string" && payload.generic_name.trim()) {
    return payload.generic_name;
  }
  if (typeof payload.slug === "string" && payload.slug.trim()) return payload.slug;
  return "Drug";
}

function buildPackageGraph(
  pkg: DrugPublishPackage,
  drugEntityId: string,
  labelMap: Map<string, string>,
): { nodes: Node[]; edges: Edge[]; fragmentIds: string[]; signature: string } {
  const rootIds = listMechanismRootIds(pkg);
  const rootSet = new Set(rootIds);
  const fragmentIds = listPathwayNodeIds(pkg);
  const pathwayEdges = listPathwayEdges(pkg);

  const nodes: Node[] = [
    {
      id: drugEntityId,
      type: DRUG_NODE_TYPE,
      position: { x: 24, y: 120 },
      data: { label: drugLabel(pkg), kind: "drug" },
      deletable: false,
      connectable: true,
    },
  ];

  fragmentIds.forEach((id, index) => {
    nodes.push({
      id,
      type: FRAGMENT_NODE_TYPE,
      position: defaultFragmentPosition(index),
      data: {
        label: labelMap.get(id) ?? readFragmentLabel(pkg, id),
        isRoot: rootSet.has(id),
        kind: "fragment",
      },
    });
  });

  const edges: Edge[] = [
    ...rootIds.map((rootId) => ({
      id: `${drugEntityId}::HAS_MECHANISM_ROOT::${rootId}`,
      source: drugEntityId,
      target: rootId,
      label: "HAS MECHANISM ROOT",
      markerEnd: { type: MarkerType.ArrowClosed, width: 16, height: 16 },
      style: { strokeWidth: 1.5, stroke: "var(--muted-foreground)" },
      labelStyle: { fontSize: 9, fill: "var(--muted-foreground)" },
      data: { relationshipType: "HAS_MECHANISM_ROOT", kind: "root" as const },
    })),
    ...pathwayEdges.map((edge) => ({
      id: `${edge.source_id}::${edge.relationship_type}::${edge.target_id}`,
      source: edge.source_id,
      target: edge.target_id,
      label: edge.relationship_type.replaceAll("_", " "),
      markerEnd: { type: MarkerType.ArrowClosed, width: 16, height: 16 },
      style: { strokeWidth: 1.5 },
      labelStyle: { fontSize: 10, fill: "var(--muted-foreground)" },
      data: { relationshipType: edge.relationship_type, kind: "pathway" as const },
    })),
  ];

  const signature = [
    drugEntityId,
    ...fragmentIds.slice().sort(),
    ...edges.map((edge) => edge.id).sort(),
    ...rootIds.slice().sort().map((id) => `root:${id}`),
    ...fragmentIds.map((id) => `label:${id}:${labelMap.get(id) ?? ""}`),
  ].join("|");

  return { nodes, edges, fragmentIds, signature };
}

export interface PathwayEditorProps {
  pkg: DrugPublishPackage;
  drugEntityId: string;
  disabled?: boolean;
  onPackageChange: (next: DrugPublishPackage) => void;
}

export function PathwayEditor(props: PathwayEditorProps) {
  return (
    <ReactFlowProvider>
      <PathwayEditorInner {...props} />
    </ReactFlowProvider>
  );
}

function PathwayEditorInner({
  pkg,
  drugEntityId,
  disabled = false,
  onPackageChange,
}: PathwayEditorProps) {
  const [shouldFitView, setShouldFitView] = useState(true);
  const [edgeType, setEdgeType] = useState<PathwayEdgeType>("PRECEDES");
  const [selectedEdgeId, setSelectedEdgeId] = useState<string | null>(null);
  const [selectedNodeId, setSelectedNodeId] = useState<string | null>(null);
  const [connectError, setConnectError] = useState<string | null>(null);

  const rootIds = useMemo(() => listMechanismRootIds(pkg), [pkg]);
  const rootSet = useMemo(() => new Set(rootIds), [rootIds]);
  const fragmentIds = useMemo(() => listPathwayNodeIds(pkg), [pkg]);
  const acyclic = useMemo(() => isPathwayAcyclic(pkg), [pkg]);

  const labelMap = useMemo(() => {
    const map = new Map<string, string>();
    for (const id of fragmentIds) {
      map.set(id, readFragmentLabel(pkg, id));
    }
    return map;
  }, [pkg, fragmentIds]);

  const packageGraph = useMemo(
    () => buildPackageGraph(pkg, drugEntityId, labelMap),
    [pkg, drugEntityId, labelMap],
  );

  const [nodes, setNodes, onNodesChange] = useNodesState(packageGraph.nodes);
  const [edges, setEdges, onEdgesChange] = useEdgesState(packageGraph.edges);

  useEffect(() => {
    setNodes((current) => {
      const positions = new Map(current.map((node) => [node.id, node.position]));
      const selected = new Map(current.map((node) => [node.id, node.selected]));
      return packageGraph.nodes.map((node) => ({
        ...node,
        position: positions.get(node.id) ?? node.position,
        selected: selected.get(node.id) ?? false,
      }));
    });
    setEdges(packageGraph.edges);
  }, [packageGraph.signature, packageGraph.nodes, packageGraph.edges, setNodes, setEdges]);

  const onConnect: OnConnect = useCallback(
    (connection: Connection) => {
      if (disabled || !connection.source || !connection.target) return;
      setConnectError(null);

      const source = connection.source;
      const target = connection.target;

      if (target === drugEntityId) {
        setConnectError("Cannot connect into the Drug node.");
        return;
      }

      if (source === drugEntityId) {
        onPackageChange(
          setMechanismRoot(pkg, drugEntityId, target, true, {
            id: target,
            label: labelMap.get(target),
          }),
        );
        return;
      }

      try {
        onPackageChange(
          addPathwayEdge(pkg, {
            sourceId: source,
            targetId: target,
            relationshipType: edgeType,
            fragments: [
              { id: source, label: labelMap.get(source) },
              { id: target, label: labelMap.get(target) },
            ],
          }),
        );
      } catch (err) {
        setConnectError(err instanceof Error ? err.message : "Could not add pathway edge.");
      }
    },
    [disabled, drugEntityId, pkg, edgeType, labelMap, onPackageChange],
  );

  function addFragmentToCanvas(fragment: {
    entity_id: string;
    slug: string;
    label: string;
    description?: string | null;
  }) {
    if (disabled) return;
    onPackageChange(
      addPathwayNode(pkg, {
        id: fragment.entity_id,
        slug: fragment.slug,
        label: fragment.label,
        description: fragment.description,
      }),
    );
  }

  function toggleSelectedRoot(enabled: boolean) {
    if (disabled || !selectedNodeId || selectedNodeId === drugEntityId) return;
    onPackageChange(
      setMechanismRoot(pkg, drugEntityId, selectedNodeId, enabled, {
        id: selectedNodeId,
        label: labelMap.get(selectedNodeId),
      }),
    );
  }

  function deleteSelection() {
    if (disabled) return;
    if (selectedEdgeId) {
      const edge = edges.find((row) => row.id === selectedEdgeId);
      if (!edge) return;
      if (edge.data?.kind === "root" || edge.source === drugEntityId) {
        onPackageChange(setMechanismRoot(pkg, drugEntityId, edge.target, false));
        setSelectedEdgeId(null);
        return;
      }
      const relationshipType = isPathwayEdgeTypeValue(edge.data?.relationshipType)
        ? edge.data.relationshipType
        : undefined;
      onPackageChange(removePathwayEdge(pkg, edge.source, edge.target, relationshipType));
      setSelectedEdgeId(null);
      return;
    }
    if (selectedNodeId && selectedNodeId !== drugEntityId) {
      onPackageChange(removePathwayNode(pkg, selectedNodeId));
      setSelectedNodeId(null);
    }
  }

  const selectedIsFragment = Boolean(selectedNodeId && selectedNodeId !== drugEntityId);
  const selectedIsRoot = selectedIsFragment && selectedNodeId ? rootSet.has(selectedNodeId) : false;
  const canDelete =
    Boolean(selectedEdgeId) || (selectedIsFragment && selectedNodeId !== drugEntityId);

  return (
    <div className="space-y-3">
      <div className="flex flex-wrap items-center justify-between gap-2">
        <div>
          <p className="flex items-center gap-2 text-sm font-medium">
            <GitBranch className="h-4 w-4" />
            Pathway editor
          </p>
          <p className="text-xs text-muted-foreground">
            Add fragments, connect from the Drug node to set roots, then draw PRECEDES / BRANCHES_TO /
            MERGES_INTO steps. Changes save with the draft package.
          </p>
        </div>
        <div className="flex flex-wrap items-center gap-2">
          <label className="text-xs text-muted-foreground" htmlFor="pathway-edge-type">
            Edge type
          </label>
          <select
            id="pathway-edge-type"
            className="h-8 rounded-md border bg-background px-2 text-xs"
            value={edgeType}
            disabled={disabled}
            onChange={(event) => setEdgeType(event.target.value as PathwayEdgeType)}
          >
            {PATHWAY_EDGE_TYPES.map((type) => (
              <option key={type} value={type}>
                {type.replaceAll("_", " ")}
              </option>
            ))}
          </select>
          <AddPathwayNodePanel
            onCanvasIds={new Set(fragmentIds)}
            rootIds={rootSet}
            disabled={disabled}
            onAdd={addFragmentToCanvas}
          />
          <CreateMechanismFragmentDialog
            onCreated={(entity) =>
              addFragmentToCanvas({
                entity_id: entity.id,
                slug: entity.slug,
                label: entity.label,
                description: entity.description,
              })
            }
          />
          {selectedIsFragment && (
            <Button
              type="button"
              size="sm"
              variant="outline"
              disabled={disabled}
              onClick={() => toggleSelectedRoot(!selectedIsRoot)}
            >
              {selectedIsRoot ? "Unset root" : "Set as root"}
            </Button>
          )}
          <Button
            type="button"
            size="sm"
            variant="outline"
            disabled={disabled || !canDelete}
            onClick={deleteSelection}
          >
            <Trash2 className="h-4 w-4" />
            Delete
          </Button>
        </div>
      </div>

      {!acyclic && (
        <p className="rounded-md border border-destructive/40 bg-destructive/10 px-3 py-2 text-xs text-destructive">
          Pathway contains a cycle. Mechanism DAGs must stay acyclic (FG-C003).
        </p>
      )}
      {connectError && (
        <p className="rounded-md border border-destructive/40 bg-destructive/10 px-3 py-2 text-xs text-destructive">
          {connectError}
        </p>
      )}

      <div className="h-[28rem] overflow-hidden rounded-md border bg-muted/20">
        <ReactFlow
          nodes={nodes}
          edges={edges}
          nodeTypes={nodeTypes}
          onNodesChange={disabled ? undefined : onNodesChange}
          onEdgesChange={disabled ? undefined : onEdgesChange}
          onConnect={disabled ? undefined : onConnect}
          nodesDraggable={!disabled}
          nodesConnectable={!disabled}
          elementsSelectable={!disabled}
          fitView={shouldFitView}
          onInit={() => setShouldFitView(false)}
          minZoom={0.35}
          maxZoom={1.75}
          proOptions={{ hideAttribution: true }}
          onNodeClick={(_, node) => {
            setSelectedNodeId(node.id);
            setSelectedEdgeId(null);
          }}
          onEdgeClick={(_, edge) => {
            setSelectedEdgeId(edge.id);
            setSelectedNodeId(null);
          }}
          onPaneClick={() => {
            setSelectedEdgeId(null);
            setSelectedNodeId(null);
          }}
          onKeyDown={(event) => {
            if (disabled) return;
            if (event.key === "Backspace" || event.key === "Delete") {
              event.preventDefault();
              deleteSelection();
            }
          }}
        >
          <Background gap={18} size={1} />
          <Controls showInteractive={false} />
          <MiniMap pannable zoomable className="!bg-background" />
        </ReactFlow>
      </div>

      {fragmentIds.length === 0 && (
        <p className="text-xs text-muted-foreground">
          Canvas starts with the Drug node. Use <span className="font-medium">Add node</span> to place
          fragments, then connect Drug → fragment to mark roots.
        </p>
      )}
    </div>
  );
}
