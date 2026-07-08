import type { AuthScope } from "@/lib/api/types";
import { normalizeScopes } from "./scopes";

export interface JwtPayload {
  sub?: string;
  exp?: number;
  scopes?: string[];
  email?: string;
  name?: string;
}

export function decodeJwtPayload(token: string): JwtPayload | null {
  try {
    const parts = token.split(".");
    if (parts.length !== 3) return null;
    const base64 = parts[1].replace(/-/g, "+").replace(/_/g, "/");
    const padded = base64.padEnd(base64.length + ((4 - (base64.length % 4)) % 4), "=");
    const json = decodeBase64(padded);
    return JSON.parse(json) as JwtPayload;
  } catch {
    return null;
  }
}

function decodeBase64(value: string): string {
  if (typeof atob === "function") return atob(value);
  return Buffer.from(value, "base64").toString("utf8");
}

export function jwtExpiresAtMs(token: string): number | null {
  const payload = decodeJwtPayload(token);
  if (!payload?.exp) return null;
  return payload.exp * 1000;
}

export function jwtScopes(token: string): AuthScope[] {
  const payload = decodeJwtPayload(token);
  return normalizeScopes(payload?.scopes);
}

export function isTokenExpired(expiresAt: number | null, skewMs = 60_000): boolean {
  if (expiresAt === null) return false;
  return Date.now() >= expiresAt - skewMs;
}

export function sessionFromAccessToken(
  accessToken: string,
  refreshToken: string | null = null,
): {
  accessToken: string;
  refreshToken: string | null;
  scopes: AuthScope[];
  expiresAt: number | null;
  email: string | null;
  displayName: string;
} {
  const payload = decodeJwtPayload(accessToken);
  const scopes = jwtScopes(accessToken);
  return {
    accessToken,
    refreshToken,
    scopes,
    expiresAt: jwtExpiresAtMs(accessToken),
    email: payload?.email ?? null,
    displayName: payload?.name ?? payload?.sub ?? "Authenticated user",
  };
}
