import { describe, expect, it } from "vitest";
import {
  isLoginPath,
  isProtectedPath,
  loginRedirectUrl,
  matchRouteGuard,
  normalizePathname,
} from "../routes";

describe("normalizePathname", () => {
  it("strips trailing slashes used by production trailingSlash config", () => {
    expect(normalizePathname("/login/")).toBe("/login");
    expect(normalizePathname("/settings/")).toBe("/settings");
    expect(normalizePathname("/")).toBe("/");
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
    expect(isProtectedPath("/knowledge/drugs")).toBe(true);
    expect(isProtectedPath("/login")).toBe(false);
    expect(isProtectedPath("/login/")).toBe(false);
  });
});

describe("loginRedirectUrl", () => {
  it("does not set returnTo to login itself", () => {
    expect(loginRedirectUrl("/login/")).toBe("/login?returnTo=%2F");
    expect(isLoginPath("/login/")).toBe(true);
  });
});
