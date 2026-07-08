"use client";

import { useCallback, useState } from "react";
import type { DrugBrowserFilters, SortDirection, SortField } from "../types";
import { DEFAULT_DRUG_BROWSER_FILTERS, DEFAULT_PAGE_SIZE } from "../types";

export function useDrugBrowserState(initialModule = "all") {
  const [filters, setFilters] = useState<DrugBrowserFilters>({
    ...DEFAULT_DRUG_BROWSER_FILTERS,
    module: initialModule,
  });
  const [sortField, setSortField] = useState<SortField>("label");
  const [sortDirection, setSortDirection] = useState<SortDirection>("asc");
  const [page, setPage] = useState(1);
  const [pageSize, setPageSize] = useState(DEFAULT_PAGE_SIZE);

  const updateFilters = useCallback((patch: Partial<DrugBrowserFilters>) => {
    setFilters((current) => ({ ...current, ...patch }));
    setPage(1);
  }, []);

  const toggleSort = useCallback(
    (field: SortField) => {
      if (sortField === field) {
        setSortDirection((current) => (current === "asc" ? "desc" : "asc"));
      } else {
        setSortField(field);
        setSortDirection("asc");
      }
      setPage(1);
    },
    [sortField],
  );

  const resetFilters = useCallback(() => {
    setFilters({ ...DEFAULT_DRUG_BROWSER_FILTERS, module: initialModule });
    setPage(1);
  }, [initialModule]);

  return {
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
  };
}
