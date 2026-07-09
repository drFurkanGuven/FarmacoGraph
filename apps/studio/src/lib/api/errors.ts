/** Normalized API error types and parsing helpers. */

export interface ApiErrorBody {
  detail?: string | { msg: string; loc?: string[]; type?: string }[] | { code?: string; message?: string };
  message?: string;
  error?: {
    code: string;
    message: string;
  };
}

export class ApiError extends Error {
  readonly status: number;
  readonly body: ApiErrorBody | null;
  readonly traceId: string | null;
  readonly code: string | null;

  constructor(
    message: string,
    status: number,
    body: ApiErrorBody | null = null,
    traceId: string | null = null,
  ) {
    super(message);
    this.name = "ApiError";
    this.status = status;
    this.body = body;
    this.traceId = traceId;
    this.code =
      body?.error?.code ??
      (body?.detail && !Array.isArray(body.detail) && typeof body.detail === "object"
        ? (body.detail.code ?? null)
        : null);
  }
}

export function parseErrorBody(text: string): ApiErrorBody | null {
  if (!text.trim()) return null;
  try {
    return JSON.parse(text) as ApiErrorBody;
  } catch {
    return { message: text };
  }
}

export function normalizeErrorMessage(body: ApiErrorBody | null, status: number): string {
  if (!body) return `Request failed (${status})`;
  if (body.error?.message) return body.error.message;
  if (typeof body.detail === "string") return body.detail;
  if (Array.isArray(body.detail)) return body.detail.map((d) => d.msg).join("; ");
  if (body.detail && typeof body.detail === "object" && body.detail.message) {
    return body.detail.message;
  }
  if (body.message) return body.message;
  return `Request failed (${status})`;
}

export function createApiError(
  status: number,
  body: ApiErrorBody | null,
  traceId: string | null,
): ApiError {
  return new ApiError(normalizeErrorMessage(body, status), status, body, traceId);
}

export function isApiError(error: unknown): error is ApiError {
  return error instanceof ApiError;
}
