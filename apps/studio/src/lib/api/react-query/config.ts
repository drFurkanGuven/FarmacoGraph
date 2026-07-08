import { ApiError } from "../errors";

export const DEFAULT_STALE_TIME_MS = 30_000;
export const DEFAULT_GC_TIME_MS = 5 * 60_000;
export const DASHBOARD_REFRESH_MS = 30_000;

export function shouldRetryQuery(count: number, error: unknown, maxRetries = 2): boolean {
  if (error instanceof ApiError && error.status < 500) return false;
  return count < maxRetries;
}

export const defaultQueryOptions = {
  staleTime: DEFAULT_STALE_TIME_MS,
  gcTime: DEFAULT_GC_TIME_MS,
  refetchOnWindowFocus: true,
  retry: (count: number, error: unknown) => shouldRetryQuery(count, error),
} as const;

export const defaultMutationOptions = {
  retry: 0,
} as const;
