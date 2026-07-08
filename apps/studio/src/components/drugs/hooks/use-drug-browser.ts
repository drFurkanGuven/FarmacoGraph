"use client";

import { useMemo } from "react";
import { hasMorePages, resolveModuleSlug } from "@/lib/api";
import { apiQueryKeys } from "@/lib/api/react-query/keys";
import { useApiQuery } from "@/lib/api/react-query/optimistic";
import {
  useCuratorQueue,
  useCurriculum,
  useModules,
  useSearch,
} from "@/lib/api/react-query/hooks";
import { useAuth } from "@/lib/auth/context";
import { useApiClient } from "@/lib/hooks/use-api-client";
import type { DrugBrowserFilters, DrugBrowserRow, SortDirection, SortField } from "../types";
import {
  buildDrugRows,
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
  const client = useApiClient();
  const { activeWorkspace } = useAuth();
  const workspaceModule = resolveModuleSlug(activeWorkspace.slug);

  const isSearching = filters.query.trim().length >= 2;
  const moduleForApi =
    filters.module === "all" ? undefined : filters.module || workspaceModule;
  const curriculumModule = filters.module === "all" ? workspaceModule : filters.module;
  const offset = (page - 1) * pageSize;

  const searchQuery = useSearch(filters.query, isSearching);

  const listQuery = useApiQuery(
    apiQueryKeys.drugs(moduleForApi, { limit: pageSize, offset }),
    () => client.drugs({ module: moduleForApi, limit: pageSize, offset }),
    { enabled: !isSearching },
  );

  const modulesQuery = useModules();
  const curriculumQuery = useCurriculum(curriculumModule);
  const draftQueue = useCuratorQueue("draft");
  const reviewQueue = useCuratorQueue("review");

  const activeQuery = isSearching ? searchQuery : listQuery;

  const enrichedRows = useMemo(() => {
    const apiDrugs = activeQuery.data?.data ?? [];
    return buildDrugRows({
      drugs: apiDrugs,
      curriculum: isSearching ? null : curriculumQuery.data?.data,
      drafts: draftQueue.data?.data ?? [],
      reviews: reviewQueue.data?.data ?? [],
      module: moduleForApi ?? curriculumModule,
    });
  }, [
    activeQuery.data,
    curriculumQuery.data,
    draftQueue.data,
    reviewQueue.data,
    isSearching,
    moduleForApi,
    curriculumModule,
  ]);

  const filteredRows = useMemo(() => filterDrugRows(enrichedRows, filters), [enrichedRows, filters]);
  const sortedRows = useMemo(
    () => sortDrugRows(filteredRows, sortField, sortDirection),
    [filteredRows, sortField, sortDirection],
  );

  const usesClientPipeline =
    isSearching || filters.status !== "all" || filters.validation !== "all" || filters.module === "all";

  const rows: DrugBrowserRow[] = usesClientPipeline
    ? paginateDrugRows(sortedRows, page, pageSize)
    : sortedRows;

  const totalItems = usesClientPipeline
    ? sortedRows.length
    : (activeQuery.data?.meta.total ?? sortedRows.length);

  const pageCount = totalPages(totalItems, pageSize);

  const hasMore = isSearching
    ? hasMorePages(activeQuery.data?.meta ?? {}, activeQuery.data?.data.length ?? 0, pageSize)
    : usesClientPipeline
      ? page < pageCount
      : hasMorePages(activeQuery.data?.meta ?? {}, activeQuery.data?.data.length ?? 0, pageSize);

  const isLoading =
    activeQuery.isLoading ||
    modulesQuery.isLoading ||
    (!isSearching && curriculumQuery.isLoading);

  const isFetching =
    activeQuery.isFetching ||
    modulesQuery.isFetching ||
    draftQueue.isFetching ||
    reviewQueue.isFetching ||
    (!isSearching && curriculumQuery.isFetching);

  return {
    rows,
    totalItems,
    pageCount,
    hasMore,
    isLoading,
    isFetching,
    error: activeQuery.error ?? modulesQuery.error,
    refetch: activeQuery.refetch,
    modules: modulesQuery.data?.data ?? [],
    isSearching,
    curriculumStats: curriculumQuery.data?.data?.stats ?? null,
    usesClientPipeline,
  };
}
