import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { createTransport } from "../transport";

describe("ApiTransport", () => {
  const originalFetch = globalThis.fetch;

  beforeEach(() => {
    vi.restoreAllMocks();
  });

  afterEach(() => {
    globalThis.fetch = originalFetch;
  });

  it("calls runError exactly once on HTTP error response", async () => {
    globalThis.fetch = vi.fn().mockResolvedValue({
      ok: false,
      status: 404,
      headers: new Headers(),
      text: vi.fn().mockResolvedValue(JSON.stringify({ detail: "Not found" })),
    });

    const errorInterceptor = vi.fn();
    const transport = createTransport({
      baseUrl: "https://api.farmacograph.test",
      defaultRetries: 0,
    });
    transport.interceptorRegistry.useError(errorInterceptor);

    await expect(transport.request("/non-existent")).rejects.toThrow("Not found");
    expect(errorInterceptor).toHaveBeenCalledTimes(1);
  });

  it("does not retry POST mutations by default", async () => {
    const fetchMock = vi.fn().mockResolvedValue({
      ok: false,
      status: 500,
      headers: new Headers(),
      text: vi.fn().mockResolvedValue(JSON.stringify({ detail: "Internal error" })),
    });
    globalThis.fetch = fetchMock;

    const transport = createTransport({
      baseUrl: "https://api.farmacograph.test",
      defaultRetries: 2,
    });

    await expect(
      transport.request("/drugs", {
        method: "POST",
        body: { name: "test" },
      })
    ).rejects.toThrow("Internal error");

    expect(fetchMock).toHaveBeenCalledTimes(1);
  });

  it("retries GET requests up to defaultRetries on 5xx", async () => {
    const fetchMock = vi
      .fn()
      .mockResolvedValueOnce({
        ok: false,
        status: 503,
        headers: new Headers(),
        text: vi.fn().mockResolvedValue(JSON.stringify({ detail: "Unavailable" })),
      })
      .mockResolvedValueOnce({
        ok: true,
        status: 200,
        headers: new Headers(),
        text: vi.fn().mockResolvedValue(JSON.stringify({ data: { status: "ok" } })),
      });
    globalThis.fetch = fetchMock;

    const transport = createTransport({
      baseUrl: "https://api.farmacograph.test",
      defaultRetries: 2,
    });

    const res = await transport.request<{ status: string }>("/health");
    expect(res.data).toEqual({ status: "ok" });
    expect(fetchMock).toHaveBeenCalledTimes(2);
  });
});
