"use client";

import Link from "next/link";
import { RefreshCw, ShieldCheck, Stethoscope } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { EmptyState } from "@/components/ui/empty-state";
import { ErrorState } from "@/components/ui/error-state";
import { Input } from "@/components/ui/input";
import { TableSkeleton } from "@/components/ui/loading-skeleton";
import { ApiError } from "@/lib/api";
import { DiseaseTable } from "./disease-table";
import { useDiseaseBrowser } from "./use-disease-browser";
import { useState } from "react";

export function DiseaseBrowser() {
  const [query, setQuery] = useState("");
  const [workflowState, setWorkflowState] = useState("all");
  const browser = useDiseaseBrowser({ query, workflowState });

  const errorMessage =
    browser.error instanceof ApiError ? browser.error.message : "Failed to load diseases.";

  return (
    <div className="space-y-6 animate-fade-in">
      <div className="flex flex-col gap-3 md:flex-row md:items-end md:justify-between">
        <div>
          <h2 className="text-2xl font-semibold tracking-tight">Disease browser</h2>
          <p className="text-sm text-muted-foreground">
            Shared cardiovascular disease nodes from the knowledge catalog and curator workflows.
          </p>
        </div>
        <div className="flex flex-wrap gap-2">
          <Button asChild variant="outline" size="sm">
            <Link href="/validation">
              <ShieldCheck className="h-4 w-4" />
              Validation
            </Link>
          </Button>
          <Button variant="outline" size="sm" onClick={() => void browser.refetch()} disabled={browser.isFetching}>
            <RefreshCw className={`h-4 w-4 ${browser.isFetching ? "animate-spin" : ""}`} />
            Refresh
          </Button>
        </div>
      </div>

      <Card>
        <CardHeader className="pb-4">
          <CardTitle className="text-base">Filters</CardTitle>
          <CardDescription>Search diseases and filter by workflow state.</CardDescription>
        </CardHeader>
        <CardContent className="flex flex-col gap-3 md:flex-row">
          <Input
            placeholder="Search diseases…"
            value={query}
            onChange={(event) => setQuery(event.target.value)}
          />
          <select
            className="h-10 rounded-md border bg-background px-3 text-sm"
            value={workflowState}
            onChange={(event) => setWorkflowState(event.target.value)}
          >
            <option value="all">All workflow states</option>
            <option value="draft">Draft</option>
            <option value="review">Review</option>
            <option value="approved">Approved</option>
            <option value="published">Published</option>
          </select>
        </CardContent>
      </Card>

      {browser.isLoading ? (
        <TableSkeleton rows={4} />
      ) : browser.error ? (
        <ErrorState title="Unable to load diseases" message={errorMessage} onRetry={() => void browser.refetch()} />
      ) : browser.rows.length === 0 ? (
        <EmptyState
          icon={<Stethoscope className="h-6 w-6" />}
          title="No diseases found"
          description="Try clearing filters or check API connectivity."
        />
      ) : (
        <DiseaseTable
          rows={browser.rows}
          sortField={browser.sortField}
          sortDirection={browser.sortDirection}
          onSort={browser.toggleSort}
        />
      )}
    </div>
  );
}
