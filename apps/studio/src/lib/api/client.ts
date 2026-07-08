import {
  ApiEnvelope,
  ApiError,
  ApiErrorBody,
  AuthSession,
  CurriculumData,
  DrugSummary,
  HealthData,
  InfoData,
  ModuleItem,
  StatisticsData,
  WorkflowItem,
} from "./types";

export interface ClientConfig {
  baseUrl: string;
  getSession?: () => AuthSession | null;
  onUnauthorized?: () => void;
}

export interface RequestOptions extends Omit<RequestInit, "body"> {
  body?: unknown;
  params?: Record<string, string | number | boolean | undefined>;
  retries?: number;
}

const DEFAULT_RETRIES = 2;

function buildUrl(base: string, path: string, params?: RequestOptions["params"]): string {
  const url = new URL(path.replace(/^\//, ""), base.endsWith("/") ? base : `${base}/`);
  if (params) {
    for (const [key, value] of Object.entries(params)) {
      if (value !== undefined) url.searchParams.set(key, String(value));
    }
  }
  return url.toString();
}

function normalizeErrorMessage(body: ApiErrorBody | null, status: number): string {
  if (!body) return `Request failed (${status})`;
  if (typeof body.detail === "string") return body.detail;
  if (Array.isArray(body.detail)) return body.detail.map((d) => d.msg).join("; ");
  if (body.message) return body.message;
  return `Request failed (${status})`;
}

export class FarmacoGraphClient {
  private readonly baseUrl: string;
  private readonly getSession?: () => AuthSession | null;
  private readonly onUnauthorized?: () => void;

  constructor(config: ClientConfig) {
    this.baseUrl = config.baseUrl;
    this.getSession = config.getSession;
    this.onUnauthorized = config.onUnauthorized;
  }

  async request<T>(path: string, options: RequestOptions = {}): Promise<ApiEnvelope<T>> {
    const { body, params, retries = DEFAULT_RETRIES, headers, ...init } = options;
    const url = buildUrl(this.baseUrl, path, params);
    const session = this.getSession?.();

    const requestHeaders = new Headers(headers);
    requestHeaders.set("Accept", "application/json");
    if (body !== undefined) requestHeaders.set("Content-Type", "application/json");
    if (session?.accessToken) requestHeaders.set("Authorization", `Bearer ${session.accessToken}`);
    if (session?.apiKey) requestHeaders.set("X-API-Key", session.apiKey);
    requestHeaders.set("X-FarmacoGraph-Client", "studio");
    requestHeaders.set("X-Request-Id", crypto.randomUUID());

    let lastError: unknown;
    for (let attempt = 0; attempt <= retries; attempt++) {
      try {
        const response = await fetch(url, {
          ...init,
          headers: requestHeaders,
          body: body !== undefined ? JSON.stringify(body) : undefined,
        });

        const traceId = response.headers.get("X-Request-Id");
        const datasetVersion = response.headers.get("X-Dataset-Version");
        const text = await response.text();
        const json = text ? (JSON.parse(text) as ApiEnvelope<T> | ApiErrorBody) : null;

        if (!response.ok) {
          const errBody = json as ApiErrorBody | null;
          if (response.status === 401) this.onUnauthorized?.();
          throw new ApiError(normalizeErrorMessage(errBody, response.status), response.status, errBody, traceId);
        }

        const envelope = json as ApiEnvelope<T>;
        if (datasetVersion && envelope.meta) {
          envelope.meta.dataset_version = envelope.meta.dataset_version ?? datasetVersion;
        }
        return envelope;
      } catch (error) {
        lastError = error;
        if (error instanceof ApiError || attempt === retries) throw error;
        await new Promise((r) => setTimeout(r, 300 * (attempt + 1)));
      }
    }
    throw lastError;
  }

  health() {
    return this.request<HealthData>("/health");
  }

  info() {
    return this.request<InfoData>("/info");
  }

  statistics() {
    return this.request<StatisticsData>("/statistics");
  }

  modules() {
    return this.request<ModuleItem[]>("/modules");
  }

  curriculum(moduleSlug: string) {
    return this.request<CurriculumData>(`/modules/${moduleSlug}/curriculum`);
  }

  curatorQueue(state = "review") {
    return this.request<WorkflowItem[]>("/curator/queue", { params: { state } });
  }

  drugs(module?: string) {
    return this.request<DrugSummary[]>("/drugs", { params: { module } });
  }

  search(q: string, limit = 10) {
    return this.request<DrugSummary[]>("/search", { params: { q, limit } });
  }
}

export function createApiClient(config: ClientConfig): FarmacoGraphClient {
  return new FarmacoGraphClient(config);
}
