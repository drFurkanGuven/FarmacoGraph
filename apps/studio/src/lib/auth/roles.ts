import type { AuthScope, UserRole } from "@/lib/api/types";
import { normalizeScopes } from "./scopes";

/** Default scopes granted to each Studio role (UI hints until JWT scopes are present). */
export const ROLE_SCOPES: Record<UserRole, AuthScope[]> = {
  viewer: ["knowledge:read", "knowledge:search", "education:read"],
  curator: ["knowledge:read", "knowledge:search", "knowledge:explain", "education:read", "curator:write"],
  reviewer: [
    "knowledge:read",
    "knowledge:search",
    "knowledge:explain",
    "education:read",
    "curator:write",
    "curator:publish",
  ],
  developer: [
    "knowledge:read",
    "knowledge:search",
    "knowledge:explain",
    "education:read",
    "graph:query",
    "curator:write",
    "admin:api_keys",
  ],
  administrator: [
    "knowledge:read",
    "knowledge:search",
    "knowledge:explain",
    "education:read",
    "graph:query",
    "curator:write",
    "curator:publish",
    "admin:org",
    "admin:api_keys",
  ],
};

const SCOPE_ROLE_HINTS: Partial<Record<AuthScope, UserRole[]>> = {
  "admin:org": ["administrator"],
  "admin:api_keys": ["administrator", "developer"],
  "curator:publish": ["reviewer", "administrator"],
  "curator:write": ["curator", "reviewer", "administrator", "developer"],
};

export function rolesFromScopes(scopes: AuthScope[]): UserRole[] {
  if (scopes.includes("admin:org")) return ["administrator"];
  const roles = new Set<UserRole>(["viewer"]);
  if (scopes.some((s) => s === "curator:write" || s === "curator:publish")) {
    roles.add("curator");
  }
  if (scopes.includes("curator:publish")) roles.add("reviewer");
  if (scopes.includes("admin:api_keys")) roles.add("developer");
  for (const scope of scopes) {
    for (const role of SCOPE_ROLE_HINTS[scope] ?? []) roles.add(role);
  }
  return [...roles];
}

export function scopesFromRoles(roles: UserRole[]): AuthScope[] {
  const merged = new Set<AuthScope>();
  for (const role of roles) {
    for (const scope of ROLE_SCOPES[role]) merged.add(scope);
  }
  return [...merged];
}

export function resolveSessionScopes(
  explicitScopes: AuthScope[] | undefined,
  roles: UserRole[],
): AuthScope[] {
  if (explicitScopes?.length) return normalizeScopes(explicitScopes);
  return scopesFromRoles(roles);
}

export function hasRole(roles: UserRole[], required: UserRole | UserRole[]): boolean {
  const needed = Array.isArray(required) ? required : [required];
  return needed.some((role) => roles.includes(role));
}

export function hasScope(scopes: AuthScope[], required: AuthScope | AuthScope[]): boolean {
  const needed = Array.isArray(required) ? required : [required];
  if (scopes.includes("admin:org")) return true;
  return needed.some((scope) => scopes.includes(scope));
}

export function hasPermission(
  scopes: AuthScope[],
  permission: AuthScope | AuthScope[],
): boolean {
  return hasScope(scopes, permission);
}
