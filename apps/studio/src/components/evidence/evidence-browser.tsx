"use client";

import { FlaskConical, RefreshCw } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { EmptyState } from "@/components/ui/empty-state";
import { ErrorState } from "@/components/ui/error-state";
import { TableSkeleton } from "@/components/ui/loading-skeleton";
import { ApiError } from "@/lib/api";
import { EvidenceDetailDrawer } from "./evidence-detail-drawer";
import { EvidenceFilters } from "./evidence-filters";
import { EvidenceFormDialog } from "./evidence-form";
import { EvidencePagination } from "./evidence-pagination";
import { EvidenceTable } from "./evidence-table";
import { useEvidenceBrowser } from "./hooks/use-evidence-browser";
import { useEvidenceBrowserState } from "./hooks/use-evidence-browser-state";

export function EvidenceBrowser() {
  const {
    filters,
    sortField,
    sortDirection,
    page,
    pageSize,
    selectedId,
    formOpen,
    formMode,
    updateFilters,
    toggleSort,
    setPage,
    setPageSize,
    resetFilters,
    openDetail,
    closeDetail,
    openCreateForm,
    openEditForm,
    closeForm,
  } = useEvidenceBrowserState();

  const browser = useEvidenceBrowser({
    filters,
    sortField,
    sortDirection,
    page,
    pageSize,
  });

  const errorMessage =
    browser.error instanceof ApiError ? browser.error.message : "Failed to load evidence.";

  const emptyDescription = !browser.hasQuery
    ? "Enter a search term (min 2 characters) or paste an evidence UUID to query the public API."
    : browser.isIdLookup
      ? "No evidence found for that ID. The GET /evidence/{id} endpoint may not be deployed yet."
      : "No evidence matched your search and filters. Try different terms or clear filters.";

  return (
    <div className="space-y-6 animate-fade-in">
      <div className="flex flex-col gap-3 md:flex-row md:items-end md:justify-between">
        <div>
          <h2 className="text-2xl font-semibold tracking-tight">Evidence manager</h2>
          <p className="text-sm text-muted-foreground">
            Browse, inspect, and draft evidence nodes backed by the public API — no mock pharmacology.
          </p>
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
          <CardTitle className="text-base">Search & filters</CardTitle>
          <CardDescription>Filter by ontology evidence type, quality, year, and publication status.</CardDescription>
        </CardHeader>
        <CardContent>
          <EvidenceFilters
            filters={filters}
            onChange={updateFilters}
            onReset={resetFilters}
            onCreate={openCreateForm}
            totalItems={browser.totalItems}
            evidenceCount={browser.evidenceCount}
            isSearching={browser.isSearching}
            isIdLookup={browser.isIdLookup}
          />
        </CardContent>
      </Card>

      <Card>
        <CardHeader className="pb-4">
          <CardTitle className="text-base">Evidence</CardTitle>
          <CardDescription>
            {browser.isSearching
              ? "Results from GET /search?types=evidence"
              : browser.isIdLookup
                ? "Single-record lookup from GET /evidence/{id}"
                : "Search or paste an evidence ID to load records"}
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
              icon={<FlaskConical className="h-6 w-6" />}
              title={browser.hasQuery ? "No evidence found" : "Start a search"}
              description={emptyDescription}
              actionLabel={browser.hasQuery ? "Reset filters" : undefined}
              onAction={browser.hasQuery ? resetFilters : undefined}
            />
          ) : (
            <EvidenceTable
              rows={browser.rows}
              sortField={sortField}
              sortDirection={sortDirection}
              onSort={toggleSort}
              onOpen={openDetail}
              onEdit={openEditForm}
            />
          )}

          <EvidencePagination
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

      <EvidenceDetailDrawer
        evidenceId={selectedId}
        open={Boolean(selectedId) && !formOpen}
        onClose={closeDetail}
        onEdit={openEditForm}
      />

      <EvidenceFormDialog
        open={formOpen}
        mode={formMode}
        evidenceId={selectedId}
        onClose={closeForm}
      />
    </div>
  );
}
