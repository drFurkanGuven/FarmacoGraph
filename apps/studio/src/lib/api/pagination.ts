import type { PaginatedMeta, PaginationParams } from "./types";

export const DEFAULT_PAGE_LIMIT = 50;
export const MAX_PAGE_LIMIT = 200;

export function clampPageLimit(limit?: number): number {
  if (limit === undefined) return DEFAULT_PAGE_LIMIT;
  return Math.min(Math.max(1, limit), MAX_PAGE_LIMIT);
}

export function buildPaginationParams(
  params?: PaginationParams,
): Record<string, string | number> {
  const result: Record<string, string | number> = {};
  if (params?.limit !== undefined) result.limit = clampPageLimit(params.limit);
  if (params?.offset !== undefined) result.offset = Math.max(0, params.offset);
  return result;
}

export function getNextOffset(current: PaginationParams, pageSize: number): number {
  return (current.offset ?? 0) + pageSize;
}

export function hasMorePages(meta: PaginatedMeta, itemCount: number, pageSize: number): boolean {
  if (typeof meta.total === "number") {
    const offset = meta.offset ?? 0;
    return offset + itemCount < meta.total;
  }
  if (typeof meta.count === "number") {
    return itemCount >= pageSize && itemCount === meta.count;
  }
  return itemCount >= pageSize;
}

export function infiniteQueryGetNextPageParam<T>(
  lastPage: { data: T[]; meta: PaginatedMeta },
  _allPages: { data: T[]; meta: PaginatedMeta }[],
  pageSize: number,
): number | undefined {
  const offset = lastPage.meta.offset ?? 0;
  if (!hasMorePages(lastPage.meta, lastPage.data.length, pageSize)) return undefined;
  return offset + pageSize;
}

export function createInitialPageParam(offset = 0): number {
  return offset;
}
