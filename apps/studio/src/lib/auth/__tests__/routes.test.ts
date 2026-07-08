import { describe, expect, it } from "vitest";
import { isProtectedPath, matchRouteGuard } from "../routes";

describe("matchRouteGuard", () => {
  it("returns null for public login", () => {
    expect(matchRouteGuard("/login")).toBeNull();
  });

  it("requires auth for settings (no anonymous panel)", () => {
    const guard = matchRouteGuard("/settings");
    expect(guard?.requireAuth).toBe(true);
  });

  it("requires auth for dashboard root", () => {
    const guard = matchRouteGuard("/");
    expect(guard?.requireAuth).toBe(true);
    expect(guard?.scopes).toContain("knowledge:read");
  });

  it("returns curator guard for knowledge routes", () => {
    const guard = matchRouteGuard("/knowledge/drugs");
    expect(guard?.requireAuth).toBe(true);
    expect(guard?.scopes).toContain("curator:write");
  });

  it("returns admin guard for users", () => {
    const guard = matchRouteGuard("/users");
    expect(guard?.roles).toContain("administrator");
  });

  it("defaults unknown routes to requireAuth", () => {
    expect(matchRouteGuard("/future-page")?.requireAuth).toBe(true);
  });
});

describe("isProtectedPath", () => {
  it("protects studio shell and knowledge paths", () => {
    expect(isProtectedPath("/")).toBe(true);
    expect(isProtectedPath("/settings")).toBe(true);
    expect(isProtectedPath("/knowledge/drugs")).toBe(true);
    expect(isProtectedPath("/login")).toBe(false);
  });
});
