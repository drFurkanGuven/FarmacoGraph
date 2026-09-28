"use client";

import { useCallback, useMemo, useState } from "react";
import {
  ReactFlow,
  addEdge,
  useNodesState,
  useEdgesState,
  Controls,
  Background,
  Handle,
  Position,
  type Connection,
  type Edge,
  type Node,
  type NodeProps,
  Panel,
  MiniMap,
} from "@xyflow/react";
import "@xyflow/react/dist/style.css";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import {
  Plus,
  Save,
  Trash2,
  Target,
  Zap,
  Activity,
  Heart,
  Pill,
  AlertCircle,
  Sparkles,
  RefreshCw,
  X,
  Settings2,
} from "lucide-react";
import { useUIMode } from "@/lib/ui-mode/context";
import { apiClient } from "@/lib/api";
import { cn } from "@/lib/utils";

type NodeTypeKey = "drug" | "target" | "mechanism" | "effect" | "outcome" | "adverse";

interface NodeData {
  label: string;
  description?: string;
  [key: string]: unknown;
}

const NODE_TYPES_CONFIG: Record<NodeTypeKey, {
  label: string;
  labelEn: string;
  icon: typeof Target;
  color: string;
  borderColor: string;
  ringColor: string;
  description: string;
  descriptionEn: string;
}> = {
  drug: {
    label: "İlaç",
    labelEn: "Drug",
    icon: Pill,
    color: "bg-blue-600",
    borderColor: "border-blue-500",
    ringColor: "ring-blue-500",
    description: "Molekül / Aktif Madde",
    descriptionEn: "Molecule / Active Pharmaceutical Ingredient",
  },
  target: {
    label: "Hedef",
    labelEn: "Target",
    icon: Target,
    color: "bg-blue-500",
    borderColor: "border-blue-400",
    ringColor: "ring-blue-400",
    description: "İlacın bağlandığı molekül (reseptör, enzim, kanal)",
    descriptionEn: "Molecule the drug binds to (receptor, enzyme, channel)",
  },
  mechanism: {
    label: "Mekanizma",
    labelEn: "Mechanism",
    icon: Zap,
    color: "bg-purple-500",
    borderColor: "border-purple-400",
    ringColor: "ring-purple-400",
    description: "Moleküler etki mekanizması",
    descriptionEn: "Molecular mechanism of action",
  },
  effect: {
    label: "Etki",
    labelEn: "Effect",
    icon: Activity,
    color: "bg-orange-500",
    borderColor: "border-orange-400",
    ringColor: "ring-orange-400",
    description: "Hücresel/doku etkisi",
    descriptionEn: "Cellular/tissue effect",
  },
  outcome: {
    label: "Klinik Sonuç",
    labelEn: "Outcome",
    icon: Heart,
    color: "bg-green-500",
    borderColor: "border-green-400",
    ringColor: "ring-green-400",
    description: "Klinik terapötik sonuç",
    descriptionEn: "Clinical therapeutic outcome",
  },
  adverse: {
    label: "Yan Etki",
    labelEn: "Adverse Effect",
    icon: AlertCircle,
    color: "bg-red-500",
    borderColor: "border-red-400",
    ringColor: "ring-red-400",
    description: "İstenmeyen etki",
    descriptionEn: "Unwanted side effect",
  },
};

const TEMPLATES = {
  "ace-inhibitor": {
    name: "ACE İnhibitörü (örn: Ramipril)",
    nameEn: "ACE Inhibitor (e.g., Ramipril)",
    nodes: [
      { id: "1", type: "target", label: "ACE Enzimi", description: "Anjiyotensin dönüştürücü enzim", position: { x: 0, y: 150 } },
      { id: "2", type: "mechanism", label: "Enzim İnhibisyonu", description: "ACE aktif bölgesine bağlanarak inhibisyon", position: { x: 280, y: 150 } },
      { id: "3", type: "effect", label: "Anjiyotensin II Azalması", description: "Vazokonstriktör peptid üretimi azalır", position: { x: 560, y: 150 } },
      { id: "4", type: "outcome", label: "Vazodilatasyon", description: "Damar genişlemesi", position: { x: 840, y: 80 } },
      { id: "5", type: "outcome", label: "BP Düşüşü", description: "Kan basıncında azalma", position: { x: 840, y: 220 } },
    ],
    edges: [
      { id: "e1-2", source: "1", target: "2" },
      { id: "e2-3", source: "2", target: "3" },
      { id: "e3-4", source: "3", target: "4" },
      { id: "e3-5", source: "3", target: "5" },
    ],
  },
  "beta-blocker": {
    name: "Beta-Bloker (örn: Metoprolol)",
    nameEn: "Beta-Blocker (e.g., Metoprolol)",
    nodes: [
      { id: "1", type: "target", label: "β1-Adrenerjik Reseptör", description: "Kalp pacemaker hücrelerinde", position: { x: 0, y: 150 } },
      { id: "2", type: "mechanism", label: "Reseptör Blokajı", description: "Katekolamin bağlanmasını engeller", position: { x: 280, y: 150 } },
      { id: "3", type: "effect", label: "Kalp Hızı Azalması", description: "Negatif kronotropi", position: { x: 560, y: 80 } },
      { id: "4", type: "effect", label: "Kontraktilite Azalması", description: "Negatif inotropi", position: { x: 560, y: 220 } },
      { id: "5", type: "outcome", label: "Oksijen İhtiyacı Azalması", description: "Miokardiyal O2 tüketimi düşer", position: { x: 840, y: 150 } },
    ],
    edges: [
      { id: "e1-2", source: "1", target: "2" },
      { id: "e2-3", source: "2", target: "3" },
      { id: "e2-4", source: "2", target: "4" },
      { id: "e3-5", source: "3", target: "5" },
      { id: "e4-5", source: "4", target: "5" },
    ],
  },
  "statin": {
    name: "Statin (örn: Atorvastatin)",
    nameEn: "Statin (e.g., Atorvastatin)",
    nodes: [
      { id: "1", type: "target", label: "HMG-CoA Redüktaz", description: "Karaciğerde kolesterol sentez enzimi", position: { x: 0, y: 150 } },
      { id: "2", type: "mechanism", label: "Enzim İnhibisyonu", description: "Kompaktif inhibitör", position: { x: 280, y: 150 } },
      { id: "3", type: "effect", label: "Kolesterol Sentezi Azalması", description: "Hepatik kolesterol üretimi düşer", position: { x: 560, y: 150 } },
      { id: "4", type: "outcome", label: "LDL Düşüşü", description: "Kanda LDL kolesterol azalır", position: { x: 840, y: 80 } },
      { id: "5", type: "outcome", label: "Kardiyovasküler Risk Azalması", description: "Kalp krizi ve inme riski azalır", position: { x: 840, y: 220 } },
    ],
    edges: [
      { id: "e1-2", source: "1", target: "2" },
      { id: "e2-3", source: "2", target: "3" },
      { id: "e3-4", source: "3", target: "4" },
      { id: "e3-5", source: "3", target: "5" },
    ],
  },
};

function CustomNode(props: NodeProps) {
  const { data, selected, type } = props;
  const nodeType = NODE_TYPES_CONFIG[(type || "target") as NodeTypeKey] || NODE_TYPES_CONFIG.target;
  const Icon = nodeType.icon;
  const nodeData = data as NodeData;

  return (
    <div
      className={cn(
        "relative px-4 py-3 rounded-xl shadow-lg border-2 bg-card min-w-[160px] max-w-[220px] transition-all",
        nodeType.borderColor,
        selected ? `ring-2 ring-offset-2 ${nodeType.ringColor} shadow-xl` : "hover:shadow-xl"
      )}
    >
      <Handle
        type="target"
        position={Position.Left}
        className="!w-3 !h-3 !border-2 !border-white !bg-muted-foreground"
      />

      <div className="flex items-center gap-2 mb-1">
        <div className={cn("p-1 rounded", nodeType.color)}>
          <Icon className="w-3 h-3 text-white" />
        </div>
        <span className="text-[10px] font-semibold uppercase tracking-wider text-muted-foreground">
          {nodeType.label}
        </span>
      </div>

      <p className="text-sm font-semibold text-foreground leading-tight">
        {nodeData.label || "İsimsiz Düğüm"}
      </p>

      {nodeData.description && (
        <p className="text-[10px] text-muted-foreground mt-1 leading-snug line-clamp-2">
          {nodeData.description}
        </p>
      )}

      <Handle
        type="source"
        position={Position.Right}
        className="!w-3 !h-3 !border-2 !border-white !bg-primary"
      />
    </div>
  );
}

const customNodeTypes = {
  drug: CustomNode,
  target: CustomNode,
  mechanism: CustomNode,
  effect: CustomNode,
  outcome: CustomNode,
  adverse: CustomNode,
};

export default function MechanismBuilderPage() {
  const { isSimple } = useUIMode();
  const [nodes, setNodes, onNodesChange] = useNodesState<Node<NodeData>>([]);
  const [edges, setEdges, onEdgesChange] = useEdgesState<Edge>([]);
  const [selectedNodeType, setSelectedNodeType] = useState<NodeTypeKey>("target");
  const [selectedNodeId, setSelectedNodeId] = useState<string | null>(null);
  const [drugName, setDrugName] = useState("");
  const [saved, setSaved] = useState(false);
  const [saving, setSaving] = useState(false);
  const [suggestions, setSuggestions] = useState<Array<{ smiles: string; mechanism_of_action: string }>>([]);
  const [loadingSuggestions, setLoadingSuggestions] = useState(false);
  const [loadingGraph, setLoadingGraph] = useState(false);

  const selectedNode = useMemo(
    () => nodes.find((n) => n.id === selectedNodeId) || null,
    [nodes, selectedNodeId]
  );

  const onConnect = useCallback(
    (params: Connection) => setEdges((eds) => addEdge(params, eds)),
    [setEdges]
  );

  const onNodeClick = useCallback((_: React.MouseEvent, node: Node) => {
    setSelectedNodeId(node.id);
  }, []);

  const onPaneClick = useCallback(() => {
    setSelectedNodeId(null);
  }, []);

  const getNextPosition = useCallback(() => {
    if (nodes.length === 0) return { x: 50, y: 150 };
    const maxX = Math.max(...nodes.map((n) => n.position.x));
    const sameXNodes = nodes.filter((n) => n.position.x === maxX);
    const maxY = Math.max(...sameXNodes.map((n) => n.position.y));
    if (sameXNodes.length >= 3) {
      return { x: maxX + 280, y: 150 };
    }
    return { x: maxX, y: maxY + 100 };
  }, [nodes]);

  const addNode = useCallback(() => {
    const nodeType = NODE_TYPES_CONFIG[selectedNodeType];
    const position = getNextPosition();
    const newNode: Node<NodeData> = {
      id: `node-${Date.now()}`,
      type: selectedNodeType,
      position,
      data: {
        label: isSimple ? nodeType.label : nodeType.labelEn,
        description: "",
      },
    };
    setNodes((nds) => [...nds, newNode]);
    setSelectedNodeId(newNode.id);
  }, [selectedNodeType, getNextPosition, setNodes, isSimple]);

  const loadTemplate = useCallback((templateKey: keyof typeof TEMPLATES) => {
    const template = TEMPLATES[templateKey];
    const newNodes: Node<NodeData>[] = template.nodes.map((n) => ({
      id: `t-${n.id}`,
      type: n.type,
      position: n.position,
      data: { label: n.label, description: n.description || "" },
    }));
    const newEdges: Edge[] = template.edges.map((e) => ({
      id: `t-${e.id}`,
      source: `t-${e.source}`,
      target: `t-${e.target}`,
    }));
    setNodes(newNodes);
    setEdges(newEdges);
    setSelectedNodeId(null);
  }, [setNodes, setEdges]);

  const clearAll = useCallback(() => {
    setNodes([]);
    setEdges([]);
    setSaved(false);
    setSuggestions([]);
    setSelectedNodeId(null);
  }, [setNodes, setEdges]);

  const deleteSelectedNode = useCallback(() => {
    if (!selectedNodeId) return;
    setNodes((nds) => nds.filter((n) => n.id !== selectedNodeId));
    setEdges((eds) => eds.filter((e) => e.source !== selectedNodeId && e.target !== selectedNodeId));
    setSelectedNodeId(null);
  }, [selectedNodeId, setNodes, setEdges]);

  const updateSelectedNode = useCallback((updates: Partial<NodeData>) => {
    if (!selectedNodeId) return;
    setNodes((nds) =>
      nds.map((n) =>
        n.id === selectedNodeId
          ? { ...n, data: { ...n.data, ...updates } }
          : n
      )
    );
  }, [selectedNodeId, setNodes]);

  const changeNodeType = useCallback((newType: NodeTypeKey) => {
    if (!selectedNodeId) return;
    setNodes((nds) =>
      nds.map((n) =>
        n.id === selectedNodeId ? { ...n, type: newType } : n
      )
    );
  }, [selectedNodeId, setNodes]);

  const fetchSuggestions = useCallback(async () => {
    if (!drugName.trim()) return;
    setLoadingSuggestions(true);
    try {
      const response = await apiClient.request<{ suggestions: Array<{ smiles: string; mechanism_of_action: string }> }>(
        `/mechanisms/suggestions/${encodeURIComponent(drugName)}?limit=5`
      );
      const data = response.data?.suggestions || [];
      setSuggestions(data);
    } catch (error) {
      console.error("Failed to fetch suggestions:", error);
    } finally {
      setLoadingSuggestions(false);
    }
  }, [drugName]);

  const loadGraphMechanism = useCallback(async () => {
    if (!drugName.trim()) return;
    setLoadingGraph(true);
    try {
      const response = await apiClient.request<{
        nodes: Array<{ id: string; label: string; type: string }>;
        edges: Array<{ id: string; source: string; target: string; label?: string }>;
      }>(`/mechanisms/graph/${encodeURIComponent(drugName.trim())}`);

      const graphData = response.data;
      if (!graphData || !graphData.nodes || graphData.nodes.length === 0) {
        alert(isSimple ? "Bu ilaç için grafikte mekanizma düğümü bulunamadı." : "No mechanism nodes found for this drug in the graph.");
        return;
      }

      // Auto-layout in distinct columns: Drug (40) -> Targets (320) -> Pathways (600) -> Outcomes/Adverse (880)
      const colX: Record<string, number> = {
        drug: 40,
        target: 320,
        mechanism: 600,
        pathway: 600,
        outcome: 880,
        adverse: 880,
      };
      const colCounts: Record<string, number> = {};

      const newNodes: Node<NodeData>[] = graphData.nodes.map((n) => {
        const typeKey = (n.type === "pathway" ? "mechanism" : n.type) as NodeTypeKey;
        const x = colX[n.type] ?? 320;
        const currentCount = colCounts[n.type] ?? 0;
        colCounts[n.type] = currentCount + 1;
        const y = 80 + currentCount * 110;

        return {
          id: n.id,
          type: typeKey,
          position: { x, y },
          data: { label: n.label, description: "" },
        };
      });

      const newEdges: Edge[] = (graphData.edges || []).map((e) => ({
        id: e.id,
        source: e.source,
        target: e.target,
        animated: true,
      }));

      setNodes(newNodes);
      setEdges(newEdges);
      setSelectedNodeId(null);
    } catch (err) {
      console.error("Failed to load graph mechanism:", err);
      alert(isSimple ? "Grafikten yüklenirken hata oluştu." : "Failed to load mechanism from graph.");
    } finally {
      setLoadingGraph(false);
    }
  }, [drugName, isSimple, setNodes, setEdges]);

  const saveMechanism = useCallback(async () => {
    if (!drugName.trim() || nodes.length === 0) return;
    setSaving(true);
    try {
      const payload = {
        drug_name: drugName,
        nodes: nodes.map((n) => ({
          id: n.id,
          type: n.type || "target",
          label: (n.data as NodeData)?.label || "",
          description: (n.data as NodeData)?.description || "",
          position: n.position,
        })),
        edges: edges.map((e) => ({
          id: e.id,
          source: e.source as string,
          target: e.target as string,
        })),
      };
      await apiClient.request("/mechanisms/save", {
        method: "POST",
        body: JSON.stringify(payload),
      });
      setSaved(true);
      setTimeout(() => setSaved(false), 3000);
    } catch (error) {
      console.error("Failed to save mechanism:", error);
      alert(isSimple ? "Kaydetme başarısız oldu." : "Failed to save mechanism.");
    } finally {
      setSaving(false);
    }
  }, [drugName, nodes, edges, isSimple]);

  const NodeInspector = () => {
    if (!selectedNode) return null;
    const nodeData = selectedNode.data as NodeData;
    const currentType = (selectedNode.type || "target") as NodeTypeKey;

    return (
      <Card className="border-primary/30 shadow-md">
        <CardHeader className="pb-3">
          <div className="flex items-center justify-between">
            <CardTitle className="text-sm flex items-center gap-2">
              <Settings2 className="w-4 h-4" />
              {isSimple ? "Düğüm Özellikleri" : "Node Inspector"}
            </CardTitle>
            <Button
              variant="ghost"
              size="sm"
              className="h-6 w-6 p-0"
              onClick={() => setSelectedNodeId(null)}
            >
              <X className="w-3 h-3" />
            </Button>
          </div>
        </CardHeader>
        <CardContent className="space-y-4 pt-0">
          <div className="space-y-1.5">
            <label className="text-xs font-medium text-muted-foreground">
              {isSimple ? "Düğüm Adı" : "Node Label"}
            </label>
            <input
              type="text"
              value={nodeData.label || ""}
              onChange={(e) => updateSelectedNode({ label: e.target.value })}
              placeholder={isSimple ? "Düğüm adını yazın..." : "Enter node name..."}
              className="w-full px-3 py-2 rounded-lg border bg-background text-sm focus:outline-none focus:ring-2 focus:ring-primary"
              autoFocus
            />
          </div>

          <div className="space-y-1.5">
            <label className="text-xs font-medium text-muted-foreground">
              {isSimple ? "Düğüm Tipi" : "Node Type"}
            </label>
            <div className="grid grid-cols-5 gap-1">
              {(Object.entries(NODE_TYPES_CONFIG) as [NodeTypeKey, typeof NODE_TYPES_CONFIG[NodeTypeKey]][]).map(
                ([key, config]) => {
                  const Icon = config.icon;
                  const isActive = currentType === key;
                  return (
                    <button
                      key={key}
                      onClick={() => changeNodeType(key)}
                      className={cn(
                        "flex flex-col items-center gap-1 p-2 rounded-lg border transition-colors",
                        isActive
                          ? `${config.color} text-white border-transparent`
                          : "bg-background border-border hover:border-primary/50"
                      )}
                      title={isSimple ? config.description : config.descriptionEn}
                    >
                      <Icon className="w-3.5 h-3.5" />
                      <span className="text-[9px] font-medium leading-tight text-center">
                        {isSimple ? config.label : config.labelEn}
                      </span>
                    </button>
                  );
                }
              )}
            </div>
          </div>

          <div className="space-y-1.5">
            <label className="text-xs font-medium text-muted-foreground">
              {isSimple ? "Açıklama / Biyolojik Detay" : "Description / Biological Detail"}
            </label>
            <textarea
              value={nodeData.description || ""}
              onChange={(e) => updateSelectedNode({ description: e.target.value })}
              placeholder={
                isSimple
                  ? "Bu düğüm hakkında detay yazın..."
                  : "Describe this node's biological role..."
              }
              rows={3}
              className="w-full px-3 py-2 rounded-lg border bg-background text-sm focus:outline-none focus:ring-2 focus:ring-primary resize-none"
            />
          </div>

          <div className="flex items-center gap-2 pt-1">
            <Badge variant="outline" className="text-[10px]">
              ID: {selectedNode.id.slice(0, 8)}
            </Badge>
            <Badge variant="outline" className="text-[10px]">
              {isSimple ? "Bağlantı" : "Edges"}:{" "}
              {edges.filter(
                (e) =>
                  (e.source as string) === selectedNodeId ||
                  (e.target as string) === selectedNodeId
              ).length}
            </Badge>
          </div>

          <Button
            variant="destructive"
            size="sm"
            className="w-full"
            onClick={deleteSelectedNode}
          >
            <Trash2 className="w-3.5 h-3.5 mr-1.5" />
            {isSimple ? "Düğümü Sil" : "Delete Node"}
          </Button>
        </CardContent>
      </Card>
    );
  };

  const CanvasPanel = () => (
    <ReactFlow
      nodes={nodes}
      edges={edges}
      onNodesChange={onNodesChange}
      onEdgesChange={onEdgesChange}
      onConnect={onConnect}
      onNodeClick={onNodeClick}
      onPaneClick={onPaneClick}
      nodeTypes={customNodeTypes}
      fitView
      className="bg-muted/20 w-full h-full"
      style={{ width: "100%", height: "100%" }}
      defaultEdgeOptions={{
        animated: true,
        style: { strokeWidth: 2, stroke: "hsl(var(--primary))" },
      }}
    >
      <Controls />
      <Background gap={20} size={1} />
      {!isSimple && <MiniMap />}
      <Panel position="top-left">
        <div className="bg-background/95 backdrop-blur rounded-xl border p-3 space-y-2 shadow-lg max-w-[220px]">
          <p className="text-xs font-semibold text-muted-foreground uppercase tracking-wider">
            {isSimple ? "Düğüm Ekle" : "Add Node"}
          </p>
          <div className={cn("gap-1", isSimple ? "flex flex-wrap" : "grid grid-cols-2")}>
            {(Object.entries(NODE_TYPES_CONFIG) as [NodeTypeKey, typeof NODE_TYPES_CONFIG[NodeTypeKey]][]).map(
              ([key, config]) => {
                const Icon = config.icon;
                return (
                  <Button
                    key={key}
                    variant={selectedNodeType === key ? "default" : "outline"}
                    size="sm"
                    onClick={() => setSelectedNodeType(key)}
                    className={cn("text-xs", !isSimple && "justify-start")}
                  >
                    <Icon className={cn(isSimple ? "w-3 h-3" : "w-3 h-3 mr-1")} />
                    {isSimple ? config.label.split(" ")[0] : config.labelEn}
                  </Button>
                );
              }
            )}
          </div>
          <Button size="sm" onClick={addNode} className="w-full">
            <Plus className="w-3.5 h-3.5 mr-1" />
            {isSimple ? "Düğüm Ekle" : "Add Node"}
          </Button>
        </div>
      </Panel>
      <Panel position="top-right">
        <div className="flex gap-2">
          <Button variant="outline" size="sm" onClick={clearAll}>
            <Trash2 className="w-3.5 h-3.5 mr-1" />
            {isSimple ? "Temizle" : "Clear"}
          </Button>
          <Button
            size="sm"
            onClick={saveMechanism}
            disabled={nodes.length === 0 || saving || !drugName.trim()}
          >
            {saving ? (
              <RefreshCw className="w-3.5 h-3.5 mr-1 animate-spin" />
            ) : (
              <Save className="w-3.5 h-3.5 mr-1" />
            )}
            {saved
              ? isSimple ? "Kaydedildi!" : "Saved!"
              : isSimple ? "Kaydet" : "Save"}
          </Button>
        </div>
      </Panel>
      <Panel position="bottom-left">
        <div className="bg-background/95 backdrop-blur rounded-lg border px-3 py-1.5 shadow-sm">
          <p className="text-xs text-muted-foreground">
            {nodes.length} {isSimple ? "düğüm" : "nodes"} · {edges.length}{" "}
            {isSimple ? "bağlantı" : "connections"}
            {selectedNodeId && (
              <span className="ml-2 text-primary font-medium">
                · {isSimple ? "1 seçili" : "1 selected"}
              </span>
            )}
          </p>
        </div>
      </Panel>
    </ReactFlow>
  );

  if (isSimple) {
    return (
      <div className="max-w-7xl mx-auto p-6 space-y-6">
        <div>
          <h1 className="text-2xl font-bold">Mekanizma Oluşturucu</h1>
          <p className="text-muted-foreground text-sm mt-1">
            İlaç etki mekanizmalarını görsel olarak oluşturun. Düğümlere tıklayarak düzenleyin.
          </p>
        </div>

        <div className="grid gap-4 lg:grid-cols-4">
          <div className="lg:col-span-1 space-y-4">
            <Card>
              <CardHeader className="pb-3">
                <CardTitle className="text-base">İlaç Bilgisi</CardTitle>
              </CardHeader>
              <CardContent className="space-y-3">
                <div className="flex gap-2">
                  <input
                    type="text"
                    placeholder="İlaç adı (örn: Ramipril)"
                    value={drugName}
                    onChange={(e) => setDrugName(e.target.value)}
                    className="flex-1 px-3 py-2 rounded-lg border bg-background text-sm"
                  />
                  <Button
                    variant="outline"
                    size="sm"
                    onClick={fetchSuggestions}
                    disabled={!drugName || loadingSuggestions}
                  >
                    {loadingSuggestions ? (
                      <RefreshCw className="w-4 h-4 animate-spin" />
                    ) : (
                      <Sparkles className="w-4 h-4" />
                    )}
                  </Button>
                </div>
                <Button
                  variant="default"
                  size="sm"
                  onClick={loadGraphMechanism}
                  disabled={!drugName.trim() || loadingGraph}
                  className="w-full text-xs bg-indigo-600 hover:bg-indigo-700 text-white font-medium"
                >
                  {loadingGraph ? (
                    <RefreshCw className="w-3.5 h-3.5 mr-1.5 animate-spin" />
                  ) : (
                    <Zap className="w-3.5 h-3.5 mr-1.5" />
                  )}
                  Grafikten Otomatik Yükle
                </Button>
                {suggestions.length > 0 && (
                  <div className="space-y-1 p-2 rounded-lg bg-muted/50 border">
                    <p className="text-[10px] font-medium text-muted-foreground uppercase tracking-wider">
                      ChEMBL Önerileri
                    </p>
                    {suggestions.map((s, i) => (
                      <div key={i} className="text-xs p-1.5 rounded bg-background border">
                        <span className="font-medium">{s.mechanism_of_action}</span>
                      </div>
                    ))}
                  </div>
                )}
              </CardContent>
            </Card>

            <Card>
              <CardHeader className="pb-3">
                <CardTitle className="text-base">Hazır Şablonlar</CardTitle>
              </CardHeader>
              <CardContent className="space-y-2">
                {Object.entries(TEMPLATES).map(([key, template]) => (
                  <Button
                    key={key}
                    variant="outline"
                    size="sm"
                    onClick={() => loadTemplate(key as keyof typeof TEMPLATES)}
                    className="w-full justify-start text-xs"
                  >
                    {template.name}
                  </Button>
                ))}
              </CardContent>
            </Card>

            {selectedNode && <NodeInspector />}
          </div>

          <div className="lg:col-span-3">
            <Card className="h-[600px]">
              <CardContent className="p-0 h-full overflow-hidden rounded-xl relative">
                <div className="absolute inset-0">
                  <CanvasPanel />
                </div>
              </CardContent>
            </Card>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="max-w-[1400px] mx-auto p-6 space-y-6">
      <div>
        <div className="inline-flex items-center gap-2 px-3 py-1 rounded-full text-xs font-medium bg-primary/10 text-primary mb-2">
          <Pill className="w-3.5 h-3.5" />
          Mechanism Builder
        </div>
        <h1 className="text-3xl font-bold tracking-tight">Visual Mechanism Editor</h1>
        <p className="text-muted-foreground text-sm mt-1">
          Create drug mechanism of action diagrams. Click nodes to edit their properties.
        </p>
      </div>

      <div className="grid gap-4 lg:grid-cols-12">
        <Card className="lg:col-span-2">
          <CardHeader className="pb-3">
            <CardTitle className="text-sm">Drug Info</CardTitle>
          </CardHeader>
          <CardContent className="space-y-3">
            <input
              type="text"
              placeholder="Drug name..."
              value={drugName}
              onChange={(e) => setDrugName(e.target.value)}
              className="w-full px-3 py-2 rounded-lg border bg-background text-sm"
            />
            <Button
              variant="outline"
              size="sm"
              className="w-full"
              onClick={fetchSuggestions}
              disabled={!drugName.trim() || loadingSuggestions}
            >
              {loadingSuggestions ? (
                <RefreshCw className="w-3.5 h-3.5 mr-1 animate-spin" />
              ) : (
                <Sparkles className="w-3.5 h-3.5 mr-1" />
              )}
              Get Suggestions
            </Button>
            <Button
              variant="default"
              size="sm"
              onClick={loadGraphMechanism}
              disabled={!drugName.trim() || loadingGraph}
              className="w-full text-xs bg-indigo-600 hover:bg-indigo-700 text-white font-medium"
            >
              {loadingGraph ? (
                <RefreshCw className="w-3.5 h-3.5 mr-1.5 animate-spin" />
              ) : (
                <Zap className="w-3.5 h-3.5 mr-1.5" />
              )}
              Auto-Load from Graph
            </Button>
            {suggestions.length > 0 && (
              <div className="space-y-1 p-2 rounded-lg bg-muted/50 border">
                <p className="text-[10px] font-medium text-muted-foreground uppercase tracking-wider">
                  ChEMBL Suggestions
                </p>
                {suggestions.map((s, i) => (
                  <div key={i} className="text-xs p-1.5 rounded bg-background border">
                    <span className="font-medium">{s.mechanism_of_action}</span>
                  </div>
                ))}
              </div>
            )}
            <div className="pt-2 border-t space-y-2">
              <p className="text-xs font-medium text-muted-foreground">Templates</p>
              {Object.entries(TEMPLATES).map(([key, template]) => (
                <Button
                  key={key}
                  variant="outline"
                  size="sm"
                  onClick={() => loadTemplate(key as keyof typeof TEMPLATES)}
                  className="w-full justify-start text-xs"
                >
                  {template.nameEn}
                </Button>
              ))}
            </div>
          </CardContent>
        </Card>

        <Card className="lg:col-span-7 h-[650px]">
          <CardContent className="p-0 h-full overflow-hidden rounded-xl relative">
            <div className="absolute inset-0">
              <CanvasPanel />
            </div>
          </CardContent>
        </Card>

        <div className="lg:col-span-3 space-y-4">
          {selectedNode ? (
            <NodeInspector />
          ) : (
            <Card>
              <CardHeader className="pb-3">
                <CardTitle className="text-sm flex items-center gap-2">
                  <Settings2 className="w-4 h-4" />
                  Node Inspector
                </CardTitle>
                <CardDescription className="text-xs">
                  Click on a node in the canvas to edit its properties.
                </CardDescription>
              </CardHeader>
              <CardContent>
                <div className="flex flex-col items-center justify-center py-6 text-center">
                  <div className="w-12 h-12 rounded-full bg-muted flex items-center justify-center mb-3">
                    <Target className="w-5 h-5 text-muted-foreground" />
                  </div>
                  <p className="text-xs text-muted-foreground">
                    Select a node to edit its label, type, and description.
                  </p>
                </div>
              </CardContent>
            </Card>
          )}

          <Card>
            <CardHeader className="pb-3">
              <CardTitle className="text-sm">Node Types</CardTitle>
            </CardHeader>
            <CardContent className="space-y-2">
              {(Object.entries(NODE_TYPES_CONFIG) as [NodeTypeKey, typeof NODE_TYPES_CONFIG[NodeTypeKey]][]).map(
                ([key, config]) => {
                  const Icon = config.icon;
                  return (
                    <div key={key} className="flex items-center gap-2 p-2 rounded-lg border">
                      <div className={cn("p-1.5 rounded", config.color)}>
                        <Icon className="w-3.5 h-3.5 text-white" />
                      </div>
                      <div className="min-w-0">
                        <p className="text-xs font-medium">{config.labelEn}</p>
                        <p className="text-[10px] text-muted-foreground truncate">
                          {config.descriptionEn}
                        </p>
                      </div>
                    </div>
                  );
                }
              )}
            </CardContent>
          </Card>
        </div>
      </div>
    </div>
  );
}
