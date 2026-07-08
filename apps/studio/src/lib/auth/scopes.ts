import type { AuthScope } from "@/lib/api/types";

/** All scopes recognized by the FarmacoGraph API. */
export const ALL_SCOPES: readonly AuthScope[] = [
  "knowledge:read",
  "knowledge:search",
  "knowledge:explain",
  "education:read",
  "graph:query",
  "curator:write",
  "curator:publish",
  "admin:org",
  "admin:api_keys",
] as const;

export function isAuthScope(value: string): value is AuthScope {
  return (ALL_SCOPES as readonly string[]).includes(value);
}

export function normalizeScopes(scopes: string[] | undefined | null): AuthScope[] {
  if (!scopes?.length) return ["knowledge:read"];
  const unique = new Set<AuthScope>();
  for (const scope of scopes) {
    if (isAuthScope(scope)) unique.add(scope);
  }
  return unique.size > 0 ? [...unique] : ["knowledge:read"];
}
