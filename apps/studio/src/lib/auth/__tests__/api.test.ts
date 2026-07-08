import { afterEach, describe, expect, it, vi } from "vitest";
import { authApi } from "../api";

describe("authApi.introspect", () => {
  afterEach(() => {
    vi.restoreAllMocks();
  });

  it("sends Bearer JWT for access token introspection", async () => {
    const fetchMock = vi.spyOn(globalThis, "fetch").mockResolvedValue(
      new Response(
        JSON.stringify({
          active: true,
          scopes: ["curator:write"],
          roles: ["curator"],
          user_id: "user-1",
          token_type: "bearer",
          auth_method: "jwt",
          expires_at: 1_700_000_000,
        }),
        { status: 200, headers: { "Content-Type": "application/json" } },
      ),
    );

    const result = await authApi.introspect({ accessToken: "jwt-token" });

    expect(result.auth_method).toBe("jwt");
    expect(fetchMock).toHaveBeenCalledOnce();
    const [, init] = fetchMock.mock.calls[0] as [string, RequestInit];
    expect(init.headers).toMatchObject({ Authorization: "Bearer jwt-token" });
    expect(JSON.parse(String(init.body))).toEqual({ access_token: "jwt-token" });
  });

  it("sends API key via body and headers", async () => {
    const fetchMock = vi.spyOn(globalThis, "fetch").mockResolvedValue(
      new Response(
        JSON.stringify({
          active: true,
          scopes: ["knowledge:read"],
          roles: [],
          token_type: "api_key",
          auth_method: "api_key",
        }),
        { status: 200, headers: { "Content-Type": "application/json" } },
      ),
    );

    await authApi.introspectApiKey("fg_abcdefgh_secret");

    const [, init] = fetchMock.mock.calls[0] as [string, RequestInit];
    expect(init.headers).toMatchObject({
      Authorization: "Bearer fg_abcdefgh_secret",
      "X-API-Key": "fg_abcdefgh_secret",
    });
    expect(JSON.parse(String(init.body))).toEqual({ api_key: "fg_abcdefgh_secret" });
  });
});
