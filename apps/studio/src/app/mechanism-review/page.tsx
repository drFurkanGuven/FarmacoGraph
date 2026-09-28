"use client";

import { useEffect, useState } from "react";
import {
  CheckCircle2,
  XCircle,
  MessageSquare,
  Loader2,
  GitBranch,
  Clock,
  User,
  Eye,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { useUIMode } from "@/lib/ui-mode/context";
import { apiClient } from "@/lib/api";

interface MechanismReviewItem {
  id: string;
  drug_name: string;
  description: string | null;
  node_count: number;
  edge_count: number;
  state: string;
  created_at: string | null;
  created_by: string | null;
}

interface MechanismDetail {
  id: string;
  state: string;
  created_at: string | null;
  updated_at: string | null;
  package: {
    entity_payload: {
      drug_name: string;
      description: string | null;
      nodes: Array<{
        id: string;
        type: string;
        label: string;
        position: { x: number; y: number };
      }>;
      edges: Array<{
        id: string;
        source: string;
        target: string;
      }>;
    };
    source: string;
    created_by: string | null;
  };
}

export default function MechanismReviewPage() {
  const { isSimple } = useUIMode();
  const [items, setItems] = useState<MechanismReviewItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [selectedItem, setSelectedItem] = useState<MechanismDetail | null>(null);
  const [actionLoading, setActionLoading] = useState(false);
  const [notes, setNotes] = useState("");
  const [filter, setFilter] = useState<"draft" | "approved" | "rejected" | "changes_requested">("draft");

  useEffect(() => {
    loadItems();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [filter]);

  async function loadItems() {
    setLoading(true);
    try {
      const response = await apiClient.request<{ items: MechanismReviewItem[] }>(
        `/mechanisms/review?state=${filter}`
      );
      const data = response.data?.items || [];
      setItems(data);
    } catch (error) {
      console.error("Failed to load mechanisms:", error);
    } finally {
      setLoading(false);
    }
  }

  async function loadDetail(id: string) {
    try {
      const response = await apiClient.request<MechanismDetail>(`/mechanisms/review/${id}`);
      setSelectedItem(response.data);
      setNotes("");
    } catch (error) {
      console.error("Failed to load mechanism detail:", error);
    }
  }

  async function handleAction(action: "approve" | "reject" | "request_changes") {
    if (!selectedItem) return;

    setActionLoading(true);
    try {
      await apiClient.request(`/mechanisms/review/${selectedItem.id}/action`, {
        method: "POST",
        body: JSON.stringify({ action, notes: notes || null }),
      });

      setSelectedItem(null);
      setNotes("");
      await loadItems();
    } catch (error) {
      console.error("Failed to perform action:", error);
      alert(isSimple ? "İşlem başarısız" : "Action failed");
    } finally {
      setActionLoading(false);
    }
  }

  const getStateBadge = (state: string) => {
    switch (state) {
      case "draft":
        return { label: isSimple ? "Bekliyor" : "Pending", className: "bg-yellow-500/10 text-yellow-600 border-yellow-500/30" };
      case "approved":
        return { label: isSimple ? "Onaylandı" : "Approved", className: "bg-green-500/10 text-green-600 border-green-500/30" };
      case "rejected":
        return { label: isSimple ? "Reddedildi" : "Rejected", className: "bg-red-500/10 text-red-600 border-red-500/30" };
      case "changes_requested":
        return { label: isSimple ? "Düzeltme İstendi" : "Changes Requested", className: "bg-orange-500/10 text-orange-600 border-orange-500/30" };
      default:
        return { label: state, className: "bg-gray-500/10 text-gray-600 border-gray-500/30" };
    }
  };

  const getNodeColor = (type: string) => {
    switch (type) {
      case "target": return "bg-blue-500";
      case "mechanism": return "bg-purple-500";
      case "effect": return "bg-orange-500";
      case "outcome": return "bg-green-500";
      case "adverse": return "bg-red-500";
      default: return "bg-gray-500";
    }
  };

  if (isSimple) {
    return (
      <div className="max-w-5xl mx-auto p-6 space-y-6">
        <div>
          <h1 className="text-2xl font-bold">Mekanizma Onayı</h1>
          <p className="text-muted-foreground text-sm mt-1">
            Oluşturulan mekanizma diyagramlarını inceleyin ve onaylayın
          </p>
        </div>

        <Card>
          <CardHeader>
            <CardTitle className="text-base">Filtre</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="flex gap-2 flex-wrap">
              {[
                { value: "draft", label: "Bekleyen" },
                { value: "approved", label: "Onaylanan" },
                { value: "rejected", label: "Reddedilen" },
                { value: "changes_requested", label: "Düzeltme İstenen" },
              ].map((f) => (
                <Button
                  key={f.value}
                  variant={filter === f.value ? "default" : "outline"}
                  size="sm"
                  onClick={() => setFilter(f.value as "draft" | "approved" | "rejected" | "changes_requested")}
                >
                  {f.label}
                </Button>
              ))}
            </div>
          </CardContent>
        </Card>

        {loading ? (
          <div className="flex items-center justify-center p-12">
            <Loader2 className="w-6 h-6 animate-spin text-primary" />
          </div>
        ) : items.length === 0 ? (
          <Card>
            <CardContent className="p-8 text-center">
              <GitBranch className="w-12 h-12 mx-auto text-muted-foreground mb-3" />
              <p className="text-muted-foreground">
                {filter === "draft" ? "Bekleyen mekanizma bulunmuyor" : "Bu durumda mekanizma bulunmuyor"}
              </p>
            </CardContent>
          </Card>
        ) : (
          <div className="space-y-3">
            {items.map((item) => {
              const stateBadge = getStateBadge(item.state);
              return (
                <Card key={item.id} className="hover:shadow-md transition-shadow">
                  <CardContent className="p-4">
                    <div className="flex items-start justify-between gap-3">
                      <div className="flex-1 min-w-0">
                        <div className="flex items-center gap-2 flex-wrap">
                          <span className="font-medium">{item.drug_name}</span>
                          <Badge className={stateBadge.className}>{stateBadge.label}</Badge>
                        </div>
                        {item.description && (
                          <p className="text-sm text-muted-foreground mt-1 truncate">
                            {item.description}
                          </p>
                        )}
                        <div className="flex items-center gap-3 mt-2 text-xs text-muted-foreground">
                          <span className="flex items-center gap-1">
                            <GitBranch className="w-3 h-3" />
                            {item.node_count} düğüm, {item.edge_count} bağlantı
                          </span>
                          {item.created_at && (
                            <span className="flex items-center gap-1">
                              <Clock className="w-3 h-3" />
                              {new Date(item.created_at).toLocaleDateString("tr-TR")}
                            </span>
                          )}
                        </div>
                      </div>
                      <Button
                        variant="outline"
                        size="sm"
                        onClick={() => loadDetail(item.id)}
                      >
                        <Eye className="w-4 h-4 mr-1" />
                        İncele
                      </Button>
                    </div>
                  </CardContent>
                </Card>
              );
            })}
          </div>
        )}

        {selectedItem && (
          <Card className="border-primary/30">
            <CardHeader>
              <div className="flex items-center justify-between">
                <CardTitle className="text-base">{selectedItem.package.entity_payload.drug_name}</CardTitle>
                <Button variant="ghost" size="sm" onClick={() => setSelectedItem(null)}>
                  Kapat
                </Button>
              </div>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="p-4 rounded-lg bg-muted/30 border">
                <p className="text-xs font-medium text-muted-foreground mb-2">Düğüm Yapısı</p>
                <div className="flex flex-wrap gap-2">
                  {selectedItem.package.entity_payload.nodes.map((node) => (
                    <div
                      key={node.id}
                      className={`px-2 py-1 rounded text-xs text-white ${getNodeColor(node.type)}`}
                    >
                      {node.label}
                    </div>
                  ))}
                </div>
              </div>

              <div className="p-4 rounded-lg bg-muted/30 border">
                <p className="text-xs font-medium text-muted-foreground mb-2">Bağlantılar</p>
                <div className="space-y-1">
                  {selectedItem.package.entity_payload.edges.map((edge) => {
                    const sourceNode = selectedItem.package.entity_payload.nodes.find(n => n.id === edge.source);
                    const targetNode = selectedItem.package.entity_payload.nodes.find(n => n.id === edge.target);
                    return (
                      <div key={edge.id} className="text-xs flex items-center gap-1">
                        <span className="font-medium">{sourceNode?.label}</span>
                        <span className="text-muted-foreground">→</span>
                        <span className="font-medium">{targetNode?.label}</span>
                      </div>
                    );
                  })}
                </div>
              </div>

              <div>
                <label className="text-xs font-medium text-muted-foreground">Notlar (opsiyonel)</label>
                <textarea
                  value={notes}
                  onChange={(e) => setNotes(e.target.value)}
                  placeholder="Onay/red notu ekleyin..."
                  className="w-full mt-1 px-3 py-2 rounded-lg border bg-background text-sm min-h-[60px]"
                />
              </div>

              <div className="flex gap-2">
                <Button
                  onClick={() => handleAction("approve")}
                  disabled={actionLoading}
                  className="flex-1 bg-green-600 hover:bg-green-700"
                >
                  {actionLoading ? <Loader2 className="w-4 h-4 mr-2 animate-spin" /> : <CheckCircle2 className="w-4 h-4 mr-2" />}
                  Onayla
                </Button>
                <Button
                  variant="outline"
                  onClick={() => handleAction("request_changes")}
                  disabled={actionLoading}
                  className="flex-1"
                >
                  <MessageSquare className="w-4 h-4 mr-2" />
                  Düzeltme İste
                </Button>
                <Button
                  variant="outline"
                  onClick={() => handleAction("reject")}
                  disabled={actionLoading}
                  className="flex-1 border-red-500/30 text-red-600 hover:bg-red-500/10"
                >
                  <XCircle className="w-4 h-4 mr-2" />
                  Reddet
                </Button>
              </div>
            </CardContent>
          </Card>
        )}
      </div>
    );
  }

  // Professional mode
  return (
    <div className="max-w-6xl mx-auto p-6 space-y-6">
      <div>
        <div className="inline-flex items-center gap-2 px-3 py-1 rounded-full text-xs font-medium bg-primary/10 text-primary mb-2">
          <GitBranch className="w-3.5 h-3.5" />
          Mechanism Review
        </div>
        <h1 className="text-3xl font-bold tracking-tight">Mechanism Diagram Review</h1>
        <p className="text-muted-foreground text-sm mt-1">
          Review and approve mechanism diagrams created by curators.
        </p>
      </div>

      <Card>
        <CardHeader>
          <CardTitle className="text-sm">Filter by Status</CardTitle>
        </CardHeader>
        <CardContent>
          <div className="flex gap-2">
            {[
              { value: "draft", label: "Pending" },
              { value: "approved", label: "Approved" },
              { value: "rejected", label: "Rejected" },
              { value: "changes_requested", label: "Changes Requested" },
            ].map((f) => (
              <Button
                key={f.value}
                variant={filter === f.value ? "default" : "outline"}
                size="sm"
                onClick={() => setFilter(f.value as "draft" | "approved" | "rejected" | "changes_requested")}
              >
                {f.label}
              </Button>
            ))}
          </div>
        </CardContent>
      </Card>

      {loading ? (
        <div className="flex items-center justify-center p-12">
          <Loader2 className="w-6 h-6 animate-spin text-primary" />
        </div>
      ) : items.length === 0 ? (
        <Card>
          <CardContent className="p-12 text-center">
            <GitBranch className="w-12 h-12 mx-auto text-muted-foreground mb-3" />
            <p className="text-muted-foreground">
              No mechanisms found in &quot;{filter}&quot; state.
            </p>
          </CardContent>
        </Card>
      ) : (
        <div className="space-y-3">
          {items.map((item) => {
            const stateBadge = getStateBadge(item.state);
            return (
              <Card key={item.id} className="hover:shadow-md transition-shadow">
                <CardContent className="p-5">
                  <div className="flex items-start justify-between gap-4">
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center gap-2 flex-wrap">
                        <span className="font-semibold text-lg">{item.drug_name}</span>
                        <Badge className={stateBadge.className}>{stateBadge.label}</Badge>
                      </div>
                      {item.description && (
                        <p className="text-sm text-muted-foreground mt-1 truncate">
                          {item.description}
                        </p>
                      )}
                      <div className="flex items-center gap-4 mt-2 text-xs text-muted-foreground">
                        <span className="flex items-center gap-1">
                          <GitBranch className="w-3 h-3" />
                          {item.node_count} nodes, {item.edge_count} edges
                        </span>
                        {item.created_at && (
                          <span className="flex items-center gap-1">
                            <Clock className="w-3 h-3" />
                            {new Date(item.created_at).toLocaleDateString()}
                          </span>
                        )}
                        {item.created_by && (
                          <span className="flex items-center gap-1">
                            <User className="w-3 h-3" />
                            {item.created_by.slice(0, 8)}...
                          </span>
                        )}
                      </div>
                    </div>
                    <Button
                      variant="outline"
                      onClick={() => loadDetail(item.id)}
                    >
                      <Eye className="w-4 h-4 mr-2" />
                      Review
                    </Button>
                  </div>
                </CardContent>
              </Card>
            );
          })}
        </div>
      )}

      {selectedItem && (
        <Card className="border-primary/30">
          <CardHeader>
            <div className="flex items-center justify-between">
              <CardTitle>{selectedItem.package.entity_payload.drug_name}</CardTitle>
              <Button variant="ghost" size="sm" onClick={() => setSelectedItem(null)}>
                Close
              </Button>
            </div>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="p-4 rounded-lg bg-muted/30 border">
              <p className="text-xs font-medium text-muted-foreground mb-3">Node Structure</p>
              <div className="flex flex-wrap gap-2">
                {selectedItem.package.entity_payload.nodes.map((node) => (
                  <div
                    key={node.id}
                    className={`px-3 py-1.5 rounded text-sm text-white ${getNodeColor(node.type)}`}
                  >
                    {node.label}
                  </div>
                ))}
              </div>
            </div>

            <div className="p-4 rounded-lg bg-muted/30 border">
              <p className="text-xs font-medium text-muted-foreground mb-3">Connections</p>
              <div className="space-y-2">
                {selectedItem.package.entity_payload.edges.map((edge) => {
                  const sourceNode = selectedItem.package.entity_payload.nodes.find(n => n.id === edge.source);
                  const targetNode = selectedItem.package.entity_payload.nodes.find(n => n.id === edge.target);
                  return (
                    <div key={edge.id} className="text-sm flex items-center gap-2">
                      <Badge variant="outline">{sourceNode?.label}</Badge>
                      <span className="text-muted-foreground">→</span>
                      <Badge variant="outline">{targetNode?.label}</Badge>
                    </div>
                  );
                })}
              </div>
            </div>

            <div>
              <label className="text-xs font-medium text-muted-foreground">Notes (optional)</label>
              <textarea
                value={notes}
                onChange={(e) => setNotes(e.target.value)}
                placeholder="Add approval/rejection notes..."
                className="w-full mt-1 px-3 py-2 rounded-lg border bg-background text-sm min-h-[80px]"
              />
            </div>

            <div className="flex gap-3">
              <Button
                onClick={() => handleAction("approve")}
                disabled={actionLoading}
                className="flex-1 bg-green-600 hover:bg-green-700"
              >
                {actionLoading ? <Loader2 className="w-4 h-4 mr-2 animate-spin" /> : <CheckCircle2 className="w-4 h-4 mr-2" />}
                Approve
              </Button>
              <Button
                variant="outline"
                onClick={() => handleAction("request_changes")}
                disabled={actionLoading}
                className="flex-1"
              >
                <MessageSquare className="w-4 h-4 mr-2" />
                Request Changes
              </Button>
              <Button
                variant="outline"
                onClick={() => handleAction("reject")}
                disabled={actionLoading}
                className="flex-1 border-red-500/30 text-red-600 hover:bg-red-500/10"
              >
                <XCircle className="w-4 h-4 mr-2" />
                Reject
              </Button>
            </div>
          </CardContent>
        </Card>
      )}
    </div>
  );
}
