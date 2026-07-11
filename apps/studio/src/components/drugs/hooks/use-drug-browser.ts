"use client";

import { useMemo } from "react";
import { resolveModuleSlug } from "@/lib/api";
import { useCuratorDrugs, useCurriculum, useModules } from "@/lib/api/react-query/hooks";
import { useAuth } from "@/lib/auth/context";
import type { DrugBrowserFilters, DrugBrowserRow, SortDirection, SortField } from "../types";
import {
  browseItemToRow,
  filterDrugRows,
  paginateDrugRows,
  sortDrugRows,
  totalPages,
} from "../utils";

export interface UseDrugBrowserOptions {
  filters: DrugBrowserFilters;
  sortField: SortField;
  sortDirection: SortDirection;
  page: number;
  pageSize: number;
}

export function useDrugBrowser({
  filters,
  sortField,
  sortDirection,
  page,
  pageSize,
}: UseDrugBrowserOptions) {
  const { activeWorkspace } = useAuth();
  const workspaceModule = resolveModuleSlug(activeWorkspace.slug);

  const isSearching = filters.query.trim().length >= 2;
  const moduleForApi =
    filters.module === "all" ? "all" : filters.module || workspaceModule;
  const curriculumModule =
    filters.module === "all" ? workspaceModule : filters.module || workspaceModule;

  const listQuery = useCuratorDrugs({
    module: moduleForApi,
    search: isSearching ? filters.query.trim() : undefined,
    limit: 200,
    offset: 0,
    sort: "slug",
  });

  const modulesQuery = useModules();
  const curriculumQuery = useCurriculum(curriculumModule);

  const enrichedRows = useMemo(() => {
    const items = listQuery.data?.data ?? [];
    return items.map(browseItemToRow);
  }, [listQuery.data]);

  const filteredRows = useMemo(() => filterDrugRows(enrichedRows, filters), [enrichedRows, filters]);
  const sortedRows = useMemo(
    () => sortDrugRows(filteredRows, sortField, sortDirection),
    [filteredRows, sortField, sortDirection],
  );

  const rows: DrugBrowserRow[] = paginateDrugRows(sortedRows, page, pageSize);
  const totalItems = sortedRows.length;
  const pageCount = totalPages(totalItems, pageSize);
  const hasMore = page < pageCount;

  const isLoading = listQuery.isLoading || modulesQuery.isLoading || curriculumQuery.isLoading;
  const isFetching =
    listQuery.isFetching || modulesQuery.isFetching || curriculumQuery.isFetching;

  return {
    rows,
    totalItems,
    pageCount,
    hasMore,
    isLoading,
    isFetching,
    error: listQuery.error ?? modulesQuery.error,
    refetch: listQuery.refetch,
    modules: modulesQuery.data?.data ?? [],
    isSearching,
    curriculumStats: curriculumQuery.data?.data?.stats ?? null,
    usesClientPipeline: true,
  };
}
