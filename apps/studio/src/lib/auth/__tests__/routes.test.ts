import { describe, expect, it } from "vitest";
import {
  isLoginLoopLocation,
  isLoginPath,
  isProtectedPath,
  loginRedirectUrl,
  matchRouteGuard,
  normalizePathname,
  resolveAuthMiddleware,
  safeReturnTo,
} from "../routes";

describe("normalizePathname", () => {
  it("strips trailing slashes used by production trailingSlash config", () => {
    expect(normalizePathname("/login/")).toBe("/login");
    expect(normalizePathname("/settings/")).toBe("/settings");
    expect(normalizePathname("/")).toBe("/");
  });

  it("strips configured basePath when present", () => {
    const previous = process.env.NEXT_PUBLIC_BASE_PATH;
    process.env.NEXT_PUBLIC_BASE_PATH = "/studio";
    expect(normalizePathname("/studio/login/")).toBe("/login");
    expect(normalizePathname("/studio/")).toBe("/");
    expect(normalizePathname("/studio/settings/")).toBe("/settings");
    expect(normalizePathname("/studio/dashboard/")).toBe("/dashboard");
    if (previous === undefined) delete process.env.NEXT_PUBLIC_BASE_PATH;
    else process.env.NEXT_PUBLIC_BASE_PATH = previous;
  });

  it("strips accidental query/hash from pathname-like input", () => {
    expect(normalizePathname("/login/?returnTo=%2F")).toBe("/login");
  });
});

describe("matchRouteGuard", () => {
  it("returns null for public login with and without trailing slash", () => {
    expect(matchRouteGuard("/login")).toBeNull();
    expect(matchRouteGuard("/login/")).toBeNull();
  });

  it("requires auth for settings (no anonymous panel)", () => {
    const guard = matchRouteGuard("/settings/");
    expect(guard?.requireAuth).toBe(true);
  });

  it("requires auth for dashboard root", () => {
    const guard = matchRouteGuard("/");
    expect(guard?.requireAuth).toBe(true);
    expect(guard?.scopes).toContain("knowledge:read");
  });

  it("returns curator guard for knowledge routes", () => {
    const guard = matchRouteGuard("/knowledge/drugs/");
    expect(guard?.requireAuth).toBe(true);
    expect(guard?.scopes).toContain("curator:write");
  });

  it("returns admin guard for users", () => {
    const guard = matchRouteGuard("/users");
    expect(guard?.roles).toContain("administrator");
  });

  it("defaults unknown routes to requireAuth", () => {
    expect(matchRouteGuard("/future-page/")?.requireAuth).toBe(true);
  });
});

describe("isProtectedPath", () => {
  it("protects studio shell and knowledge paths", () => {
    expect(isProtectedPath("/")).toBe(true);
    expect(isProtectedPath("/settings/")).toBe(true);
    expect(isProtectedPath("/dashboard/")).toBe(true);
    expect(isProtectedPath("/knowledge/drugs")).toBe(true);
    expect(isProtectedPath("/login")).toBe(false);
    expect(isProtectedPath("/login/")).toBe(false);
  });
});

describe("safeReturnTo open-redirect + login rejection", () => {
  it("does not set returnTo to login itself", () => {
    expect(loginRedirectUrl("/login/")).toBe("/login?returnTo=%2F");
    expect(isLoginPath("/login/")).toBe(true);
    expect(safeReturnTo("/login/")).toBe("/");
    expect(safeReturnTo("/login")).toBe("/");
    expect(safeReturnTo("%2Flogin%2F")).toBe("/");
    expect(safeReturnTo(null)).toBe("/");
  });

  it("allows in-app destinations", () => {
    expect(safeReturnTo("/")).toBe("/");
    expect(safeReturnTo("/dashboard/")).toBe("/dashboard");
    expect(safeReturnTo("/knowledge/drugs/ramipril")).toBe("/knowledge/drugs/ramipril");
  });

  it("rejects external and protocol-relative URLs", () => {
    expect(safeReturnTo("https://evil.com")).toBe("/");
    expect(safeReturnTo("//evil.com")).toBe("/");
    expect(safeReturnTo("javascript:alert(1)")).toBe("/");
    expect(safeReturnTo("../escape")).toBe("/");
  });
});

describe("resolveAuthMiddleware (login-loop regression)", () => {
  it("never redirects /login or /login/ (production loop signature)", () => {
    expect(resolveAuthMiddleware("/login/", false)).toEqual({ action: "next" });
    expect(resolveAuthMiddleware("/login", false)).toEqual({ action: "next" });
  });

  it("never emits returnTo=/login for any pathname", () => {
    for (const path of ["/", "/dashboard/", "/settings/", "/knowledge/drugs/", "/login/"]) {
      const decision = resolveAuthMiddleware(path, false);
      if (decision.action === "redirect") {
        expect(decision.returnTo).not.toMatch(/login/i);
        expect(isLoginLoopLocation(`/login/?returnTo=${encodeURIComponent(decision.returnTo ?? "")}`)).toBe(
          false,
        );
      }
    }
  });

  it("redirects unauthenticated protected routes with safe returnTo", () => {
    expect(resolveAuthMiddleware("/", false)).toEqual({
      action: "redirect",
      loginPath: "/login",
      returnTo: "/",
    });
    expect(resolveAuthMiddleware("/settings/", false)).toEqual({
      action: "redirect",
      loginPath: "/login",
      returnTo: "/settings",
    });
    expect(resolveAuthMiddleware("/dashboard/", false)).toEqual({
      action: "redirect",
      loginPath: "/login",
      returnTo: "/dashboard",
    });
  });

  it("allows authenticated traffic through protected routes", () => {
    expect(resolveAuthMiddleware("/", true)).toEqual({ action: "next" });
    expect(resolveAuthMiddleware("/settings/", true)).toEqual({ action: "next" });
  });

  it("treats basePath-prefixed login as public when NEXT_PUBLIC_BASE_PATH is set", () => {
    const previous = process.env.NEXT_PUBLIC_BASE_PATH;
    process.env.NEXT_PUBLIC_BASE_PATH = "/studio";
    expect(resolveAuthMiddleware("/studio/login/", false)).toEqual({ action: "next" });
    expect(resolveAuthMiddleware("/studio/", false)).toEqual({
      action: "redirect",
      loginPath: "/login",
      returnTo: "/",
    });
    expect(resolveAuthMiddleware("/studio/dashboard/", false)).toEqual({
      action: "redirect",
      loginPath: "/login",
      returnTo: "/dashboard",
    });
    if (previous === undefined) delete process.env.NEXT_PUBLIC_BASE_PATH;
    else process.env.NEXT_PUBLIC_BASE_PATH = previous;
  });
});

describe("isLoginLoopLocation", () => {
  it("detects the production failure signature", () => {
    expect(isLoginLoopLocation("/studio/login/?returnTo=%2Flogin%2F")).toBe(true);
    expect(isLoginLoopLocation("/login/?returnTo=/login/")).toBe(true);
    expect(isLoginLoopLocation("/studio/login/?returnTo=%2F")).toBe(false);
  });
});
