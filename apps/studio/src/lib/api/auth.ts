import { HEADER_API_KEY, HEADER_AUTHORIZATION } from "./headers";
import type { AuthSession } from "./types";

export type AuthMiddleware = (headers: Headers, session: AuthSession | null) => void;

export function applyAuthHeaders(headers: Headers, session: AuthSession | null | undefined): void {
  if (!session) return;
  if (session.accessToken) {
    headers.set(HEADER_AUTHORIZATION, `Bearer ${session.accessToken}`);
    return;
  }
  if (session.apiKey) {
    headers.set(HEADER_AUTHORIZATION, `Bearer ${session.apiKey}`);
    headers.set(HEADER_API_KEY, session.apiKey);
  }
}

export function createAuthMiddleware(
  getSession: () => AuthSession | null | undefined,
): AuthMiddleware {
  return (headers) => {
    applyAuthHeaders(headers, getSession() ?? null);
  };
}

export function handleUnauthorized(status: number, onUnauthorized?: () => void): void {
  if (status === 401) onUnauthorized?.();
}
