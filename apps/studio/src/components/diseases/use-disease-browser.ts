"use client";

import { useMemo, useState } from "react";
import { apiQueryKeys } from "@/lib/api/react-query/keys";
import { useApiQuery } from "@/lib/api/react-query/optimistic";
import { useApiClient } from "@/lib/hooks/use-api-client";
import type { DiseaseBrowserFilters, DiseaseSortDirection, DiseaseSortField } from "./types";

export function useDiseaseBrowser(filters: DiseaseBrowserFilters) {
  const client = useApiClient();
  const [sortField, setSortField] = useState<DiseaseSortField>("slug");
  const [sortDirection, setSortDirection] = useState<DiseaseSortDirection>("asc");

  const query = useApiQuery(
    apiQueryKeys.curatorDiseases({
      search: filters.query,
      workflowState: filters.workflowState === "all" ? undefined : filters.workflowState,
    }),
    () =>
      client.curatorDiseases({
        search: filters.query || undefined,
        workflowState: filters.workflowState === "all" ? undefined : filters.workflowState,
        limit: 100,
      }),
  );

  const rows = useMemo(() => {
    const data = query.data?.data ?? [];
    const sorted = [...data].sort((a, b) => {
      const left = sortField === "label" ? a.label.toLowerCase() : a.slug;
      const right = sortField === "label" ? b.label.toLowerCase() : b.slug;
      if (left < right) return sortDirection === "asc" ? -1 : 1;
      if (left > right) return sortDirection === "asc" ? 1 : -1;
      return 0;
    });
    return sorted;
  }, [query.data, sortDirection, sortField]);

  function toggleSort(field: DiseaseSortField) {
    if (sortField === field) {
      setSortDirection((current) => (current === "asc" ? "desc" : "asc"));
      return;
    }
    setSortField(field);
    setSortDirection("asc");
  }

  return {
    rows,
    isLoading: query.isLoading,
    isFetching: query.isFetching,
    error: query.error,
    refetch: query.refetch,
    sortField,
    sortDirection,
    toggleSort,
  };
}
