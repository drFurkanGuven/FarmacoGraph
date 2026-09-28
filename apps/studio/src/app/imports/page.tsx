"use client";

import { useEffect, useState } from "react";
import {
  AlertCircle,
  CheckCircle2,
  Database,
  Download,
  Filter,
  Info,
  Package,
  RefreshCw,
  ShieldAlert,
  Upload,
  X,
} from "lucide-react";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { useUIMode } from "@/lib/ui-mode/context";
import { apiClient } from "@/lib/api";

interface ImportPackage {
  id: string;
  name: string;
  source: string;
  doi: string;
  total_interactions: number;
  unique_drugs: number;
  severity_counts: {
    contraindicated: number;
    major: number;
    moderate: number;
    minor: number;
  };
  synced_at: string | null;
  status: "pending" | "importing" | "completed" | "error";
}

interface InteractionPreview {
  id: string;
  drug_a_name: string;
  drug_b_name: string;
  severity: string;
  mechanism_explanation: string;
  source: string;
}

interface MoAEntry {
  id: string;
  smiles: string;
  mechanism_of_action: string;
  source: string;
}

export default function ImportCenterPage() {
  const { isSimple } = useUIMode();
  const [packages, setPackages] = useState<ImportPackage[]>([]);
  const [selectedPackage, setSelectedPackage] = useState<ImportPackage | null>(null);
  const [previewInteractions, setPreviewInteractions] = useState<InteractionPreview[]>([]);
  const [moaEntries, setMoAEntries] = useState<MoAEntry[]>([]);
  const [loading, setLoading] = useState(true);
  const [importing, setImporting] = useState(false);
  const [filter, setFilter] = useState<string>("all");

  useEffect(() => {
    loadPackages();
  }, []);

  async function loadPackages() {
    setLoading(true);
    try {
      const response = await apiClient.request<{ packages: ImportPackage[] }>("/imports/available");
      const packages = response.data?.packages || [];

      // Add ChEMBL MoA package if not already in list
      const hasChembl = packages.some((p: ImportPackage) => p.id === "chembl-moa-2023");
      if (!hasChembl) {
        try {
          const chemblResponse = await apiClient.request<{ metadata: { total_entries: number } }>("/imports/chembl/preview?limit=1");
          const chemblData = chemblResponse.data?.metadata;
          packages.push({
            id: "chembl-moa-2023",
            name: "ChEMBL Mechanism of Action Dataset",
            source: "ChEMBL Database",
            doi: "",
            total_interactions: chemblData?.total_entries || 0,
            unique_drugs: chemblData?.total_entries || 0,
            severity_counts: { contraindicated: 0, major: 0, moderate: 0, minor: 0 },
            synced_at: null,
            status: "pending",
          });
        } catch (e) {
          // ChEMBL package not available
        }
      }

      setPackages(packages);
    } catch (error) {
      console.error("Failed to load packages:", error);
    } finally {
      setLoading(false);
    }
  }

  async function loadPreview(packageId: string) {
    try {
      if (packageId === "chembl-moa-2023") {
        const response = await apiClient.request<{ moa_entries: MoAEntry[] }>(
          `/imports/chembl/preview?limit=50`
        );
        const data = response.data?.moa_entries || [];
        setMoAEntries(data);
      } else {
        const response = await apiClient.request<{ interactions: InteractionPreview[] }>(
          `/imports/${packageId}/preview?limit=50`
        );
        const data = response.data?.interactions || [];
        setPreviewInteractions(data);
      }
    } catch (error) {
      console.error("Failed to load preview:", error);
      setPreviewInteractions([]);
      setMoAEntries([]);
    }
  }

  function handleSelectPackage(pkg: ImportPackage) {
    setSelectedPackage(pkg);
    loadPreview(pkg.id);
  }

  async function handleImport() {
    if (!selectedPackage) return;
    setImporting(true);
    try {
      let endpoint = `/imports/${selectedPackage.id}/execute`;
      if (selectedPackage.id === "chembl-moa-2023") {
        endpoint = "/imports/chembl/execute";
      }

      const response = await apiClient.request<{ message: string }>(
        endpoint,
        { method: "POST" }
      );
      const message = response.data?.message || "Import completed";
      alert(message);
      await loadPackages();
      setSelectedPackage(null);
    } catch (error) {
      console.error("Import failed:", error);
      alert("Import başarısız oldu.");
    } finally {
      setImporting(false);
    }
  }

  const getSeverityBadge = (severity: string) => {
    switch (severity) {
      case "contraindicated":
        return "bg-red-500/10 text-red-500 border-red-500/30";
      case "major":
        return "bg-orange-500/10 text-orange-500 border-orange-500/30";
      case "moderate":
        return "bg-yellow-500/10 text-yellow-500 border-yellow-500/30";
      default:
        return "bg-blue-500/10 text-blue-500 border-blue-500/30";
    }
  };

  const filteredPreview = previewInteractions.filter(
    (i) => filter === "all" || i.severity === filter
  );

  if (isSimple) {
    return (
      <div className="max-w-4xl mx-auto p-6 space-y-6">
        <div>
          <h1 className="text-2xl font-bold">Veri İçe Aktarma</h1>
          <p className="text-muted-foreground text-sm mt-1">
            Dış kaynaklardan ilaç etkileşimi verilerini sisteme aktarın.
          </p>
        </div>

        {loading ? (
          <div className="flex items-center justify-center p-12">
            <RefreshCw className="w-6 h-6 animate-spin text-primary" />
          </div>
        ) : packages.length === 0 ? (
          <Card>
            <CardContent className="p-6 text-center">
              <Package className="w-12 h-12 mx-auto text-muted-foreground mb-3" />
              <p className="text-muted-foreground">İçe aktarılacak veri paketi bulunmuyor.</p>
            </CardContent>
          </Card>
        ) : (
          <div className="space-y-4">
            {packages.map((pkg) => (
              <Card key={pkg.id}>
                <CardHeader>
                  <div className="flex items-start justify-between">
                    <div>
                      <CardTitle className="text-lg">{pkg.name}</CardTitle>
                      <CardDescription>{pkg.source}</CardDescription>
                    </div>
                    <Badge variant={pkg.status === "pending" ? "secondary" : "default"}>
                      {pkg.status === "pending" ? "Bekliyor" : pkg.status}
                    </Badge>
                  </div>
                </CardHeader>
                <CardContent className="space-y-4">
                  <div className="grid grid-cols-2 gap-4 text-sm">
                    <div>
                      <span className="text-muted-foreground">Toplam Etkileşim:</span>
                      <span className="ml-2 font-semibold">{pkg.total_interactions.toLocaleString()}</span>
                    </div>
                    <div>
                      <span className="text-muted-foreground">İlaç Sayısı:</span>
                      <span className="ml-2 font-semibold">{pkg.unique_drugs.toLocaleString()}</span>
                    </div>
                  </div>

                  <div className="flex gap-2 flex-wrap">
                    <Badge className="bg-orange-500/10 text-orange-600 border-orange-500/30">
                      Major: {pkg.severity_counts.major.toLocaleString()}
                    </Badge>
                    <Badge className="bg-yellow-500/10 text-yellow-600 border-yellow-500/30">
                      Orta: {pkg.severity_counts.moderate.toLocaleString()}
                    </Badge>
                    <Badge className="bg-blue-500/10 text-blue-600 border-blue-500/30">
                      Minor: {pkg.severity_counts.minor.toLocaleString()}
                    </Badge>
                  </div>

                  <Button
                    onClick={() => handleSelectPackage(pkg)}
                    className="w-full"
                    disabled={pkg.status !== "pending"}
                  >
                    <Upload className="w-4 h-4 mr-2" />
                    İncele ve İçe Aktar
                  </Button>
                </CardContent>
              </Card>
            ))}
          </div>
        )}

        {selectedPackage && (
          <Card>
            <CardHeader>
              <div className="flex items-center justify-between">
                <CardTitle>Önizleme</CardTitle>
                <Button variant="ghost" size="sm" onClick={() => setSelectedPackage(null)}>
                  <X className="w-4 h-4" />
                </Button>
              </div>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="flex gap-2">
                <Button
                  size="sm"
                  variant={filter === "all" ? "default" : "outline"}
                  onClick={() => setFilter("all")}
                >
                  Tümü
                </Button>
                <Button
                  size="sm"
                  variant={filter === "major" ? "default" : "outline"}
                  onClick={() => setFilter("major")}
                  className={filter === "major" ? "bg-orange-500 hover:bg-orange-600" : ""}
                >
                  Major
                </Button>
                <Button
                  size="sm"
                  variant={filter === "moderate" ? "default" : "outline"}
                  onClick={() => setFilter("moderate")}
                  className={filter === "moderate" ? "bg-yellow-500 hover:bg-yellow-600" : ""}
                >
                  Orta
                </Button>
              </div>

              <div className="space-y-2 max-h-96 overflow-y-auto">
                {selectedPackage.id === "chembl-moa-2023" ? (
                  moaEntries.map((entry) => (
                    <div
                      key={entry.id}
                      className="p-3 rounded-lg border bg-muted/30 space-y-1"
                    >
                      <div className="flex items-center justify-between">
                        <span className="font-medium text-sm truncate max-w-[200px]">
                          {entry.smiles.substring(0, 30)}...
                        </span>
                        <Badge className="bg-purple-500/10 text-purple-600 border-purple-500/30">
                          MoA
                        </Badge>
                      </div>
                      <p className="text-xs text-muted-foreground">
                        {entry.mechanism_of_action}
                      </p>
                    </div>
                  ))
                ) : (
                  filteredPreview.map((interaction) => (
                    <div
                      key={interaction.id}
                      className="p-3 rounded-lg border bg-muted/30 space-y-1"
                    >
                      <div className="flex items-center justify-between">
                        <span className="font-medium text-sm">
                          {interaction.drug_a_name} + {interaction.drug_b_name}
                        </span>
                        <Badge className={getSeverityBadge(interaction.severity)}>
                          {interaction.severity}
                        </Badge>
                      </div>
                      <p className="text-xs text-muted-foreground">
                        {interaction.mechanism_explanation}
                      </p>
                    </div>
                  ))
                )}
              </div>

              <Button onClick={handleImport} className="w-full" disabled={importing}>
                {importing ? (
                  <RefreshCw className="w-4 h-4 mr-2 animate-spin" />
                ) : (
                  <CheckCircle2 className="w-4 h-4 mr-2" />
                )}
                {importing
                  ? "İçe Aktarılıyor..."
                  : selectedPackage.id === "chembl-moa-2023"
                    ? `İçe Aktarmayı Onayla (${selectedPackage.total_interactions.toLocaleString()} MoA kaydı)`
                    : `İçe Aktarmayı Onayla (${selectedPackage.total_interactions.toLocaleString()} etkileşim)`}
              </Button>
            </CardContent>
          </Card>
        )}
      </div>
    );
  }

  return (
    <div className="max-w-6xl mx-auto p-6 space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <div className="inline-flex items-center gap-2 px-3 py-1 rounded-full text-xs font-medium bg-primary/10 text-primary mb-2">
            <Database className="w-3.5 h-3.5" />
            Data Import Center
          </div>
          <h1 className="text-3xl font-bold tracking-tight">External Data Import</h1>
          <p className="text-muted-foreground text-sm mt-1">
            Import curated biomedical datasets into the FarmacoGraph knowledge graph.
          </p>
        </div>
        <Button variant="outline" onClick={loadPackages}>
          <RefreshCw className="w-4 h-4 mr-2" />
          Refresh
        </Button>
      </div>

      <div className="grid gap-4 md:grid-cols-3">
        <Card>
          <CardHeader className="pb-2">
            <CardDescription>Available Packages</CardDescription>
            <CardTitle className="text-2xl">{packages.length}</CardTitle>
          </CardHeader>
        </Card>
        <Card>
          <CardHeader className="pb-2">
            <CardDescription>Total Interactions</CardDescription>
            <CardTitle className="text-2xl">
              {packages.reduce((sum, p) => sum + p.total_interactions, 0).toLocaleString()}
            </CardTitle>
          </CardHeader>
        </Card>
        <Card>
          <CardHeader className="pb-2">
            <CardDescription>Pending Review</CardDescription>
            <CardTitle className="text-2xl">
              {packages.filter((p) => p.status === "pending").length}
            </CardTitle>
          </CardHeader>
        </Card>
      </div>

      {loading ? (
        <div className="flex items-center justify-center p-12">
          <RefreshCw className="w-6 h-6 animate-spin text-primary" />
        </div>
      ) : packages.length === 0 ? (
        <Card>
          <CardContent className="p-6 text-center">
            <Package className="w-12 h-12 mx-auto text-muted-foreground mb-3" />
            <p className="text-muted-foreground">No import packages available.</p>
            <p className="text-xs text-muted-foreground mt-2">
              Run <code className="bg-muted px-1 rounded">python scripts/sync_fda_ddi.py</code> to sync data.
            </p>
          </CardContent>
        </Card>
      ) : (
        <div className="grid gap-4 md:grid-cols-2">
          {packages.map((pkg) => (
            <Card key={pkg.id} className="hover:shadow-md transition-shadow">
              <CardHeader>
                <div className="flex items-start justify-between">
                  <div>
                    <CardTitle className="text-base">{pkg.name}</CardTitle>
                    <CardDescription className="mt-1">{pkg.source}</CardDescription>
                  </div>
                  <Badge variant={pkg.status === "pending" ? "secondary" : "default"}>
                    {pkg.status}
                  </Badge>
                </div>
              </CardHeader>
              <CardContent className="space-y-4">
                <div className="grid grid-cols-2 gap-4 text-sm">
                  <div>
                    <span className="text-muted-foreground">Interactions:</span>
                    <span className="ml-2 font-semibold">{pkg.total_interactions.toLocaleString()}</span>
                  </div>
                  <div>
                    <span className="text-muted-foreground">Drugs:</span>
                    <span className="ml-2 font-semibold">{pkg.unique_drugs.toLocaleString()}</span>
                  </div>
                </div>

                <div className="flex gap-2 flex-wrap">
                  <Badge className="bg-red-500/10 text-red-500 border-red-500/30">
                    Contraindicated: {pkg.severity_counts.contraindicated}
                  </Badge>
                  <Badge className="bg-orange-500/10 text-orange-500 border-orange-500/30">
                    Major: {pkg.severity_counts.major.toLocaleString()}
                  </Badge>
                  <Badge className="bg-yellow-500/10 text-yellow-500 border-yellow-500/30">
                    Moderate: {pkg.severity_counts.moderate.toLocaleString()}
                  </Badge>
                  <Badge className="bg-blue-500/10 text-blue-500 border-blue-500/30">
                    Minor: {pkg.severity_counts.minor.toLocaleString()}
                  </Badge>
                </div>

                <div className="flex items-center gap-2 text-xs text-muted-foreground">
                  <Info className="w-3 h-3" />
                  <span>DOI: {pkg.doi}</span>
                </div>

                <Button
                  onClick={() => handleSelectPackage(pkg)}
                  className="w-full"
                  disabled={pkg.status !== "pending"}
                >
                  <Upload className="w-4 h-4 mr-2" />
                  Review & Import
                </Button>
              </CardContent>
            </Card>
          ))}
        </div>
      )}

      {selectedPackage && (
        <Card className="border-primary/30">
          <CardHeader>
            <div className="flex items-center justify-between">
              <div>
                <CardTitle>Import Preview: {selectedPackage.name}</CardTitle>
                <CardDescription>
                  Review interactions before importing to curator queue
                </CardDescription>
              </div>
              <Button variant="ghost" size="sm" onClick={() => setSelectedPackage(null)}>
                <X className="w-4 h-4" />
              </Button>
            </div>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="flex items-center gap-2">
              <Filter className="w-4 h-4 text-muted-foreground" />
              <div className="flex gap-2">
                <Button
                  size="sm"
                  variant={filter === "all" ? "default" : "outline"}
                  onClick={() => setFilter("all")}
                >
                  All
                </Button>
                <Button
                  size="sm"
                  variant={filter === "contraindicated" ? "default" : "outline"}
                  onClick={() => setFilter("contraindicated")}
                  className={filter === "contraindicated" ? "bg-red-500 hover:bg-red-600" : ""}
                >
                  Contraindicated
                </Button>
                <Button
                  size="sm"
                  variant={filter === "major" ? "default" : "outline"}
                  onClick={() => setFilter("major")}
                  className={filter === "major" ? "bg-orange-500 hover:bg-orange-600" : ""}
                >
                  Major
                </Button>
                <Button
                  size="sm"
                  variant={filter === "moderate" ? "default" : "outline"}
                  onClick={() => setFilter("moderate")}
                  className={filter === "moderate" ? "bg-yellow-500 hover:bg-yellow-600" : ""}
                >
                  Moderate
                </Button>
              </div>
            </div>

            <div className="space-y-2 max-h-96 overflow-y-auto border rounded-lg p-2">
              {filteredPreview.length === 0 ? (
                <p className="text-center text-muted-foreground py-4">
                  No interactions match the selected filter.
                </p>
              ) : (
                filteredPreview.map((interaction) => (
                  <div
                    key={interaction.id}
                    className="p-3 rounded-lg border bg-muted/30 space-y-1"
                  >
                    <div className="flex items-center justify-between">
                      <span className="font-medium text-sm">
                        {interaction.drug_a_name} + {interaction.drug_b_name}
                      </span>
                      <Badge className={getSeverityBadge(interaction.severity)}>
                        {interaction.severity}
                      </Badge>
                    </div>
                    <p className="text-xs text-muted-foreground">
                      {interaction.mechanism_explanation}
                    </p>
                  </div>
                ))
              )}
            </div>

            <div className="flex items-center gap-3 pt-2 border-t">
              <Button onClick={handleImport} className="flex-1" disabled={importing}>
                {importing ? (
                  <RefreshCw className="w-4 h-4 mr-2 animate-spin" />
                ) : (
                  <CheckCircle2 className="w-4 h-4 mr-2" />
                )}
                {importing ? "Importing..." : `Import to Curator Queue (${selectedPackage.total_interactions.toLocaleString()} interactions)`}
              </Button>
            </div>
          </CardContent>
        </Card>
      )}
    </div>
  );
}
