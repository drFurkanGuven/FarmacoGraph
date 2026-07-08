import { handleUnauthorized } from "./auth";
import { createApiError, parseErrorBody } from "./errors";
import { extractResponseTraceMeta, mergeTraceMetaIntoEnvelope } from "./headers";
import { createDefaultInterceptors, InterceptorRegistry, type RequestContext } from "./interceptors";
import { withRetry } from "./retry";
import type { ApiEnvelope, AuthSession } from "./types";

export interface TransportConfig {
  baseUrl: string;
  getSession?: () => AuthSession | null;
  getDatasetVersion?: () => string | null;
  onUnauthorized?: () => void;
  refreshSession?: () => Promise<boolean>;
  interceptors?: InterceptorRegistry;
  defaultRetries?: number;
}

export interface TransportRequestOptions extends Omit<RequestInit, "body"> {
  body?: unknown;
  params?: Record<string, string | number | boolean | undefined>;
  retries?: number;
  datasetVersion?: string | null;
}

function buildUrl(base: string, path: string, params?: TransportRequestOptions["params"]): string {
  const url = new URL(path.replace(/^\//, ""), base.endsWith("/") ? base : `${base}/`);
  if (params) {
    for (const [key, value] of Object.entries(params)) {
      if (value !== undefined && value !== null) url.searchParams.set(key, String(value));
    }
  }
  return url.toString();
}

export class ApiTransport {
  private readonly baseUrl: string;
  private readonly getSession?: () => AuthSession | null;
  private readonly getDatasetVersion?: () => string | null;
  private readonly onUnauthorized?: () => void;
  private readonly refreshSession?: () => Promise<boolean>;
  private readonly interceptors: InterceptorRegistry;
  private readonly defaultRetries: number;

  constructor(config: TransportConfig) {
    this.baseUrl = config.baseUrl;
    this.getSession = config.getSession;
    this.getDatasetVersion = config.getDatasetVersion;
    this.onUnauthorized = config.onUnauthorized;
    this.refreshSession = config.refreshSession;
    this.defaultRetries = config.defaultRetries ?? 2;
    this.interceptors =
      config.interceptors ??
      createDefaultInterceptors({
        getSession: config.getSession,
        getDatasetVersion: config.getDatasetVersion,
      });
  }

  get interceptorRegistry(): InterceptorRegistry {
    return this.interceptors;
  }

  async request<T>(path: string, options: TransportRequestOptions = {}): Promise<ApiEnvelope<T>> {
    return this.requestOnce<T>(path, options, true);
  }

  private async requestOnce<T>(
    path: string,
    options: TransportRequestOptions,
    allowRefresh: boolean,
  ): Promise<ApiEnvelope<T>> {
    const { body, params, retries = this.defaultRetries, headers, datasetVersion, ...init } = options;
    const url = buildUrl(this.baseUrl, path, params);

    return withRetry(
      async (attempt) => {
        const requestHeaders = new Headers(headers);
        requestHeaders.set("Accept", "application/json");
        if (body !== undefined) requestHeaders.set("Content-Type", "application/json");

        const ctx: RequestContext = {
          url,
          init,
          headers: requestHeaders,
          session: this.getSession?.() ?? null,
          datasetVersion: datasetVersion ?? this.getDatasetVersion?.() ?? null,
          attempt,
        };

        await this.interceptors.runRequest(ctx);

        try {
          const response = await fetch(url, {
            ...init,
            headers: requestHeaders,
            body: body !== undefined ? JSON.stringify(body) : undefined,
          });

          const trace = extractResponseTraceMeta(response);
          const text = await response.text();
          const parsed = text ? parseErrorBody(text) : null;

          if (!response.ok) {
            if (response.status === 401 && allowRefresh && this.refreshSession) {
              const refreshed = await this.refreshSession();
              if (refreshed) return this.requestOnce<T>(path, options, false);
            }
            handleUnauthorized(response.status, this.onUnauthorized);
            const error = createApiError(response.status, parsed, trace.traceId);
            await this.interceptors.runError(error, ctx);
            throw error;
          }

          const envelope = (parsed ?? { data: null, meta: {} }) as ApiEnvelope<T>;
          const merged = mergeTraceMetaIntoEnvelope(envelope, trace);

          await this.interceptors.runResponse({
            url,
            response,
            envelope: merged,
            traceId: trace.traceId,
            datasetVersion: trace.datasetVersion,
          });

          return merged;
        } catch (error) {
          await this.interceptors.runError(error, ctx);
          throw error;
        }
      },
      { retries },
    );
  }
}

export function createTransport(config: TransportConfig): ApiTransport {
  return new ApiTransport(config);
}
