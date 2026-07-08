import type { AuthScope, UserRole } from "@/lib/api/types";

export interface RouteGuardConfig {
  requireAuth?: boolean;
  roles?: UserRole[];
  scopes?: AuthScope[];
}

/** Public routes — no guard applied. Everything else requires an authenticated session. */
export const PUBLIC_ROUTES = new Set(["/login"]);

/**
 * Explicit route guards for elevated Studio pages.
 * Unlisted non-public routes still require auth via the default guard.
 */
export const ROUTE_GUARDS: Record<string, RouteGuardConfig> = {
  "/": { requireAuth: true, scopes: ["knowledge:read"] },
  "/settings": { requireAuth: true },
  "/users": { requireAuth: true, roles: ["administrator"] },
  "/knowledge/drugs": { requireAuth: true, scopes: ["curator:write"] },
  "/knowledge/diseases": { requireAuth: true, scopes: ["curator:write"] },
  "/knowledge/mechanisms": { requireAuth: true, scopes: ["curator:write"] },
  "/knowledge/evidence": { requireAuth: true, scopes: ["curator:write"] },
  "/knowledge/education": { requireAuth: true, scopes: ["curator:write"] },
  "/validation": { requireAuth: true, scopes: ["curator:write"] },
  "/snapshots": { requireAuth: true, scopes: ["curator:publish"] },
  "/graph": { requireAuth: true, scopes: ["knowledge:read"] },
  "/search": { requireAuth: true, scopes: ["knowledge:search"] },
};

const DEFAULT_AUTH_GUARD: RouteGuardConfig = { requireAuth: true };

export function matchRouteGuard(pathname: string): RouteGuardConfig | null {
  if (PUBLIC_ROUTES.has(pathname)) return null;
  if (ROUTE_GUARDS[pathname]) return ROUTE_GUARDS[pathname];

  for (const [route, guard] of Object.entries(ROUTE_GUARDS)) {
    if (route !== "/" && pathname.startsWith(`${route}/`)) return guard;
  }

  return DEFAULT_AUTH_GUARD;
}

export function isProtectedPath(pathname: string): boolean {
  const guard = matchRouteGuard(pathname);
  return Boolean(guard?.requireAuth);
}

export const LOGIN_PATH = "/login";

export function loginRedirectUrl(returnTo: string): string {
  const params = new URLSearchParams({ returnTo });
  return `${LOGIN_PATH}?${params.toString()}`;
}
