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
  "/dashboard": { requireAuth: true, scopes: ["knowledge:read"] },
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

/** Production Studio is always served under /studio unless overridden. */
export function studioBasePath(): string {
  const fromEnv = (process.env.NEXT_PUBLIC_BASE_PATH ?? "").trim();
  if (fromEnv) return fromEnv.replace(/\/+$/, "");
  return "/studio";
}

export const LOGIN_PATH = "/login";

/**
 * Production Studio uses Next `trailingSlash: true` with basePath `/studio`.
 * Middleware normally sees paths without the basePath (`/login/`), but normalize
 * defensively strips basePath (env or `/studio` fallback) and trailing slashes.
 */
export function normalizePathname(pathname: string): string {
  let path = (pathname || "/").split(/[?#]/, 1)[0] || "/";
  const base = studioBasePath();
  if (base && (path === base || path.startsWith(`${base}/`))) {
    path = path.slice(base.length) || "/";
  }
  if (path === "/") return path;
  return path.replace(/\/+$/, "") || "/";
}

/**
 * True for `/login`, `/login/`, optionally basePath-prefixed (`/studio/login/`).
 * Does not depend solely on PUBLIC_ROUTES Set membership (which missed `/login/`
 * before normalize existed → production loop returnTo=%2Flogin%2F).
 */
export function isLoginPath(pathname: string): boolean {
  return normalizePathname(pathname) === LOGIN_PATH;
}

export function matchRouteGuard(pathname: string): RouteGuardConfig | null {
  if (isLoginPath(pathname)) return null;

  const path = normalizePathname(pathname);
  if (PUBLIC_ROUTES.has(path)) return null;
  if (ROUTE_GUARDS[path]) return ROUTE_GUARDS[path];

  for (const [route, guard] of Object.entries(ROUTE_GUARDS)) {
    if (route !== "/" && path.startsWith(`${route}/`)) return guard;
  }

  return DEFAULT_AUTH_GUARD;
}

export function isProtectedPath(pathname: string): boolean {
  if (isLoginPath(pathname)) return false;
  const guard = matchRouteGuard(pathname);
  return Boolean(guard?.requireAuth);
}

/** True if returnTo looks like an open redirect target. */
function isUnsafeReturnTo(raw: string): boolean {
  const value = raw.trim();
  if (!value) return true;
  // Absolute / protocol-relative URLs
  if (/^[a-zA-Z][a-zA-Z0-9+.-]*:/i.test(value)) return true;
  if (value.startsWith("//")) return true;
  // Must be an in-app absolute path
  if (!value.startsWith("/")) return true;
  if (value.includes("\\") || value.includes("..")) return true;
  return false;
}

/**
 * Safe post-login destination — never bounce onto /login, never open-redirect.
 */
export function safeReturnTo(returnTo: string | null | undefined): string {
  if (!returnTo) return "/";
  let raw = returnTo.trim();
  try {
    // One decode so %2Flogin%2F is caught as /login/
    raw = decodeURIComponent(raw);
  } catch {
    return "/";
  }
  if (isUnsafeReturnTo(raw)) return "/";
  if (isLoginPath(raw)) return "/";
  const cleaned = normalizePathname(raw);
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
  if (isLoginPath(pathname)) {
    return { action: "next" };
  }

  if (!isProtectedPath(pathname)) {
    return { action: "next" };
  }

  if (authenticated) {
    return { action: "next" };
  }

  const returnTo = safeReturnTo(pathname === "/" ? "/" : pathname);
  if (isLoginPath(returnTo)) {
    return { action: "redirect", loginPath: LOGIN_PATH, returnTo: "/" };
  }

  return { action: "redirect", loginPath: LOGIN_PATH, returnTo };
}

/** Detect the production login-loop Location signature. */
export function isLoginLoopLocation(location: string | null | undefined): boolean {
  if (!location) return false;
  return /returnTo=(%2Flogin(?:%2F)?|\/login\/?)/i.test(location);
}
