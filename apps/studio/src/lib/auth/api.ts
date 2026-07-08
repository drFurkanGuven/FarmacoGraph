import type { AuthScope } from "@/lib/api/types";
import { resolveStudioApiUrl } from "@/lib/api/base-url";

export interface TokenResponse {
  access_token: string;
  refresh_token?: string | null;
  token_type?: string;
  expires_in?: number;
  scopes?: string[];
  email?: string | null;
  name?: string | null;
}

export interface IntrospectResponse {
  active: boolean;
  scopes: AuthScope[];
  roles: string[];
  user_id?: string | null;
  organization_id?: string | null;
  workspace_id?: string | null;
  token_type: "bearer" | "api_key";
  auth_method: "jwt" | "api_key";
  expires_at?: number | null;
  email?: string | null;
  name?: string | null;
}

export interface IntrospectInput {
  apiKey?: string;
  accessToken?: string;
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
  return resolveStudioApiUrl();
}

function normalizeDetail(body: AuthApiErrorBody | null, status: number): string {
  if (!body) return `Authentication failed (${status})`;
  if (typeof body.detail === "string") return body.detail;
  if (Array.isArray(body.detail)) return body.detail.map((d) => d.msg).join("; ");
  if (body.message) return body.message;
  return `Authentication failed (${status})`;
}

async function postAuth<T>(
  path: string,
  body: Record<string, unknown>,
  extraHeaders?: Record<string, string>,
): Promise<T> {
  const url = `${getBaseUrl().replace(/\/$/, "")}${path}`;
  const response = await fetch(url, {
    method: "POST",
    headers: {
      Accept: "application/json",
      "Content-Type": "application/json",
      "X-FarmacoGraph-Client": "studio",
      ...extraHeaders,
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

  async introspect(input: IntrospectInput = {}): Promise<IntrospectResponse> {
    const headers: Record<string, string> = {};
    const body: Record<string, unknown> = {};

    if (input.accessToken) {
      headers.Authorization = `Bearer ${input.accessToken}`;
      body.access_token = input.accessToken;
    } else if (input.apiKey) {
      headers.Authorization = `Bearer ${input.apiKey}`;
      headers["X-API-Key"] = input.apiKey;
      body.api_key = input.apiKey;
    }

    return postAuth<IntrospectResponse>("/auth/introspect", body, headers);
  },

  async introspectApiKey(apiKey: string): Promise<IntrospectResponse> {
    return this.introspect({ apiKey });
  },
};

export function isAuthEndpointUnavailable(error: unknown): boolean {
  return error instanceof AuthApiError && (error.status === 404 || error.status === 501);
}
