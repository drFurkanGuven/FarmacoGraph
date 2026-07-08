export { composeDashboardFallback, fetchDashboard, resolveModuleSlug } from "./dashboard";

export { FarmacoGraphClient, createApiClient } from "./client";
export type { ClientConfig, RequestOptions } from "./client";

export { ApiTransport, createTransport } from "./transport";
export type { TransportConfig, TransportRequestOptions } from "./transport";

export {
  ApiError,
  createApiError,
  isApiError,
  normalizeErrorMessage,
  parseErrorBody,
} from "./errors";
export type { ApiErrorBody } from "./errors";

export {
  DEFAULT_RETRIES,
  DEFAULT_RETRY_BASE_MS,
  getRetryDelay,
  isRetryableError,
  withRetry,
} from "./retry";
export type { RetryOptions } from "./retry";

export {
  DEFAULT_PAGE_LIMIT,
  MAX_PAGE_LIMIT,
  buildPaginationParams,
  clampPageLimit,
  createInitialPageParam,
  getNextOffset,
  hasMorePages,
  infiniteQueryGetNextPageParam,
} from "./pagination";

export {
  HEADER_API_KEY,
  HEADER_API_VERSION,
  HEADER_CLIENT,
  HEADER_DATASET_VERSION,
  HEADER_REQUEST_ID,
  STUDIO_CLIENT_ID,
  applyDatasetVersionHeader,
  buildTracingHeaders,
  createRequestId,
  extractResponseTraceMeta,
  mergeTraceMetaIntoEnvelope,
} from "./headers";
export type { ResponseTraceMeta } from "./headers";

export { applyAuthHeaders, createAuthMiddleware, handleUnauthorized } from "./auth";
export type { AuthMiddleware } from "./auth";

export {
  InterceptorRegistry,
  createDefaultInterceptors,
} from "./interceptors";
export type {
  DefaultInterceptorOptions,
  ErrorInterceptor,
  RequestContext,
  RequestInterceptor,
  ResponseContext,
  ResponseInterceptor,
} from "./interceptors";

export * from "./types";
export * from "./react-query";
