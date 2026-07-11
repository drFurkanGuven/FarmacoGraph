"use client";

import { Pill, RefreshCw } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { EmptyState } from "@/components/ui/empty-state";
import { ErrorState } from "@/components/ui/error-state";
import { TableSkeleton } from "@/components/ui/loading-skeleton";
import { resolveModuleSlug } from "@/lib/api";
import { ApiError } from "@/lib/api";
import { useAuth } from "@/lib/auth/context";
import { DrugFilters } from "./drug-filters";
import { DrugPagination } from "./drug-pagination";
import { DrugTable } from "./drug-table";
import { useDrugBrowser } from "./hooks/use-drug-browser";
import { useDrugBrowserState } from "./hooks/use-drug-browser-state";

export function DrugBrowser() {
  const { activeWorkspace } = useAuth();
  const initialModule = resolveModuleSlug(activeWorkspace.slug);

  const {
    filters,
    sortField,
    sortDirection,
    page,
    pageSize,
    updateFilters,
    toggleSort,
    setPage,
    setPageSize,
    resetFilters,
  } = useDrugBrowserState(initialModule);

  const browser = useDrugBrowser({
    filters,
    sortField,
    sortDirection,
    page,
    pageSize,
  });

  const errorMessage =
    browser.error instanceof ApiError ? browser.error.message : "Failed to load drugs.";

  return (
    <div className="space-y-6 animate-fade-in">
      <div className="flex flex-col gap-3 md:flex-row md:items-end md:justify-between">
        <div>
          <h2 className="text-2xl font-semibold tracking-tight">Drug browser</h2>
          <p className="text-sm text-muted-foreground">
            Curriculum drugs, curator workflows, and package validation — powered by the curator API.
          </p>
          {browser.curriculumStats && (
            <p className="mt-1 text-xs text-muted-foreground">
              Curriculum progress: {browser.curriculumStats.published_in_graph ?? 0} published /{" "}
              {browser.curriculumStats.total_slugs} slugs
            </p>
          )}
        </div>
        <Button
          variant="outline"
          size="sm"
          onClick={() => void browser.refetch()}
          disabled={browser.isFetching}
        >
          <RefreshCw className={`h-4 w-4 ${browser.isFetching ? "animate-spin" : ""}`} />
          Refresh
        </Button>
      </div>

      <Card>
        <CardHeader className="pb-4">
          <CardTitle className="text-base">Filters</CardTitle>
          <CardDescription>Search, module, status, and validation filters.</CardDescription>
        </CardHeader>
        <CardContent>
          <DrugFilters
            filters={filters}
            modules={browser.modules}
            onChange={updateFilters}
            onReset={resetFilters}
            isSearching={browser.isSearching}
            totalItems={browser.totalItems}
          />
        </CardContent>
      </Card>

      <Card>
        <CardHeader className="pb-4">
          <CardTitle className="text-base">Drugs</CardTitle>
          <CardDescription>
            {browser.isSearching
              ? "Search results from GET /curator/drugs"
              : "Curriculum + workflow list from GET /curator/drugs"}
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          {browser.error && (
            <ErrorState message={errorMessage} onRetry={() => void browser.refetch()} variant="inline" />
          )}

          {browser.isLoading ? (
            <TableSkeleton rows={8} columns={7} />
          ) : browser.rows.length === 0 ? (
            <EmptyState
              icon={<Pill className="h-6 w-6" />}
              title="No drugs found"
              description={
                browser.isSearching
                  ? "Try a different search term or clear filters."
                  : "Publish knowledge via curator workflows or adjust filters."
              }
              actionLabel="Reset filters"
              onAction={resetFilters}
            />
          ) : (
            <DrugTable
              rows={browser.rows}
              sortField={sortField}
              sortDirection={sortDirection}
              onSort={toggleSort}
            />
          )}

          <DrugPagination
            page={page}
            pageCount={browser.pageCount}
            pageSize={pageSize}
            totalItems={browser.totalItems}
            onPageChange={setPage}
            onPageSizeChange={(size) => {
              setPageSize(size);
              setPage(1);
            }}
            disabled={browser.isLoading}
          />
        </CardContent>
      </Card>
    </div>
  );
}
