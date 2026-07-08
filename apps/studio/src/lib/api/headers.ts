import type { ApiEnvelope } from "./types";

export const HEADER_REQUEST_ID = "X-Request-Id";
export const HEADER_CLIENT = "X-FarmacoGraph-Client";
export const HEADER_DATASET_VERSION = "X-Dataset-Version";
export const HEADER_API_VERSION = "X-API-Version";
export const HEADER_AUTHORIZATION = "Authorization";
export const HEADER_API_KEY = "X-API-Key";

export const STUDIO_CLIENT_ID = "studio";

export function createRequestId(): string {
  return crypto.randomUUID();
}

export function buildTracingHeaders(requestId?: string): Record<string, string> {
  return {
    [HEADER_REQUEST_ID]: requestId ?? createRequestId(),
    [HEADER_CLIENT]: STUDIO_CLIENT_ID,
  };
}

export function applyDatasetVersionHeader(headers: Headers, version?: string | null): void {
  if (version) headers.set(HEADER_DATASET_VERSION, version);
}

export interface ResponseTraceMeta {
  traceId: string | null;
  datasetVersion: string | null;
  apiVersion: string | null;
}

export function extractResponseTraceMeta(response: Response): ResponseTraceMeta {
  return {
    traceId: response.headers.get(HEADER_REQUEST_ID),
    datasetVersion: response.headers.get(HEADER_DATASET_VERSION),
    apiVersion: response.headers.get(HEADER_API_VERSION),
  };
}

export function mergeTraceMetaIntoEnvelope<T>(
  envelope: ApiEnvelope<T>,
  trace: ResponseTraceMeta,
): ApiEnvelope<T> {
  const meta = { ...envelope.meta };
  if (trace.datasetVersion && !meta.dataset_version) {
    meta.dataset_version = trace.datasetVersion;
  }
  if (trace.apiVersion && !meta.api_version) {
    meta.api_version = trace.apiVersion;
  }
  return { ...envelope, meta };
}
