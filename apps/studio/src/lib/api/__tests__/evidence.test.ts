import { describe, expect, it, vi } from "vitest";
import { FarmacoGraphClient } from "../client";
import { getEvidence, isEvidenceIdQuery, normalizeEvidenceId, searchEvidence } from "../evidence";

function createMockTransport() {
  return {
    request: vi.fn().mockResolvedValue({ data: [], meta: { api_version: "v1" } }),
    interceptorRegistry: { use: vi.fn(), eject: vi.fn() },
  };
}

describe("evidence API helpers", () => {
  it("detects evidence UUID queries", () => {
    expect(isEvidenceIdQuery("evidence:8f3c2a1b-4d5e-6f7a-8b9c-0d1e2f3a4b5c")).toBe(true);
    expect(isEvidenceIdQuery("8f3c2a1b-4d5e-6f7a-8b9c-0d1e2f3a4b5c")).toBe(true);
    expect(isEvidenceIdQuery("ramipril")).toBe(false);
  });

  it("normalizes prefixed evidence ids", () => {
    expect(normalizeEvidenceId("evidence:abc")).toBe("abc");
    expect(normalizeEvidenceId("abc")).toBe("abc");
  });

  it("calls search with evidence type filter", async () => {
    const transport = createMockTransport();
    const client = new FarmacoGraphClient({ baseUrl: "http://api.test/api/v1/" });
    Object.defineProperty(client, "transport", { value: transport });

    await searchEvidence(client, "ace inhibitor", { limit: 25, offset: 0 });

    expect(transport.request).toHaveBeenCalledWith("/search", {
      params: { q: "ace inhibitor", types: "evidence", limit: 25, offset: 0 },
      datasetVersion: undefined,
    });
  });

  it("calls evidence detail path", async () => {
    const transport = createMockTransport();
    const client = new FarmacoGraphClient({ baseUrl: "http://api.test/api/v1/" });
    Object.defineProperty(client, "transport", { value: transport });

    await getEvidence(client, "evidence:8f3c2a1b-4d5e-6f7a-8b9c-0d1e2f3a4b5c");

    expect(transport.request).toHaveBeenCalledWith("/evidence/8f3c2a1b-4d5e-6f7a-8b9c-0d1e2f3a4b5c", {});
  });
});
