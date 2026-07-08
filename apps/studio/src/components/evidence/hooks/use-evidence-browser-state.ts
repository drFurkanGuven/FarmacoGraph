"use client";

import { useCallback, useState } from "react";
import type { EvidenceBrowserFilters, EvidenceSortField, SortDirection } from "../types";
import { DEFAULT_EVIDENCE_BROWSER_FILTERS, DEFAULT_PAGE_SIZE } from "../types";

export function useEvidenceBrowserState() {
  const [filters, setFilters] = useState<EvidenceBrowserFilters>(DEFAULT_EVIDENCE_BROWSER_FILTERS);
  const [sortField, setSortField] = useState<EvidenceSortField>("label");
  const [sortDirection, setSortDirection] = useState<SortDirection>("asc");
  const [page, setPage] = useState(1);
  const [pageSize, setPageSize] = useState(DEFAULT_PAGE_SIZE);
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [formOpen, setFormOpen] = useState(false);
  const [formMode, setFormMode] = useState<"create" | "edit">("create");

  const updateFilters = useCallback((patch: Partial<EvidenceBrowserFilters>) => {
    setFilters((current) => ({ ...current, ...patch }));
    setPage(1);
  }, []);

  const toggleSort = useCallback(
    (field: EvidenceSortField) => {
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
    setFilters(DEFAULT_EVIDENCE_BROWSER_FILTERS);
    setPage(1);
  }, []);

  const openDetail = useCallback((id: string) => {
    setSelectedId(id);
  }, []);

  const closeDetail = useCallback(() => {
    setSelectedId(null);
  }, []);

  const openCreateForm = useCallback(() => {
    setFormMode("create");
    setFormOpen(true);
  }, []);

  const openEditForm = useCallback((id: string) => {
    setSelectedId(id);
    setFormMode("edit");
    setFormOpen(true);
  }, []);

  const closeForm = useCallback(() => {
    setFormOpen(false);
  }, []);

  return {
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
  };
}
