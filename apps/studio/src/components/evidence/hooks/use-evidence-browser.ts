"use client";

import { useMemo } from "react";
import { getEvidence, isEvidenceIdQuery, searchEvidence } from "@/lib/api/evidence";
import { apiQueryKeys } from "@/lib/api/react-query/keys";
import { useApiQuery } from "@/lib/api/react-query/optimistic";
import { useStatistics } from "@/lib/api/react-query/hooks";
import { useApiClient } from "@/lib/hooks/use-api-client";
import type { EvidenceBrowserFilters, EvidenceSortField, SortDirection } from "../types";
import {
  filterEvidenceRows,
  paginateRows,
  recordToRow,
  searchHitToRow,
  sortEvidenceRows,
  totalPages,
} from "../utils";

export interface UseEvidenceBrowserOptions {
  filters: EvidenceBrowserFilters;
  sortField: EvidenceSortField;
  sortDirection: SortDirection;
  page: number;
  pageSize: number;
}

export function useEvidenceBrowser({
  filters,
  sortField,
  sortDirection,
  page,
  pageSize,
}: UseEvidenceBrowserOptions) {
  const client = useApiClient();
  const trimmedQuery = filters.query.trim();
  const isSearching = trimmedQuery.length >= 2 && !isEvidenceIdQuery(trimmedQuery);
  const isIdLookup = isEvidenceIdQuery(trimmedQuery);

  const searchQuery = useApiQuery(
    apiQueryKeys.evidenceSearch(trimmedQuery, pageSize),
    () => searchEvidence(client, trimmedQuery, { limit: 100, offset: 0 }),
    { enabled: isSearching },
  );

  const lookupQuery = useApiQuery(
    apiQueryKeys.evidence(trimmedQuery),
    () => getEvidence(client, trimmedQuery),
    { enabled: isIdLookup },
  );

  const statisticsQuery = useStatistics();

  const activeQuery = isIdLookup ? lookupQuery : searchQuery;

  const enrichedRows = useMemo(() => {
    if (isIdLookup) {
      const record = lookupQuery.data?.data;
      return record ? [recordToRow(record)] : [];
    }
    const hits = searchQuery.data?.data ?? [];
    return hits.map(searchHitToRow);
  }, [isIdLookup, lookupQuery.data, searchQuery.data]);

  const filteredRows = useMemo(() => filterEvidenceRows(enrichedRows, filters), [enrichedRows, filters]);
  const sortedRows = useMemo(
    () => sortEvidenceRows(filteredRows, sortField, sortDirection),
    [filteredRows, sortField, sortDirection],
  );
  const rows = useMemo(() => paginateRows(sortedRows, page, pageSize), [sortedRows, page, pageSize]);
  const totalItems = sortedRows.length;
  const pageCount = totalPages(totalItems, pageSize);

  const isLoading = activeQuery.isLoading || statisticsQuery.isLoading;
  const isFetching = activeQuery.isFetching || statisticsQuery.isFetching;

  return {
    rows,
    totalItems,
    pageCount,
    isLoading,
    isFetching,
    error: activeQuery.error,
    refetch: activeQuery.refetch,
    isSearching,
    isIdLookup,
    hasQuery: trimmedQuery.length > 0,
    evidenceCount: statisticsQuery.data?.data.evidence_count ?? null,
    datasetVersion: statisticsQuery.data?.meta.dataset_version ?? null,
  };
}

export function useEvidenceDetail(evidenceId: string | null) {
  const client = useApiClient();
  return useApiQuery(
    apiQueryKeys.evidence(evidenceId ?? ""),
    () => getEvidence(client, evidenceId!),
    { enabled: Boolean(evidenceId) },
  );
}
