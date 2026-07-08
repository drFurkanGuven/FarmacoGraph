import { describe, expect, it } from "vitest";
import { isProtectedPath, matchRouteGuard } from "../routes";

describe("matchRouteGuard", () => {
  it("returns null for public settings", () => {
    expect(matchRouteGuard("/settings")).toBeNull();
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
});

describe("isProtectedPath", () => {
  it("marks knowledge paths as protected", () => {
    expect(isProtectedPath("/knowledge/drugs")).toBe(true);
    expect(isProtectedPath("/")).toBe(false);
  });
});
