"use client";

import { useMemo, useState } from "react";
import { usePathname, useRouter, useSearchParams } from "next/navigation";
import { Pill, Search, X } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { useCuratorDrugs } from "@/lib/api/react-query/hooks";
import type { DrugBrowseItem } from "@/lib/api";

function statusTone(row: DrugBrowseItem): "success" | "warning" | "muted" {
  if (row.workflow_state === "published" || row.publication_status === "published") return "success";
  if (row.workflow_state === "approved" || row.workflow_state === "review") return "warning";
  return "muted";
}

function statusLabel(row: DrugBrowseItem): string {
  return row.workflow_state ?? row.publication_status ?? "unknown";
}

export function DrugFocusPicker({
  title = "Select a drug",
  description = "Pick a curriculum drug to load the published graph projection. Unpublished drugs may show an empty canvas until publish.",
}: {
  title?: string;
  description?: string;
}) {
  const router = useRouter();
  const pathname = usePathname();
  const searchParams = useSearchParams();
  const focusedDrug = searchParams.get("drug");
  const [query, setQuery] = useState("");

  const drugsQuery = useCuratorDrugs({
    search: query.trim() || undefined,
    sort: "slug",
    limit: 40,
  });

  const rows = useMemo(() => {
    const data = drugsQuery.data?.data ?? [];
    return [...data].sort((a, b) => {
      const aPub = a.workflow_state === "published" || a.publication_status === "published" ? 0 : 1;
      const bPub = b.workflow_state === "published" || b.publication_status === "published" ? 0 : 1;
      if (aPub !== bPub) return aPub - bPub;
      return a.label.localeCompare(b.label);
    });
  }, [drugsQuery.data]);

  function setDrug(slug: string | null) {
    const params = new URLSearchParams(searchParams.toString());
    if (slug) params.set("drug", slug);
    else params.delete("drug");
    const qs = params.toString();
    router.replace(qs ? `${pathname}?${qs}` : pathname);
  }

  return (
    <Card className="rounded-md">
      <CardHeader className="pb-3">
        <div className="flex flex-wrap items-start justify-between gap-3">
          <div>
            <CardTitle className="flex items-center gap-2 text-base">
              <Pill className="h-4 w-4" />
              {title}
            </CardTitle>
            <CardDescription>{description}</CardDescription>
          </div>
          {focusedDrug ? (
            <Button size="sm" variant="outline" onClick={() => setDrug(null)}>
              <X className="h-4 w-4" />
              Clear
            </Button>
          ) : null}
        </div>
      </CardHeader>
      <CardContent className="space-y-3">
        {focusedDrug ? (
          <div className="flex flex-wrap items-center gap-2 rounded-md border bg-muted/30 px-3 py-2 text-sm">
            <span className="text-muted-foreground">Focused:</span>
            <Badge variant="outline" className="font-mono">
              {focusedDrug}
            </Badge>
          </div>
        ) : (
          <p className="text-sm text-muted-foreground">
            No drug selected yet. Choose one below — published drugs are listed first.
          </p>
        )}

        <div className="relative">
          <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
          <Input
            className="pl-9"
            placeholder="Search drugs…"
            value={query}
            onChange={(event) => setQuery(event.target.value)}
          />
        </div>

        {drugsQuery.isLoading ? (
          <p className="text-sm text-muted-foreground">Loading drugs…</p>
        ) : drugsQuery.error ? (
          <p className="text-sm text-destructive">Unable to load drug catalog.</p>
        ) : rows.length === 0 ? (
          <p className="text-sm text-muted-foreground">No drugs match this search.</p>
        ) : (
          <ul className="max-h-64 divide-y overflow-auto rounded-md border">
            {rows.map((row) => {
              const active = focusedDrug === row.slug;
              return (
                <li key={row.slug}>
                  <button
                    type="button"
                    className={`flex w-full items-center justify-between gap-3 px-3 py-2 text-left text-sm transition-colors hover:bg-muted/50 ${
                      active ? "bg-muted/60" : ""
                    }`}
                    onClick={() => setDrug(row.slug)}
                  >
                    <div className="min-w-0">
                      <p className="truncate font-medium">{row.label}</p>
                      <p className="truncate font-mono text-xs text-muted-foreground">{row.slug}</p>
                    </div>
                    <Badge variant={statusTone(row)}>{statusLabel(row)}</Badge>
                  </button>
                </li>
              );
            })}
          </ul>
        )}
      </CardContent>
    </Card>
  );
}
