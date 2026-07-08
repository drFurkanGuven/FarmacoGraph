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

/**
 * Production Studio uses Next `trailingSlash: true` with basePath `/studio`.
 * Middleware normally sees paths without the basePath (`/login/`), but normalize
 * defensively strips a configured basePath and trailing slashes before matching.
 */
export function normalizePathname(pathname: string): string {
  // Pathname should never include query/hash; strip defensively if callers pass a URL.
  let path = (pathname || "/").split(/[?#]/, 1)[0] || "/";
  const base = (process.env.NEXT_PUBLIC_BASE_PATH ?? "").replace(/\/+$/, "");
  if (base && (path === base || path.startsWith(`${base}/`))) {
    path = path.slice(base.length) || "/";
  }
  if (path === "/") return path;
  return path.replace(/\/+$/, "") || "/";
}

export function matchRouteGuard(pathname: string): RouteGuardConfig | null {
  const path = normalizePathname(pathname);

  if (PUBLIC_ROUTES.has(path)) return null;
  if (ROUTE_GUARDS[path]) return ROUTE_GUARDS[path];

  for (const [route, guard] of Object.entries(ROUTE_GUARDS)) {
    if (route !== "/" && path.startsWith(`${route}/`)) return guard;
  }

  return DEFAULT_AUTH_GUARD;
}

export function isProtectedPath(pathname: string): boolean {
  const guard = matchRouteGuard(pathname);
  return Boolean(guard?.requireAuth);
}

export const LOGIN_PATH = "/login";

export function isLoginPath(pathname: string): boolean {
  return normalizePathname(pathname) === LOGIN_PATH;
}

/** Safe post-login destination — never bounce back onto /login itself. */
export function safeReturnTo(returnTo: string | null | undefined): string {
  if (!returnTo) return "/";
  const cleaned = normalizePathname(returnTo);
  if (isLoginPath(cleaned)) return "/";
  return cleaned || "/";
}

export function loginRedirectUrl(returnTo: string): string {
  const params = new URLSearchParams({ returnTo: safeReturnTo(returnTo) });
  return `${LOGIN_PATH}?${params.toString()}`;
}

export type AuthMiddlewareDecision =
  | { action: "next" }
  | { action: "redirect"; loginPath: string; returnTo?: string };

/**
 * Pure middleware decision — keeps `/login` / `/login/` public forever and never
 * emits the production loop `Location: /login/?returnTo=/login/`.
 */
export function resolveAuthMiddleware(
  pathname: string,
  authenticated: boolean,
): AuthMiddlewareDecision {
  // Login must NEVER require auth (trailing slash / basePath variants included).
  if (isLoginPath(pathname) || !isProtectedPath(pathname)) {
    return { action: "next" };
  }

  if (authenticated) {
    return { action: "next" };
  }

  const returnTo = safeReturnTo(pathname === "/" ? "/" : pathname);
  // Belt-and-suspenders: if somehow returnTo collapsed to login, omit the param.
  if (isLoginPath(returnTo) || returnTo === LOGIN_PATH) {
    return { action: "redirect", loginPath: LOGIN_PATH };
  }

  return { action: "redirect", loginPath: LOGIN_PATH, returnTo };
}
