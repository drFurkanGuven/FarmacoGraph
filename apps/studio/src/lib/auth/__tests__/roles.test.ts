import { describe, expect, it } from "vitest";
import { hasPermission, hasRole, rolesFromScopes, scopesFromRoles } from "../roles";

describe("rolesFromScopes", () => {
  it("maps admin scope to administrator role", () => {
    expect(rolesFromScopes(["admin:org"])).toContain("administrator");
  });

  it("maps curator scopes to curator role", () => {
    expect(rolesFromScopes(["curator:write"])).toContain("curator");
  });
});

describe("scopesFromRoles", () => {
  it("merges curator scopes", () => {
    const scopes = scopesFromRoles(["curator"]);
    expect(scopes).toContain("curator:write");
    expect(scopes).toContain("knowledge:read");
  });
});

describe("hasRole", () => {
  it("accepts any matching role", () => {
    expect(hasRole(["viewer", "curator"], ["curator", "administrator"])).toBe(true);
    expect(hasRole(["viewer"], "administrator")).toBe(false);
  });
});

describe("hasPermission", () => {
  it("grants all permissions when admin:org is present", () => {
    expect(hasPermission(["admin:org"], "curator:publish")).toBe(true);
  });

  it("checks individual scopes", () => {
    expect(hasPermission(["curator:write"], "curator:write")).toBe(true);
    expect(hasPermission(["knowledge:read"], "curator:write")).toBe(false);
  });
});
