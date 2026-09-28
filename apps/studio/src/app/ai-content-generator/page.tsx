"use client";

import { useEffect, useState } from "react";
import {
  BookOpen,
  Brain,
  Copy,
  Download,
  Loader2,
  Sparkles,
  TestTube,
  Lightbulb,
  Search,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { useUIMode } from "@/lib/ui-mode/context";
import { apiClient } from "@/lib/api";

type ContentType = "flashcards" | "quiz" | "pearls";

interface Drug {
  id: string;
  slug: string;
  name: string;
}

interface DrugDetail {
  label: string;
  generic_name?: string;
  drug_class?: string;
  mechanism_summary?: string;
  indications?: string[];
  side_effects?: string[];
}

interface Flashcard {
  question: string;
  answer: string;
  showAnswer?: boolean;
}

interface QuizQuestion {
  question: string;
  options: string[];
  correct_answer: number;
  explanation: string;
  selectedAnswer?: number;
  showResult?: boolean;
}

interface ClinicalPearl {
  title: string;
  content: string;
}

export default function AIContentGeneratorPage() {
  const { isSimple } = useUIMode();
  const [drugs, setDrugs] = useState<Drug[]>([]);
  const [loadingDrugs, setLoadingDrugs] = useState(true);
  const [selectedDrugSlug, setSelectedDrugSlug] = useState("");
  const [drugDetail, setDrugDetail] = useState<DrugDetail | null>(null);
  const [loadingDetail, setLoadingDetail] = useState(false);
  const [searchQuery, setSearchQuery] = useState("");
  const [contentType, setContentType] = useState<ContentType>("flashcards");
  const [count, setCount] = useState(5);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  // Results
  const [flashcards, setFlashcards] = useState<Flashcard[]>([]);
  const [quizQuestions, setQuizQuestions] = useState<QuizQuestion[]>([]);
  const [pearls, setPearls] = useState<ClinicalPearl[]>([]);

  // Load drugs list
  useEffect(() => {
    async function loadDrugs() {
      setLoadingDrugs(true);
      try {
        const response = await apiClient.drugs({ limit: 200 });
        const items = (response.data ?? []).map((d) => ({
          id: String(d.id),
          slug: String(d.slug),
          name: String(d.label || d.slug),
        }));
        setDrugs(items);
      } catch (error) {
        console.error("Failed to load drugs:", error);
      } finally {
        setLoadingDrugs(false);
      }
    }
    loadDrugs();
  }, []);

  // Load drug detail when selected
  useEffect(() => {
    if (!selectedDrugSlug) {
      setDrugDetail(null);
      return;
    }

    async function loadDetail() {
      setLoadingDetail(true);
      try {
        const drug = drugs.find((d) => d.slug === selectedDrugSlug);
        if (!drug) return;

        const response = await apiClient.getDrug(drug.id);
        const payload = response.data as Record<string, unknown>;
        
        setDrugDetail({
          label: String(payload.label || payload.generic_name || drug.name),
          generic_name: String(payload.generic_name || ""),
          drug_class: String(payload.drug_class || ""),
          mechanism_summary: String(payload.mechanism_summary || ""),
          indications: Array.isArray(payload.indications) ? payload.indications.map(String) : [],
          side_effects: Array.isArray(payload.side_effects) ? payload.side_effects.map(String) : [],
        });
      } catch (error) {
        console.error("Failed to load drug detail:", error);
      } finally {
        setLoadingDetail(false);
      }
    }
    loadDetail();
  }, [selectedDrugSlug, drugs]);

  const filteredDrugs = drugs.filter(
    (d) =>
      d.name.toLowerCase().includes(searchQuery.toLowerCase()) ||
      d.slug.toLowerCase().includes(searchQuery.toLowerCase())
  );

  async function generateContent() {
    if (!selectedDrugSlug || !drugDetail) {
      setError(isSimple ? "İlaç seçimi gerekli" : "Drug selection is required");
      return;
    }

    setLoading(true);
    setError(null);

    const payload = {
      drug_name: drugDetail.label,
      drug_class: drugDetail.drug_class || "",
      mechanism: drugDetail.mechanism_summary || "",
      indications: drugDetail.indications?.join(", ") || "",
      side_effects: drugDetail.side_effects?.join(", ") || "",
      count: count,
    };

    try {
      if (contentType === "flashcards") {
        const response = await apiClient.request<{ flashcards: Flashcard[] }>(
          "/ai/generate/flashcards",
          { method: "POST", body: JSON.stringify(payload) }
        );
        const data = response.data?.flashcards || [];
        setFlashcards(data.map((fc: Flashcard) => ({ ...fc, showAnswer: false })));
        setQuizQuestions([]);
        setPearls([]);
      } else if (contentType === "quiz") {
        const response = await apiClient.request<{ questions: QuizQuestion[] }>(
          "/ai/generate/quiz",
          { method: "POST", body: JSON.stringify(payload) }
        );
        const data = response.data?.questions || [];
        setQuizQuestions(data.map((q: QuizQuestion) => ({ ...q, showResult: false })));
        setFlashcards([]);
        setPearls([]);
      } else {
        const response = await apiClient.request<{ pearls: ClinicalPearl[] }>(
          "/ai/generate/clinical-pearls",
          { method: "POST", body: JSON.stringify(payload) }
        );
        const data = response.data?.pearls || [];
        setPearls(data);
        setFlashcards([]);
        setQuizQuestions([]);
      }
    } catch (err) {
      const errorMessage = err instanceof Error ? err.message : "Failed to generate content";
      setError(isSimple ? "İçerik üretilemedi" : errorMessage);
    } finally {
      setLoading(false);
    }
  }

  function copyToClipboard(text: string) {
    navigator.clipboard.writeText(text);
  }

  function exportAsJSON() {
    const data = contentType === "flashcards" ? flashcards : contentType === "quiz" ? quizQuestions : pearls;
    const blob = new Blob([JSON.stringify(data, null, 2)], { type: "application/json" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = `${selectedDrugSlug}-${contentType}.json`;
    a.click();
  }

  const contentTypes = [
    { id: "flashcards" as ContentType, icon: BookOpen, label: isSimple ? "Flashcard" : "Flashcards", labelTr: "Bilgi Kartları" },
    { id: "quiz" as ContentType, icon: TestTube, label: isSimple ? "Quiz" : "Quiz Questions", labelTr: "Sınav Soruları" },
    { id: "pearls" as ContentType, icon: Lightbulb, label: isSimple ? "Klinik İpucu" : "Clinical Pearls", labelTr: "Klinik Bilgiler" },
  ];

  if (isSimple) {
    return (
      <div className="max-w-4xl mx-auto p-6 space-y-6">
        <div>
          <h1 className="text-2xl font-bold">AI İçerik Üretici</h1>
          <p className="text-muted-foreground text-sm mt-1">
            İlaçlar için otomatik eğitim içeriği oluşturun
          </p>
        </div>

        <Card>
          <CardHeader>
            <CardTitle className="text-base">İçerik Türü</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="grid grid-cols-3 gap-2">
              {contentTypes.map((type) => {
                const Icon = type.icon;
                return (
                  <button
                    key={type.id}
                    onClick={() => setContentType(type.id)}
                    className={`p-3 rounded-lg border text-center transition-colors ${
                      contentType === type.id
                        ? "border-primary bg-primary/5"
                        : "border-border hover:border-primary/50"
                    }`}
                  >
                    <Icon className="w-5 h-5 mx-auto mb-1" />
                    <p className="text-xs font-medium">{type.labelTr}</p>
                  </button>
                );
              })}
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle className="text-base">İlaç Seçimi</CardTitle>
          </CardHeader>
          <CardContent className="space-y-3">
            {loadingDrugs ? (
              <div className="flex items-center justify-center p-4">
                <Loader2 className="w-5 h-5 animate-spin text-primary" />
                <span className="ml-2 text-sm">İlaçlar yükleniyor...</span>
              </div>
            ) : (
              <>
                <div className="relative">
                  <Search className="w-4 h-4 absolute left-3 top-1/2 -translate-y-1/2 text-muted-foreground" />
                  <input
                    type="text"
                    placeholder="İlaç ara..."
                    value={searchQuery}
                    onChange={(e) => setSearchQuery(e.target.value)}
                    className="w-full pl-9 pr-4 py-2 rounded-lg border bg-background text-sm"
                  />
                </div>
                <select
                  value={selectedDrugSlug}
                  onChange={(e) => setSelectedDrugSlug(e.target.value)}
                  className="w-full px-3 py-2 rounded-lg border bg-background text-sm"
                >
                  <option value="">İlaç seçin...</option>
                  {filteredDrugs.map((drug) => (
                    <option key={drug.slug} value={drug.slug}>
                      {drug.name}
                    </option>
                  ))}
                </select>
              </>
            )}

            {loadingDetail && (
              <div className="flex items-center p-3 rounded-lg bg-muted/30">
                <Loader2 className="w-4 h-4 animate-spin text-primary" />
                <span className="ml-2 text-xs text-muted-foreground">İlaç bilgileri yükleniyor...</span>
              </div>
            )}

            {drugDetail && !loadingDetail && (
              <div className="p-3 rounded-lg bg-muted/30 border space-y-2">
                <div className="flex items-center justify-between">
                  <span className="font-medium text-sm">{drugDetail.label}</span>
                  {drugDetail.drug_class && (
                    <Badge variant="outline" className="text-xs">{drugDetail.drug_class}</Badge>
                  )}
                </div>
                {drugDetail.mechanism_summary && (
                  <p className="text-xs text-muted-foreground line-clamp-2">
                    {drugDetail.mechanism_summary}
                  </p>
                )}
                {drugDetail.indications && drugDetail.indications.length > 0 && (
                  <div className="flex flex-wrap gap-1">
                    {drugDetail.indications.slice(0, 3).map((ind, i) => (
                      <Badge key={i} variant="secondary" className="text-xs">{ind}</Badge>
                    ))}
                  </div>
                )}
              </div>
            )}

            <div>
              <label className="text-xs font-medium text-muted-foreground">Adet</label>
              <input
                type="number"
                min={1}
                max={20}
                value={count}
                onChange={(e) => setCount(parseInt(e.target.value))}
                className="w-20 mt-1 px-3 py-2 rounded-lg border bg-background text-sm"
              />
            </div>
          </CardContent>
        </Card>

        <Button onClick={generateContent} disabled={loading || !selectedDrugSlug} className="w-full">
          {loading ? (
            <>
              <Loader2 className="w-4 h-4 mr-2 animate-spin" />
              Üretiliyor...
            </>
          ) : (
            <>
              <Sparkles className="w-4 h-4 mr-2" />
              İçerik Üret
            </>
          )}
        </Button>

        {error && (
          <div className="p-3 rounded-lg bg-red-500/10 border border-red-500/30">
            <p className="text-sm text-red-600">{error}</p>
          </div>
        )}

        {/* Flashcards Result */}
        {flashcards.length > 0 && (
          <Card>
            <CardHeader>
              <div className="flex items-center justify-between">
                <CardTitle className="text-base">Oluşturulan Flashcardlar ({flashcards.length})</CardTitle>
                <Button variant="outline" size="sm" onClick={exportAsJSON}>
                  <Download className="w-3 h-3 mr-1" />
                  JSON
                </Button>
              </div>
            </CardHeader>
            <CardContent className="space-y-3">
              {flashcards.map((fc, i) => (
                <div key={i} className="p-4 rounded-lg border bg-muted/30">
                  <div className="flex items-start justify-between gap-2">
                    <div className="flex-1">
                      <p className="font-medium text-sm">{fc.question}</p>
                      {fc.showAnswer ? (
                        <p className="mt-2 text-sm text-muted-foreground">{fc.answer}</p>
                      ) : (
                        <Button
                          variant="ghost"
                          size="sm"
                          className="mt-2 text-xs"
                          onClick={() => {
                            const updated = [...flashcards];
                            updated[i].showAnswer = true;
                            setFlashcards(updated);
                          }}
                        >
                          Cevabı Göster
                        </Button>
                      )}
                    </div>
                    <Button
                      variant="ghost"
                      size="sm"
                      onClick={() => copyToClipboard(`${fc.question}\n${fc.answer}`)}
                    >
                      <Copy className="w-3 h-3" />
                    </Button>
                  </div>
                </div>
              ))}
            </CardContent>
          </Card>
        )}

        {/* Quiz Result */}
        {quizQuestions.length > 0 && (
          <Card>
            <CardHeader>
              <div className="flex items-center justify-between">
                <CardTitle className="text-base">Oluşturulan Sorular ({quizQuestions.length})</CardTitle>
                <Button variant="outline" size="sm" onClick={exportAsJSON}>
                  <Download className="w-3 h-3 mr-1" />
                  JSON
                </Button>
              </div>
            </CardHeader>
            <CardContent className="space-y-4">
              {quizQuestions.map((q, i) => (
                <div key={i} className="p-4 rounded-lg border bg-muted/30 space-y-3">
                  <p className="font-medium text-sm">{q.question}</p>
                  <div className="space-y-2">
                    {q.options.map((opt, j) => (
                      <button
                        key={j}
                        onClick={() => {
                          const updated = [...quizQuestions];
                          updated[i].selectedAnswer = j;
                          updated[i].showResult = true;
                          setQuizQuestions(updated);
                        }}
                        className={`w-full text-left p-2 rounded border text-sm transition-colors ${
                          q.showResult
                            ? j === q.correct_answer
                              ? "bg-green-500/20 border-green-500/50"
                              : j === q.selectedAnswer
                              ? "bg-red-500/20 border-red-500/50"
                              : "border-border"
                            : "border-border hover:border-primary/50"
                        }`}
                      >
                        {String.fromCharCode(65 + j)}. {opt}
                      </button>
                    ))}
                  </div>
                  {q.showResult && (
                    <div className="p-2 rounded bg-blue-500/10 border border-blue-500/30">
                      <p className="text-xs text-blue-600">{q.explanation}</p>
                    </div>
                  )}
                </div>
              ))}
            </CardContent>
          </Card>
        )}

        {/* Pearls Result */}
        {pearls.length > 0 && (
          <Card>
            <CardHeader>
              <div className="flex items-center justify-between">
                <CardTitle className="text-base">Klinik İpuçları ({pearls.length})</CardTitle>
                <Button variant="outline" size="sm" onClick={exportAsJSON}>
                  <Download className="w-3 h-3 mr-1" />
                  JSON
                </Button>
              </div>
            </CardHeader>
            <CardContent className="space-y-3">
              {pearls.map((pearl, i) => (
                <div key={i} className="p-4 rounded-lg border bg-muted/30">
                  <div className="flex items-start justify-between gap-2">
                    <div className="flex-1">
                      <p className="font-medium text-sm text-primary">{pearl.title}</p>
                      <p className="mt-1 text-sm text-muted-foreground">{pearl.content}</p>
                    </div>
                    <Button
                      variant="ghost"
                      size="sm"
                      onClick={() => copyToClipboard(`${pearl.title}\n${pearl.content}`)}
                    >
                      <Copy className="w-3 h-3" />
                    </Button>
                  </div>
                </div>
              ))}
            </CardContent>
          </Card>
        )}
      </div>
    );
  }

  // Professional mode
  return (
    <div className="max-w-5xl mx-auto p-6 space-y-6">
      <div>
        <div className="inline-flex items-center gap-2 px-3 py-1 rounded-full text-xs font-medium bg-primary/10 text-primary mb-2">
          <Brain className="w-3.5 h-3.5" />
          AI Content Generator
        </div>
        <h1 className="text-3xl font-bold tracking-tight">AI Education Content Generator</h1>
        <p className="text-muted-foreground text-sm mt-1">
          Generate flashcards, quiz questions, and clinical pearls for any drug using AI.
        </p>
      </div>

      <div className="grid gap-6 md:grid-cols-3">
        <div className="md:col-span-1 space-y-4">
          <Card>
            <CardHeader>
              <CardTitle className="text-sm">Content Type</CardTitle>
            </CardHeader>
            <CardContent>
              <div className="space-y-2">
                {contentTypes.map((type) => {
                  const Icon = type.icon;
                  return (
                    <button
                      key={type.id}
                      onClick={() => setContentType(type.id)}
                      className={`w-full flex items-center gap-2 p-3 rounded-lg border text-left transition-colors ${
                        contentType === type.id
                          ? "border-primary bg-primary/5"
                          : "border-border hover:border-primary/50"
                      }`}
                    >
                      <Icon className="w-4 h-4" />
                      <span className="text-sm font-medium">{type.label}</span>
                    </button>
                  );
                })}
              </div>
            </CardContent>
          </Card>

          <Card>
            <CardHeader>
              <CardTitle className="text-sm">Select Drug</CardTitle>
            </CardHeader>
            <CardContent className="space-y-3">
              {loadingDrugs ? (
                <div className="flex items-center justify-center p-4">
                  <Loader2 className="w-5 h-5 animate-spin text-primary" />
                </div>
              ) : (
                <>
                  <div className="relative">
                    <Search className="w-4 h-4 absolute left-3 top-1/2 -translate-y-1/2 text-muted-foreground" />
                    <input
                      type="text"
                      placeholder="Search drugs..."
                      value={searchQuery}
                      onChange={(e) => setSearchQuery(e.target.value)}
                      className="w-full pl-9 pr-4 py-2 rounded-lg border bg-background text-sm"
                    />
                  </div>
                  <select
                    value={selectedDrugSlug}
                    onChange={(e) => setSelectedDrugSlug(e.target.value)}
                    className="w-full px-3 py-2 rounded-lg border bg-background text-sm"
                  >
                    <option value="">Select a drug...</option>
                    {filteredDrugs.map((drug) => (
                      <option key={drug.slug} value={drug.slug}>
                        {drug.name}
                      </option>
                    ))}
                  </select>
                </>
              )}

              {loadingDetail && (
                <div className="flex items-center p-3 rounded-lg bg-muted/30">
                  <Loader2 className="w-4 h-4 animate-spin text-primary" />
                  <span className="ml-2 text-xs text-muted-foreground">Loading drug info...</span>
                </div>
              )}

              {drugDetail && !loadingDetail && (
                <div className="p-3 rounded-lg bg-muted/30 border space-y-2">
                  <div className="flex items-center justify-between">
                    <span className="font-medium text-sm">{drugDetail.label}</span>
                    {drugDetail.drug_class && (
                      <Badge variant="outline" className="text-xs">{drugDetail.drug_class}</Badge>
                    )}
                  </div>
                  {drugDetail.mechanism_summary && (
                    <p className="text-xs text-muted-foreground line-clamp-3">
                      {drugDetail.mechanism_summary}
                    </p>
                  )}
                  {drugDetail.indications && drugDetail.indications.length > 0 && (
                    <div className="flex flex-wrap gap-1">
                      {drugDetail.indications.slice(0, 4).map((ind, i) => (
                        <Badge key={i} variant="secondary" className="text-xs">{ind}</Badge>
                      ))}
                    </div>
                  )}
                </div>
              )}

              <div>
                <label className="text-xs font-medium text-muted-foreground">Count</label>
                <input
                  type="number"
                  min={1}
                  max={20}
                  value={count}
                  onChange={(e) => setCount(parseInt(e.target.value))}
                  className="w-20 mt-1 px-3 py-2 rounded-lg border bg-background text-sm"
                />
              </div>
            </CardContent>
          </Card>

          <Button onClick={generateContent} disabled={loading || !selectedDrugSlug} className="w-full">
            {loading ? (
              <>
                <Loader2 className="w-4 h-4 mr-2 animate-spin" />
                Generating...
              </>
            ) : (
              <>
                <Sparkles className="w-4 h-4 mr-2" />
                Generate Content
              </>
            )}
          </Button>
        </div>

        <div className="md:col-span-2">
          {error && (
            <div className="p-4 rounded-lg bg-red-500/10 border border-red-500/30 mb-4">
              <p className="text-sm text-red-600">{error}</p>
            </div>
          )}

          {/* Flashcards */}
          {flashcards.length > 0 && (
            <Card>
              <CardHeader>
                <div className="flex items-center justify-between">
                  <CardTitle>Generated Flashcards ({flashcards.length})</CardTitle>
                  <Button variant="outline" size="sm" onClick={exportAsJSON}>
                    <Download className="w-4 h-4 mr-2" />
                    Export JSON
                  </Button>
                </div>
              </CardHeader>
              <CardContent className="space-y-3">
                {flashcards.map((fc, i) => (
                  <div key={i} className="p-4 rounded-lg border bg-muted/30">
                    <div className="flex items-start justify-between gap-3">
                      <div className="flex-1 space-y-2">
                        <p className="font-medium">{fc.question}</p>
                        {fc.showAnswer ? (
                          <p className="text-muted-foreground">{fc.answer}</p>
                        ) : (
                          <Button
                            variant="ghost"
                            size="sm"
                            onClick={() => {
                              const updated = [...flashcards];
                              updated[i].showAnswer = true;
                              setFlashcards(updated);
                            }}
                          >
                            Show Answer
                          </Button>
                        )}
                      </div>
                      <Button
                        variant="ghost"
                        size="sm"
                        onClick={() => copyToClipboard(`${fc.question}\n${fc.answer}`)}
                      >
                        <Copy className="w-4 h-4" />
                      </Button>
                    </div>
                  </div>
                ))}
              </CardContent>
            </Card>
          )}

          {/* Quiz */}
          {quizQuestions.length > 0 && (
            <Card>
              <CardHeader>
                <div className="flex items-center justify-between">
                  <CardTitle>Generated Questions ({quizQuestions.length})</CardTitle>
                  <Button variant="outline" size="sm" onClick={exportAsJSON}>
                    <Download className="w-4 h-4 mr-2" />
                    Export JSON
                  </Button>
                </div>
              </CardHeader>
              <CardContent className="space-y-4">
                {quizQuestions.map((q, i) => (
                  <div key={i} className="p-4 rounded-lg border bg-muted/30 space-y-3">
                    <p className="font-medium">{q.question}</p>
                    <div className="space-y-2">
                      {q.options.map((opt, j) => (
                        <button
                          key={j}
                          onClick={() => {
                            const updated = [...quizQuestions];
                            updated[i].selectedAnswer = j;
                            updated[i].showResult = true;
                            setQuizQuestions(updated);
                          }}
                          className={`w-full text-left p-3 rounded border transition-colors ${
                            q.showResult
                              ? j === q.correct_answer
                                ? "bg-green-500/20 border-green-500/50"
                                : j === q.selectedAnswer
                                ? "bg-red-500/20 border-red-500/50"
                                : "border-border"
                              : "border-border hover:border-primary/50"
                          }`}
                        >
                          {String.fromCharCode(65 + j)}. {opt}
                        </button>
                      ))}
                    </div>
                    {q.showResult && (
                      <div className="p-3 rounded bg-blue-500/10 border border-blue-500/30">
                        <p className="text-sm text-blue-600">{q.explanation}</p>
                      </div>
                    )}
                  </div>
                ))}
              </CardContent>
            </Card>
          )}

          {/* Pearls */}
          {pearls.length > 0 && (
            <Card>
              <CardHeader>
                <div className="flex items-center justify-between">
                  <CardTitle>Clinical Pearls ({pearls.length})</CardTitle>
                  <Button variant="outline" size="sm" onClick={exportAsJSON}>
                    <Download className="w-4 h-4 mr-2" />
                    Export JSON
                  </Button>
                </div>
              </CardHeader>
              <CardContent className="space-y-3">
                {pearls.map((pearl, i) => (
                  <div key={i} className="p-4 rounded-lg border bg-muted/30">
                    <div className="flex items-start justify-between gap-3">
                      <div className="flex-1">
                        <p className="font-medium text-primary">{pearl.title}</p>
                        <p className="mt-1 text-muted-foreground">{pearl.content}</p>
                      </div>
                      <Button
                        variant="ghost"
                        size="sm"
                        onClick={() => copyToClipboard(`${pearl.title}\n${pearl.content}`)}
                      >
                        <Copy className="w-4 h-4" />
                      </Button>
                    </div>
                  </div>
                ))}
              </CardContent>
            </Card>
          )}

          {!flashcards.length && !quizQuestions.length && !pearls.length && !loading && (
            <Card>
              <CardContent className="p-12 text-center">
                <Brain className="w-12 h-12 mx-auto text-muted-foreground mb-4" />
                <p className="text-muted-foreground">
                  Select a drug and click &quot;Generate Content&quot; to create educational materials.
                </p>
              </CardContent>
            </Card>
          )}
        </div>
      </div>
    </div>
  );
}
