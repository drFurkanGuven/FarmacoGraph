"use client";

import { useState, useRef } from "react";
import {
  Upload,
  FileText,
  CheckCircle2,
  AlertCircle,
  X,
  Download,
  Loader2,
  Table,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { useUIMode } from "@/lib/ui-mode/context";
import { apiClient } from "@/lib/api";

interface BulkImportItem {
  id: string;
  drug_a: string;
  drug_b: string;
  severity: string;
  interaction: string;
  valid: boolean;
  error: string | null;
}

const SAMPLE_CSV = `drug_a,drug_b,severity,interaction
warfarin,aspirin,major,Increased bleeding risk
metformin,alcohol,major,Lactic acidosis risk
lisinopril,potassium,moderate,Hyperkalemia risk`;

const SAMPLE_JSON = `[
  {"drug_a": "warfarin", "drug_b": "aspirin", "severity": "major", "interaction": "Increased bleeding risk"},
  {"drug_a": "metformin", "drug_b": "alcohol", "severity": "major", "interaction": "Lactic acidosis risk"}
]`;

export default function BulkImportPage() {
  const { isSimple } = useUIMode();
  const [items, setItems] = useState<BulkImportItem[]>([]);
  const [loading, setLoading] = useState(false);
  const [importing, setImporting] = useState(false);
  const [importResult, setImportResult] = useState<{
    imported_count: number;
    skipped_count: number;
    error_count: number;
    message: string;
  } | null>(null);
  const [dragActive, setDragActive] = useState(false);
  const fileInputRef = useRef<HTMLInputElement>(null);

  async function handleFileUpload(file: File) {
    setLoading(true);
    setItems([]);
    setImportResult(null);

    try {
      const formData = new FormData();
      formData.append("file", file);

      const response = await apiClient.request<{
        items: BulkImportItem[];
        total: number;
        valid_count: number;
        invalid_count: number;
      }>("/bulk-import/upload", {
        method: "POST",
        body: formData,
      });

      const data = response.data?.items || [];
      setItems(data);
    } catch (error) {
      alert(isSimple ? "Dosya yüklenemedi" : "Failed to upload file");
      console.error(error);
    } finally {
      setLoading(false);
    }
  }

  async function handleTextImport(content: string, fileType: "csv" | "json") {
    setLoading(true);
    setItems([]);
    setImportResult(null);

    try {
      const response = await apiClient.request<{
        items: BulkImportItem[];
        total: number;
        valid_count: number;
        invalid_count: number;
      }>("/bulk-import/preview", {
        method: "POST",
        body: JSON.stringify({ file_type: fileType, content }),
      });

      const data = response.data?.items || [];
      setItems(data);
    } catch (error) {
      alert(isSimple ? "İçerik parse edilemedi" : "Failed to parse content");
      console.error(error);
    } finally {
      setLoading(false);
    }
  }

  async function executeImport() {
    setImporting(true);
    setImportResult(null);

    try {
      const response = await apiClient.request<{
        imported_count: number;
        skipped_count: number;
        error_count: number;
        message: string;
      }>("/bulk-import/execute", {
        method: "POST",
        body: JSON.stringify({ items }),
      });

      setImportResult(response.data);
      setItems([]);
    } catch (error) {
      alert(isSimple ? "İçeri aktarma başarısız" : "Import failed");
      console.error(error);
    } finally {
      setImporting(false);
    }
  }

  function handleDrag(e: React.DragEvent) {
    e.preventDefault();
    e.stopPropagation();
    if (e.type === "dragenter" || e.type === "dragover") {
      setDragActive(true);
    } else if (e.type === "dragleave") {
      setDragActive(false);
    }
  }

  function handleDrop(e: React.DragEvent) {
    e.preventDefault();
    e.stopPropagation();
    setDragActive(false);

    if (e.dataTransfer.files && e.dataTransfer.files[0]) {
      handleFileUpload(e.dataTransfer.files[0]);
    }
  }

  function downloadSample(format: "csv" | "json") {
    const content = format === "csv" ? SAMPLE_CSV : SAMPLE_JSON;
    const blob = new Blob([content], { type: format === "csv" ? "text/csv" : "application/json" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = `sample-interactions.${format}`;
    a.click();
  }

  function removeItem(index: number) {
    setItems(items.filter((_, i) => i !== index));
  }

  const validItems = items.filter((i) => i.valid);
  const invalidItems = items.filter((i) => !i.valid);

  const getSeverityBadge = (severity: string) => {
    switch (severity) {
      case "contraindicated":
        return "bg-red-500/10 text-red-500 border-red-500/30";
      case "major":
        return "bg-orange-500/10 text-orange-500 border-orange-500/30";
      case "moderate":
        return "bg-yellow-500/10 text-yellow-500 border-yellow-500/30";
      case "beneficial_synergy":
        return "bg-green-500/10 text-green-500 border-green-500/30";
      default:
        return "bg-blue-500/10 text-blue-500 border-blue-500/30";
    }
  };

  if (isSimple) {
    return (
      <div className="max-w-5xl mx-auto p-6 space-y-6">
        <div>
          <h1 className="text-2xl font-bold">Toplu İçe Aktarma</h1>
          <p className="text-muted-foreground text-sm mt-1">
            CSV veya JSON dosyasından toplu etkileşim verisi yükleyin
          </p>
        </div>

        <Card>
          <CardHeader>
            <CardTitle className="text-base">Dosya Yükle</CardTitle>
            <CardDescription>
              CSV veya JSON formatında etkileşim verileri yükleyin
            </CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            <div
              onDragEnter={handleDrag}
              onDragLeave={handleDrag}
              onDragOver={handleDrag}
              onDrop={handleDrop}
              className={`border-2 border-dashed rounded-lg p-8 text-center transition-colors ${
                dragActive ? "border-primary bg-primary/5" : "border-border"
              }`}
            >
              <Upload className="w-10 h-10 mx-auto text-muted-foreground mb-3" />
              <p className="text-sm font-medium mb-1">
                Dosyayı sürükleyip bırakın veya tıklayın
              </p>
              <p className="text-xs text-muted-foreground mb-3">
                CSV veya JSON formatı desteklenir
              </p>
              <input
                ref={fileInputRef}
                type="file"
                accept=".csv,.json"
                onChange={(e) => e.target.files?.[0] && handleFileUpload(e.target.files[0])}
                className="hidden"
              />
              <Button
                variant="outline"
                onClick={() => fileInputRef.current?.click()}
                disabled={loading}
              >
                {loading ? <Loader2 className="w-4 h-4 mr-2 animate-spin" /> : <FileText className="w-4 h-4 mr-2" />}
                Dosya Seç
              </Button>
            </div>

            <div className="flex gap-2">
              <Button variant="outline" size="sm" onClick={() => downloadSample("csv")}>
                <Download className="w-3 h-3 mr-1" />
                CSV Örneği
              </Button>
              <Button variant="outline" size="sm" onClick={() => downloadSample("json")}>
                <Download className="w-3 h-3 mr-1" />
                JSON Örneği
              </Button>
            </div>
          </CardContent>
        </Card>

        {loading && (
          <div className="flex items-center justify-center p-8">
            <Loader2 className="w-6 h-6 animate-spin text-primary" />
            <span className="ml-2">Dosya işleniyor...</span>
          </div>
        )}

        {items.length > 0 && (
          <Card>
            <CardHeader>
              <div className="flex items-center justify-between">
                <div>
                  <CardTitle className="text-base">Önizleme ({items.length} kayıt)</CardTitle>
                  <CardDescription>
                    <span className="text-green-600">{validItems.length} geçerli</span>
                    {invalidItems.length > 0 && (
                      <span className="text-red-600 ml-2">{invalidItems.length} hatalı</span>
                    )}
                  </CardDescription>
                </div>
                <Button
                  onClick={executeImport}
                  disabled={importing || validItems.length === 0}
                >
                  {importing ? (
                    <Loader2 className="w-4 h-4 mr-2 animate-spin" />
                  ) : (
                    <CheckCircle2 className="w-4 h-4 mr-2" />
                  )}
                  İçe Aktar ({validItems.length})
                </Button>
              </div>
            </CardHeader>
            <CardContent className="space-y-2 max-h-96 overflow-y-auto">
              {items.map((item, index) => (
                <div
                  key={item.id}
                  className={`p-3 rounded-lg border ${
                    item.valid ? "bg-muted/30" : "bg-red-500/5 border-red-500/30"
                  }`}
                >
                  <div className="flex items-start justify-between gap-2">
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center gap-2 flex-wrap">
                        <span className="font-medium text-sm">
                          {item.drug_a} + {item.drug_b}
                        </span>
                        <Badge className={getSeverityBadge(item.severity)}>
                          {item.severity}
                        </Badge>
                        {!item.valid && (
                          <Badge variant="danger" className="text-xs">
                            Hatalı
                          </Badge>
                        )}
                      </div>
                      <p className="text-xs text-muted-foreground mt-1 truncate">
                        {item.interaction}
                      </p>
                      {item.error && (
                        <p className="text-xs text-red-600 mt-1">{item.error}</p>
                      )}
                    </div>
                    <Button
                      variant="ghost"
                      size="sm"
                      onClick={() => removeItem(index)}
                    >
                      <X className="w-3 h-3" />
                    </Button>
                  </div>
                </div>
              ))}
            </CardContent>
          </Card>
        )}

        {importResult && (
          <Card className={importResult.error_count > 0 ? "border-red-500/30" : "border-green-500/30"}>
            <CardContent className="p-4">
              <div className="flex items-center gap-2">
                {importResult.error_count > 0 ? (
                  <AlertCircle className="w-5 h-5 text-red-500" />
                ) : (
                  <CheckCircle2 className="w-5 h-5 text-green-500" />
                )}
                <div>
                  <p className="font-medium text-sm">{importResult.message}</p>
                  <p className="text-xs text-muted-foreground">
                    İçe aktarılan: {importResult.imported_count} | Atlanan: {importResult.skipped_count} | Hata: {importResult.error_count}
                  </p>
                </div>
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
          <Table className="w-3.5 h-3.5" />
          Bulk Import
        </div>
        <h1 className="text-3xl font-bold tracking-tight">Bulk Data Import</h1>
        <p className="text-muted-foreground text-sm mt-1">
          Import interaction data from CSV or JSON files in bulk.
        </p>
      </div>

      <div className="grid gap-6 md:grid-cols-2">
        <Card>
          <CardHeader>
            <CardTitle>Upload File</CardTitle>
            <CardDescription>
              Drag and drop a CSV or JSON file, or click to browse
            </CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            <div
              onDragEnter={handleDrag}
              onDragLeave={handleDrag}
              onDragOver={handleDrag}
              onDrop={handleDrop}
              className={`border-2 border-dashed rounded-lg p-10 text-center transition-colors ${
                dragActive ? "border-primary bg-primary/5" : "border-border"
              }`}
            >
              <Upload className="w-12 h-12 mx-auto text-muted-foreground mb-4" />
              <p className="text-sm font-medium mb-2">
                Drag & drop your file here
              </p>
              <p className="text-xs text-muted-foreground mb-4">
                Supports CSV and JSON formats
              </p>
              <input
                ref={fileInputRef}
                type="file"
                accept=".csv,.json"
                onChange={(e) => e.target.files?.[0] && handleFileUpload(e.target.files[0])}
                className="hidden"
              />
              <Button
                variant="outline"
                onClick={() => fileInputRef.current?.click()}
                disabled={loading}
              >
                {loading ? <Loader2 className="w-4 h-4 mr-2 animate-spin" /> : <FileText className="w-4 h-4 mr-2" />}
                Browse Files
              </Button>
            </div>

            <div className="flex gap-2">
              <Button variant="outline" size="sm" onClick={() => downloadSample("csv")}>
                <Download className="w-3 h-3 mr-1" />
                Sample CSV
              </Button>
              <Button variant="outline" size="sm" onClick={() => downloadSample("json")}>
                <Download className="w-3 h-3 mr-1" />
                Sample JSON
              </Button>
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle>Expected Format</CardTitle>
            <CardDescription>
              Your file should contain the following fields
            </CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="space-y-2">
              <p className="text-sm font-medium">Required Fields:</p>
              <ul className="text-xs text-muted-foreground space-y-1">
                <li><code className="bg-muted px-1 rounded">drug_a</code> - First drug name</li>
                <li><code className="bg-muted px-1 rounded">drug_b</code> - Second drug name</li>
                <li><code className="bg-muted px-1 rounded">severity</code> - One of: contraindicated, major, moderate, minor, beneficial_synergy</li>
                <li><code className="bg-muted px-1 rounded">interaction</code> - Description of the interaction</li>
              </ul>
            </div>

            <div className="space-y-2">
              <p className="text-sm font-medium">CSV Example:</p>
              <pre className="text-xs bg-muted p-3 rounded-lg overflow-x-auto">
{`drug_a,drug_b,severity,interaction
warfarin,aspirin,major,Increased bleeding risk
metformin,alcohol,major,Lactic acidosis risk`}
              </pre>
            </div>
          </CardContent>
        </Card>
      </div>

      {loading && (
        <div className="flex items-center justify-center p-8">
          <Loader2 className="w-6 h-6 animate-spin text-primary" />
          <span className="ml-2">Processing file...</span>
        </div>
      )}

      {items.length > 0 && (
        <Card>
          <CardHeader>
            <div className="flex items-center justify-between">
              <div>
                <CardTitle>Preview ({items.length} records)</CardTitle>
                <CardDescription>
                  <span className="text-green-600">{validItems.length} valid</span>
                  {invalidItems.length > 0 && (
                    <span className="text-red-600 ml-2">{invalidItems.length} invalid</span>
                  )}
                </CardDescription>
              </div>
              <Button
                onClick={executeImport}
                disabled={importing || validItems.length === 0}
              >
                {importing ? (
                  <Loader2 className="w-4 h-4 mr-2 animate-spin" />
                ) : (
                  <CheckCircle2 className="w-4 h-4 mr-2" />
                )}
                Import Valid ({validItems.length})
              </Button>
            </div>
          </CardHeader>
          <CardContent>
            <div className="space-y-2 max-h-96 overflow-y-auto">
              {items.map((item, index) => (
                <div
                  key={item.id}
                  className={`p-4 rounded-lg border ${
                    item.valid ? "bg-muted/30" : "bg-red-500/5 border-red-500/30"
                  }`}
                >
                  <div className="flex items-start justify-between gap-3">
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center gap-2 flex-wrap">
                        <span className="font-medium">
                          {item.drug_a} + {item.drug_b}
                        </span>
                        <Badge className={getSeverityBadge(item.severity)}>
                          {item.severity}
                        </Badge>
                        {!item.valid && (
                          <Badge variant="danger">Invalid</Badge>
                        )}
                      </div>
                      <p className="text-sm text-muted-foreground mt-1 truncate">
                        {item.interaction}
                      </p>
                      {item.error && (
                        <p className="text-xs text-red-600 mt-1 flex items-center gap-1">
                          <AlertCircle className="w-3 h-3" />
                          {item.error}
                        </p>
                      )}
                    </div>
                    <Button
                      variant="ghost"
                      size="sm"
                      onClick={() => removeItem(index)}
                    >
                      <X className="w-4 h-4" />
                    </Button>
                  </div>
                </div>
              ))}
            </div>
          </CardContent>
        </Card>
      )}

      {importResult && (
        <Card className={importResult.error_count > 0 ? "border-red-500/30" : "border-green-500/30"}>
          <CardContent className="p-6">
            <div className="flex items-center gap-3">
              {importResult.error_count > 0 ? (
                <AlertCircle className="w-6 h-6 text-red-500" />
              ) : (
                <CheckCircle2 className="w-6 h-6 text-green-500" />
              )}
              <div>
                <p className="font-medium">{importResult.message}</p>
                <p className="text-sm text-muted-foreground">
                  Imported: {importResult.imported_count} | Skipped: {importResult.skipped_count} | Errors: {importResult.error_count}
                </p>
              </div>
            </div>
          </CardContent>
        </Card>
      )}
    </div>
  );
}
