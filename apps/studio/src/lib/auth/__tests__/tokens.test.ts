import { describe, expect, it } from "vitest";
import { decodeJwtPayload, isTokenExpired, jwtScopes } from "../tokens";

const sampleJwt =
  "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9." +
  "eyJzdWIiOiJjdXJhdG9yLTEiLCJzY29wZXMiOlsiY3VyYXRvcjp3cml0ZSIsImtub3dsZWRnZTpyZWFkIl0sImV4cCI6OTk5OTk5OTk5OX0." +
  "signature";

describe("decodeJwtPayload", () => {
  it("decodes payload without verifying signature", () => {
    const payload = decodeJwtPayload(sampleJwt);
    expect(payload?.sub).toBe("curator-1");
    expect(payload?.scopes).toContain("curator:write");
  });

  it("returns null for malformed tokens", () => {
    expect(decodeJwtPayload("not-a-jwt")).toBeNull();
  });
});

describe("jwtScopes", () => {
  it("normalizes scopes from JWT", () => {
    expect(jwtScopes(sampleJwt)).toEqual(["curator:write", "knowledge:read"]);
  });
});

describe("isTokenExpired", () => {
  it("detects expired tokens with skew", () => {
    expect(isTokenExpired(Date.now() - 1000)).toBe(true);
    expect(isTokenExpired(Date.now() + 120_000)).toBe(false);
  });

  it("treats missing expiry as not expired", () => {
    expect(isTokenExpired(null)).toBe(false);
  });
});
