import { describe, expect, it, vi, afterEach } from "vitest";
import { resolveStudioApiUrl } from "../base-url";

describe("resolveStudioApiUrl", () => {
  const originalEnv = process.env.NEXT_PUBLIC_API_URL;

  afterEach(() => {
    if (originalEnv === undefined) {
      delete process.env.NEXT_PUBLIC_API_URL;
    } else {
      process.env.NEXT_PUBLIC_API_URL = originalEnv;
    }
    vi.unstubAllGlobals();
  });

  it("uses a non-loopback NEXT_PUBLIC_API_URL when set", () => {
    process.env.NEXT_PUBLIC_API_URL = "https://farmacograph.furkanguven.space/api/v1/";
    expect(resolveStudioApiUrl()).toBe("https://farmacograph.furkanguven.space/api/v1");
  });

  it("falls back to same-origin /api/v1 when build baked loopback URL", () => {
    process.env.NEXT_PUBLIC_API_URL = "http://127.0.0.1:8001/api/v1";
    vi.stubGlobal("window", {
      location: {
        hostname: "farmacograph.furkanguven.space",
        origin: "https://farmacograph.furkanguven.space",
      },
    });
    expect(resolveStudioApiUrl()).toBe("https://farmacograph.furkanguven.space/api/v1");
  });

  it("keeps loopback for local studio hostname", () => {
    process.env.NEXT_PUBLIC_API_URL = "http://127.0.0.1:8001/api/v1";
    vi.stubGlobal("window", {
      location: {
        hostname: "localhost",
        origin: "http://localhost:3000",
      },
    });
    expect(resolveStudioApiUrl()).toBe("http://127.0.0.1:8001/api/v1");
  });
});
