"use client";

import { useState } from "react";
import { Search } from "lucide-react";
import { useQuery } from "@tanstack/react-query";
import { Input } from "@/components/ui/input";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Skeleton } from "@/components/ui/skeleton";
import { useApiClient } from "@/lib/hooks/use-api-client";

export default function SearchPage() {
  const client = useApiClient();
  const [q, setQ] = useState("");

  const search = useQuery({
    queryKey: ["search", q],
    queryFn: () => client.search(q),
    enabled: q.trim().length >= 2,
  });

  return (
    <div className="mx-auto max-w-3xl space-y-4">
      <div>
        <h2 className="text-2xl font-semibold tracking-tight">Global search</h2>
        <p className="text-sm text-muted-foreground">Powered by the public knowledge search API.</p>
      </div>
      <div className="relative">
        <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
        <Input
          className="pl-9"
          placeholder="Search drugs (min 2 characters)…"
          value={q}
          onChange={(e) => setQ(e.target.value)}
          aria-label="Search knowledge base"
        />
      </div>
      <Card>
        <CardHeader>
          <CardTitle className="text-base">Results</CardTitle>
        </CardHeader>
        <CardContent>
          {q.length < 2 && <p className="text-sm text-muted-foreground">Type at least 2 characters.</p>}
          {search.isLoading && <Skeleton className="h-20 w-full" />}
          {search.data?.data.length === 0 && q.length >= 2 && (
            <p className="text-sm text-muted-foreground">No results. Publish knowledge via Studio workflows.</p>
          )}
          <ul className="space-y-2">
            {search.data?.data.map((item) => (
              <li key={item.id} className="rounded-md border px-3 py-2 text-sm">
                <span className="font-medium">{item.label}</span>
                <span className="ml-2 font-mono text-xs text-muted-foreground">{item.slug}</span>
              </li>
            ))}
          </ul>
        </CardContent>
      </Card>
    </div>
  );
}
