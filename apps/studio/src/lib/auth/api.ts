import type { AuthScope } from "@/lib/api/types";

const DEFAULT_API_URL = "http://127.0.0.1:8001/api/v1";

export interface TokenResponse {
  access_token: string;
  refresh_token?: string | null;
  token_type?: string;
  expires_in?: number;
  scopes?: string[];
  email?: string | null;
  name?: string | null;
}

export interface AuthApiErrorBody {
  detail?: string | { msg: string }[];
  message?: string;
}

export class AuthApiError extends Error {
  readonly status: number;

  constructor(message: string, status: number) {
    super(message);
    this.name = "AuthApiError";
    this.status = status;
  }
}

function getBaseUrl(): string {
  return process.env.NEXT_PUBLIC_API_URL ?? DEFAULT_API_URL;
}

function normalizeDetail(body: AuthApiErrorBody | null, status: number): string {
  if (!body) return `Authentication failed (${status})`;
  if (typeof body.detail === "string") return body.detail;
  if (Array.isArray(body.detail)) return body.detail.map((d) => d.msg).join("; ");
  if (body.message) return body.message;
  return `Authentication failed (${status})`;
}

async function postAuth<T>(path: string, body: Record<string, unknown>): Promise<T> {
  const url = `${getBaseUrl().replace(/\/$/, "")}${path}`;
  const response = await fetch(url, {
    method: "POST",
    headers: {
      Accept: "application/json",
      "Content-Type": "application/json",
      "X-FarmacoGraph-Client": "studio",
    },
    body: JSON.stringify(body),
  });

  const text = await response.text();
  const json = text ? (JSON.parse(text) as T | AuthApiErrorBody) : null;

  if (!response.ok) {
    throw new AuthApiError(normalizeDetail(json as AuthApiErrorBody | null, response.status), response.status);
  }

  return json as T;
}

export interface PasswordLoginInput {
  email: string;
  password: string;
}

export interface ApiKeyLoginInput {
  apiKey: string;
}

export interface RefreshTokenInput {
  refreshToken: string;
}

export interface TokenLoginInput {
  accessToken: string;
  refreshToken?: string | null;
}

/** Calls public backend auth endpoints when available (Phase API 5.2). */
export const authApi = {
  async loginWithPassword(input: PasswordLoginInput): Promise<TokenResponse> {
    return postAuth<TokenResponse>("/auth/token", {
      grant_type: "password",
      username: input.email,
      password: input.password,
    });
  },

  async loginWithApiKey(input: ApiKeyLoginInput): Promise<TokenResponse> {
    return postAuth<TokenResponse>("/auth/token", {
      grant_type: "api_key",
      api_key: input.apiKey,
    });
  },

  async refreshToken(input: RefreshTokenInput): Promise<TokenResponse> {
    return postAuth<TokenResponse>("/auth/refresh", {
      refresh_token: input.refreshToken,
    });
  },

  async introspectApiKey(apiKey: string): Promise<{ scopes: AuthScope[]; name?: string; email?: string }> {
    return postAuth<{ scopes: AuthScope[]; name?: string; email?: string }>("/auth/introspect", {
      api_key: apiKey,
    });
  },
};

export function isAuthEndpointUnavailable(error: unknown): boolean {
  return error instanceof AuthApiError && (error.status === 404 || error.status === 501);
}
