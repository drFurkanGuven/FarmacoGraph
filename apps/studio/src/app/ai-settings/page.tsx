"use client";

import { useEffect, useState } from "react";
import {
  Bot,
  Check,
  Key,
  Loader2,
  RefreshCw,
  Save,
  Sparkles,
  TestTube,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { useUIMode } from "@/lib/ui-mode/context";
import { apiClient } from "@/lib/api";

interface AIProvider {
  id: string;
  name: string;
  description: string;
  requires_key: boolean;
  models: Array<{ id: string; name: string }>;
}

interface AISettings {
  id: string;
  provider: string;
  model: string;
  base_url: string | null;
  is_active: boolean;
  api_key_masked: string;
}

export default function AISettingsPage() {
  const { isSimple } = useUIMode();
  const [providers, setProviders] = useState<AIProvider[]>([]);
  const [currentSettings, setCurrentSettings] = useState<AISettings | null>(null);
  const [selectedProvider, setSelectedProvider] = useState("openai");
  const [selectedModel, setSelectedModel] = useState("");
  const [apiKey, setApiKey] = useState("");
  const [baseUrl, setBaseUrl] = useState("");
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [testing, setTesting] = useState(false);
  const [testResult, setTestResult] = useState<{ success: boolean; message: string } | null>(null);

  useEffect(() => {
    loadData();
  }, []);

  async function loadData() {
    setLoading(true);
    try {
      const [providersRes, settingsRes] = await Promise.all([
        apiClient.request<{ providers: AIProvider[] }>("/ai/providers"),
        apiClient.request<AISettings | null>("/ai/settings"),
      ]);

      setProviders(providersRes.data.providers || []);

      if (settingsRes.data) {
        setCurrentSettings(settingsRes.data);
        setSelectedProvider(settingsRes.data.provider);
        setSelectedModel(settingsRes.data.model);
        setBaseUrl(settingsRes.data.base_url || "");
      } else if (providersRes.data.providers?.length > 0) {
        const defaultProvider = providersRes.data.providers[0];
        setSelectedProvider(defaultProvider.id);
        if (defaultProvider.models.length > 0) {
          setSelectedModel(defaultProvider.models[0].id);
        }
      }
    } catch (error) {
      console.error("Failed to load AI settings:", error);
    } finally {
      setLoading(false);
    }
  }

  async function handleSave() {
    if (!apiKey && !currentSettings) {
      alert(isSimple ? "API anahtarı gerekli" : "API key is required");
      return;
    }

    setSaving(true);
    try {
      const response = await apiClient.request<AISettings>("/ai/settings", {
        method: "POST",
        body: JSON.stringify({
          provider: selectedProvider,
          api_key: apiKey || "unchanged",
          model: selectedModel,
          base_url: baseUrl || null,
        }),
      });
      setCurrentSettings(response.data);
      setApiKey("");
      setTestResult({ success: true, message: isSimple ? "Ayarlar kaydedildi" : "Settings saved" });
    } catch (error) {
      console.error("Failed to save settings:", error);
      setTestResult({ success: false, message: isSimple ? "Kaydetme başarısız" : "Failed to save" });
    } finally {
      setSaving(false);
    }
  }

  async function handleTest() {
    setTesting(true);
    setTestResult(null);
    try {
      const response = await apiClient.request<{ content: string }>("/ai/generate", {
        method: "POST",
        body: JSON.stringify({
          prompt: "Say 'Hello from FarmacoGraph!' in a creative way.",
          system_prompt: "You are a helpful assistant.",
          max_tokens: 100,
        }),
      });
      setTestResult({
        success: true,
        message: `${isSimple ? "Başarılı" : "Success"}: ${response.data.content.slice(0, 100)}...`,
      });
    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : "Test failed";
      setTestResult({
        success: false,
        message: errorMessage || (isSimple ? "Test başarısız" : "Test failed"),
      });
    } finally {
      setTesting(false);
    }
  }

  const currentProvider = providers.find((p) => p.id === selectedProvider);

  if (isSimple) {
    return (
      <div className="max-w-3xl mx-auto p-6 space-y-6">
        <div>
          <h1 className="text-2xl font-bold">AI Ayarları</h1>
          <p className="text-muted-foreground text-sm mt-1">
            Eğitim içeriği üretimi için AI sağlayıcınızı yapılandırın
          </p>
        </div>

        {loading ? (
          <div className="flex items-center justify-center p-12">
            <Loader2 className="w-6 h-6 animate-spin text-primary" />
          </div>
        ) : (
          <>
            <Card>
              <CardHeader>
                <CardTitle className="text-base flex items-center gap-2">
                  <Bot className="w-4 h-4" />
                  AI Sağlayıcı
                </CardTitle>
              </CardHeader>
              <CardContent className="space-y-4">
                <div className="grid grid-cols-3 gap-2">
                  {providers.map((provider) => (
                    <button
                      key={provider.id}
                      onClick={() => {
                        setSelectedProvider(provider.id);
                        if (provider.models.length > 0) {
                          setSelectedModel(provider.models[0].id);
                        }
                      }}
                      className={`p-3 rounded-lg border text-left transition-colors ${
                        selectedProvider === provider.id
                          ? "border-primary bg-primary/5"
                          : "border-border hover:border-primary/50"
                      }`}
                    >
                      <p className="font-medium text-sm">{provider.name}</p>
                      <p className="text-xs text-muted-foreground mt-1">{provider.description}</p>
                    </button>
                  ))}
                </div>
              </CardContent>
            </Card>

            <Card>
              <CardHeader>
                <CardTitle className="text-base">Model Seçimi</CardTitle>
              </CardHeader>
              <CardContent className="space-y-2">
                {currentProvider?.models.map((model) => (
                  <button
                    key={model.id}
                    onClick={() => setSelectedModel(model.id)}
                    className={`w-full p-3 rounded-lg border text-left transition-colors ${
                      selectedModel === model.id
                        ? "border-primary bg-primary/5"
                        : "border-border hover:border-primary/50"
                    }`}
                  >
                    <p className="text-sm font-medium">{model.name}</p>
                  </button>
                ))}
              </CardContent>
            </Card>

            {currentProvider?.requires_key && (
              <Card>
                <CardHeader>
                  <CardTitle className="text-base flex items-center gap-2">
                    <Key className="w-4 h-4" />
                    API Anahtarı
                  </CardTitle>
                  <CardDescription>
                    {currentSettings ? `Mevcut: ${currentSettings.api_key_masked}` : "Henüz yapılandırılmadı"}
                  </CardDescription>
                </CardHeader>
                <CardContent>
                  <input
                    type="password"
                    placeholder={currentSettings ? "Yeni anahtar girin (opsiyonel)" : "API anahtarınızı girin"}
                    value={apiKey}
                    onChange={(e) => setApiKey(e.target.value)}
                    className="w-full px-3 py-2 rounded-lg border bg-background text-sm"
                  />
                </CardContent>
              </Card>
            )}

            {selectedProvider === "ollama" && (
              <Card>
                <CardHeader>
                  <CardTitle className="text-base">Ollama URL</CardTitle>
                </CardHeader>
                <CardContent>
                  <input
                    type="text"
                    placeholder="http://localhost:11434"
                    value={baseUrl}
                    onChange={(e) => setBaseUrl(e.target.value)}
                    className="w-full px-3 py-2 rounded-lg border bg-background text-sm"
                  />
                </CardContent>
              </Card>
            )}

            <div className="flex gap-2">
              <Button onClick={handleSave} disabled={saving} className="flex-1">
                {saving ? <Loader2 className="w-4 h-4 mr-2 animate-spin" /> : <Save className="w-4 h-4 mr-2" />}
                {saving ? "Kaydediliyor..." : "Kaydet"}
              </Button>
              <Button variant="outline" onClick={handleTest} disabled={testing}>
                {testing ? <Loader2 className="w-4 h-4 animate-spin" /> : <TestTube className="w-4 h-4 mr-2" />}
                Test
              </Button>
            </div>

            {testResult && (
              <div className={`p-3 rounded-lg border ${testResult.success ? "bg-green-500/10 border-green-500/30" : "bg-red-500/10 border-red-500/30"}`}>
                <p className={`text-sm ${testResult.success ? "text-green-600" : "text-red-600"}`}>
                  {testResult.message}
                </p>
              </div>
            )}
          </>
        )}
      </div>
    );
  }

  // Professional mode
  return (
    <div className="max-w-4xl mx-auto p-6 space-y-6">
      <div>
        <div className="inline-flex items-center gap-2 px-3 py-1 rounded-full text-xs font-medium bg-primary/10 text-primary mb-2">
          <Sparkles className="w-3.5 h-3.5" />
          AI Configuration
        </div>
        <h1 className="text-3xl font-bold tracking-tight">AI Provider Settings</h1>
        <p className="text-muted-foreground text-sm mt-1">
          Configure AI providers for automated content generation, flashcards, and quiz creation.
        </p>
      </div>

      {loading ? (
        <div className="flex items-center justify-center p-12">
          <Loader2 className="w-6 h-6 animate-spin text-primary" />
        </div>
      ) : (
        <>
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <Bot className="w-5 h-5" />
                Select Provider
              </CardTitle>
            </CardHeader>
            <CardContent>
              <div className="grid grid-cols-3 gap-4">
                {providers.map((provider) => (
                  <button
                    key={provider.id}
                    onClick={() => {
                      setSelectedProvider(provider.id);
                      if (provider.models.length > 0) {
                        setSelectedModel(provider.models[0].id);
                      }
                    }}
                    className={`p-4 rounded-lg border text-left transition-all ${
                      selectedProvider === provider.id
                        ? "border-primary bg-primary/5 ring-2 ring-primary/20"
                        : "border-border hover:border-primary/50"
                    }`}
                  >
                    <div className="flex items-center justify-between mb-2">
                      <p className="font-semibold">{provider.name}</p>
                      {selectedProvider === provider.id && (
                        <Check className="w-4 h-4 text-primary" />
                      )}
                    </div>
                    <p className="text-sm text-muted-foreground">{provider.description}</p>
                    {provider.requires_key && (
                      <Badge variant="outline" className="mt-2 text-xs">
                        API Key Required
                      </Badge>
                    )}
                  </button>
                ))}
              </div>
            </CardContent>
          </Card>

          <Card>
            <CardHeader>
              <CardTitle>Select Model</CardTitle>
              <CardDescription>Choose the AI model for content generation</CardDescription>
            </CardHeader>
            <CardContent>
              <div className="grid grid-cols-2 gap-3">
                {currentProvider?.models.map((model) => (
                  <button
                    key={model.id}
                    onClick={() => setSelectedModel(model.id)}
                    className={`p-3 rounded-lg border text-left transition-all ${
                      selectedModel === model.id
                        ? "border-primary bg-primary/5 ring-2 ring-primary/20"
                        : "border-border hover:border-primary/50"
                    }`}
                  >
                    <p className="text-sm font-medium">{model.name}</p>
                  </button>
                ))}
              </div>
            </CardContent>
          </Card>

          {currentProvider?.requires_key && (
            <Card>
              <CardHeader>
                <CardTitle className="flex items-center gap-2">
                  <Key className="w-5 h-5" />
                  API Key
                </CardTitle>
                {currentSettings && (
                  <CardDescription>
                    Current: <code className="bg-muted px-1 rounded">{currentSettings.api_key_masked}</code>
                  </CardDescription>
                )}
              </CardHeader>
              <CardContent>
                <input
                  type="password"
                  placeholder={currentSettings ? "Enter new key to update (optional)" : "Enter your API key"}
                  value={apiKey}
                  onChange={(e) => setApiKey(e.target.value)}
                  className="w-full px-4 py-2 rounded-lg border bg-background text-sm"
                />
              </CardContent>
            </Card>
          )}

          {selectedProvider === "ollama" && (
            <Card>
              <CardHeader>
                <CardTitle>Ollama Base URL</CardTitle>
                <CardDescription>URL of your Ollama instance</CardDescription>
              </CardHeader>
              <CardContent>
                <input
                  type="text"
                  placeholder="http://localhost:11434"
                  value={baseUrl}
                  onChange={(e) => setBaseUrl(e.target.value)}
                  className="w-full px-4 py-2 rounded-lg border bg-background text-sm"
                />
              </CardContent>
            </Card>
          )}

          <div className="flex gap-3">
            <Button onClick={handleSave} disabled={saving} className="flex-1">
              {saving ? <Loader2 className="w-4 h-4 mr-2 animate-spin" /> : <Save className="w-4 h-4 mr-2" />}
              {saving ? "Saving..." : "Save Settings"}
            </Button>
            <Button variant="outline" onClick={handleTest} disabled={testing}>
              {testing ? <Loader2 className="w-4 h-4 animate-spin" /> : <TestTube className="w-4 h-4 mr-2" />}
              Test Connection
            </Button>
          </div>

          {testResult && (
            <div className={`p-4 rounded-lg border ${testResult.success ? "bg-green-500/10 border-green-500/30" : "bg-red-500/10 border-red-500/30"}`}>
              <p className={`text-sm ${testResult.success ? "text-green-600 dark:text-green-400" : "text-red-600 dark:text-red-400"}`}>
                {testResult.message}
              </p>
            </div>
          )}
        </>
      )}
    </div>
  );
}
