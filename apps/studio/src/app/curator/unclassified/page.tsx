"use client";

import { useEffect, useMemo, useState } from "react";
import { AlertTriangle, CheckCircle2, Loader2, Search, Tag, X } from "lucide-react";
import { apiClient, ApiError } from "@/lib/api";
import type { UnclassifiedDrug } from "@/lib/api/types";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";

/** Must stay in sync with MODULE_REGISTRY in farmacograph/services/modules.py. */
const MODULES = [
  { slug: "cardiovascular", name: "Cardiovascular" },
  { slug: "endocrinology", name: "Endocrinology" },
  { slug: "infectious-diseases", name: "Infectious Diseases" },
  { slug: "neurology", name: "Neurology" },
  { slug: "psychiatry", name: "Psychiatry" },
] as const;

const PAGE_SIZE = 50;

export default function UnclassifiedDrugsPage() {
  const [rows, setRows] = useState<UnclassifiedDrug[]>([]);
  const [total, setTotal] = useState(0);
  const [offset, setOffset] = useState(0);
  const [search, setSearch] = useState("");
  const [query, setQuery] = useState("");
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [saving, setSaving] = useState<string | null>(null);
  const [saved, setSaved] = useState<Record<string, string>>({});

  useEffect(() => {
    let cancelled = false;
    setLoading(true);
    setError(null);
    apiClient
      .unclassifiedDrugs({ search: query || undefined, limit: PAGE_SIZE, offset })
      .then((page) => {
        if (cancelled) return;
        setRows(page.data ?? []);
        setTotal(page.meta?.total ?? 0);
      })
      .catch((e) => {
        if (cancelled) return;
        setError(e instanceof ApiError ? e.message : String(e));
      })
      .finally(() => {
        if (!cancelled) setLoading(false);
      });
    return () => {
      cancelled = true;
    };
  }, [query, offset]);

  const page = Math.floor(offset / PAGE_SIZE) + 1;
  const pages = Math.max(1, Math.ceil(total / PAGE_SIZE));

  const assign = async (drugId: string, module: string) => {
    setSaving(drugId);
    setError(null);
    try {
      const res = await apiClient.assignDrugModule(drugId, module);
      setSaved((prev) => ({ ...prev, [drugId]: res.data.module }));
      setRows((prev) => prev.filter((r) => r.id !== drugId));
      setTotal((prev) => Math.max(0, prev - 1));
    } catch (e) {
      setError(e instanceof ApiError ? e.message : String(e));
    } finally {
      setSaving(null);
    }
  };

  const pending = useMemo(() => rows.length > 0, [rows]);

  return (
    <div className="space-y-6">
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Tag className="w-5 h-5" />
            Modül atanmamış ilaçlar
          </CardTitle>
          <CardDescription>
            PrimeKG veri setinde klinik modül alanı bulunmadığı için içe aktarılan{" "}
            <strong>{total.toLocaleString("tr-TR")}</strong> ilaç modül bilgisi olmadan duruyor. Bir
            ilaca modül atadığınızda kayıt &quot;küratör onaylı&quot; olarak işaretlenir.
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="flex flex-wrap items-center gap-2">
            <form
              className="flex flex-1 items-center gap-2"
              onSubmit={(e) => {
                e.preventDefault();
                setOffset(0);
                setQuery(search.trim());
              }}
            >
              <div className="relative flex-1">
                <Search className="absolute left-2.5 top-2.5 w-4 h-4 text-muted-foreground" />
                <Input
                  value={search}
                  onChange={(e) => setSearch(e.target.value)}
                  placeholder="İlaç adı veya slug ara..."
                  className="pl-8"
                  aria-label="İlaç ara"
                />
              </div>
              <Button type="submit" variant="secondary">
                Ara
              </Button>
              {query && (
                <Button
                  type="button"
                  variant="ghost"
                  onClick={() => {
                    setSearch("");
                    setQuery("");
                    setOffset(0);
                  }}
                >
                  <X className="w-4 h-4" />
                </Button>
              )}
            </form>
          </div>

          <div className="flex items-start gap-2 rounded-lg border border-amber-500/30 bg-amber-500/5 p-3">
            <AlertTriangle className="w-4 h-4 text-amber-600 dark:text-amber-400 shrink-0 mt-0.5" />
            <p className="text-xs text-muted-foreground leading-relaxed">
              Bu ilaçlar PrimeKG&apos;den içe aktarılmıştır ve küratör incelemesi taşımaz. Modül
              atamak yalnızca bir müfredat sınıflandırmasıdır; içeriği klinik olarak doğrulamış
              anlamına gelmez. Kullanıcıya gösterirken provenance etiketini koruyun.
            </p>
          </div>

          {error && (
            <div className="rounded-lg border border-destructive/40 bg-destructive/5 p-3 text-sm text-destructive">
              {error}
            </div>
          )}

          {loading ? (
            <div className="flex items-center gap-2 py-8 text-sm text-muted-foreground justify-center">
              <Loader2 className="w-4 h-4 animate-spin" /> Yükleniyor...
            </div>
          ) : rows.length === 0 ? (
            <div className="py-8 text-center text-sm text-muted-foreground">
              {total === 0
                ? "Tüm ilaçlara modül atanmış."
                : "Aramanızla eşleşen atanmamış ilaç yok."}
            </div>
          ) : (
            <ul className="divide-y">
              {rows.map((drug) => (
                <li key={drug.id} className="py-3 flex flex-wrap items-center gap-3">
                  <div className="min-w-0 flex-1">
                    <div className="flex items-center gap-2 flex-wrap">
                      <span className="font-medium truncate">{drug.label}</span>
                      {drug.curation_status === "external" && (
                        <Badge
                          variant="warning"
                          className="text-[10px]"
                          title="PrimeKG'den içe aktarıldı, küratör incelemesi yok."
                        >
                          PrimeKG
                        </Badge>
                      )}
                    </div>
                    <code className="text-xs text-muted-foreground">{drug.slug}</code>
                  </div>
                  {saved[drug.id] ? (
                    <span className="inline-flex items-center gap-1 text-xs text-emerald-600 dark:text-emerald-400">
                      <CheckCircle2 className="w-3.5 h-3.5" />
                      {saved[drug.id]} atandı
                    </span>
                  ) : (
                    <div className="flex flex-wrap items-center gap-1">
                      {MODULES.map((m) => (
                        <Button
                          key={m.slug}
                          size="sm"
                          variant="outline"
                          disabled={saving === drug.id}
                          onClick={() => assign(drug.id, m.slug)}
                        >
                          {saving === drug.id ? <Loader2 className="w-3 h-3 animate-spin" /> : null}
                          {m.name}
                        </Button>
                      ))}
                    </div>
                  )}
                </li>
              ))}
            </ul>
          )}

          {pages > 1 && (
            <div className="flex items-center justify-between border-t pt-3 text-sm">
              <span className="text-muted-foreground">
                Sayfa {page} / {pages} · toplam {total.toLocaleString("tr-TR")}
              </span>
              <div className="flex gap-2">
                <Button
                  variant="outline"
                  size="sm"
                  disabled={offset === 0 || loading}
                  onClick={() => setOffset(Math.max(0, offset - PAGE_SIZE))}
                >
                  Önceki
                </Button>
                <Button
                  variant="outline"
                  size="sm"
                  disabled={offset + PAGE_SIZE >= total || loading}
                  onClick={() => setOffset(offset + PAGE_SIZE)}
                >
                  Sonraki
                </Button>
              </div>
            </div>
          )}

          {pending && pages === 1 && total > 0 && (
            <p className="border-t pt-3 text-xs text-muted-foreground">
              Toplam {total.toLocaleString("tr-TR")} ilaç listeleniyor. Aramayı daraltarak
              ilerleyebilirsiniz.
            </p>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
