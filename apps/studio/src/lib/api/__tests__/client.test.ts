import { describe, expect, it, vi } from "vitest";
import { FarmacoGraphClient } from "../client";

function createMockTransport() {
  return {
    request: vi.fn().mockResolvedValue({ data: [], meta: { api_version: "v1" } }),
    interceptorRegistry: { use: vi.fn(), eject: vi.fn() },
  };
}

describe("FarmacoGraphClient", () => {
  it("calls transport with correct drug list path", async () => {
    const transport = createMockTransport();
    const client = new FarmacoGraphClient({ baseUrl: "http://api.test/api/v1/" });
    Object.defineProperty(client, "transport", { value: transport });

    await client.drugs({ module: "cardiovascular", limit: 25, offset: 0 });

    expect(transport.request).toHaveBeenCalledWith("/drugs", {
      params: { module: "cardiovascular", limit: 25, offset: 0 },
      datasetVersion: undefined,
    });
  });

  it("calls transport for validation summary path", async () => {
    const transport = createMockTransport();
    const client = new FarmacoGraphClient({ baseUrl: "http://api.test/api/v1/" });
    Object.defineProperty(client, "transport", { value: transport });

    await client.validatePackage({
      entity_payload: { id: "stub", entity_type: "Drug" },
      related_entities: [],
      relationships: [],
    });

    expect(transport.request).toHaveBeenCalledWith("/curator/validate", {
      method: "POST",
      body: {
        entity_payload: { id: "stub", entity_type: "Drug" },
        related_entities: [],
        relationships: [],
      },
    });
  });

  it("builds search query params", async () => {
    const transport = createMockTransport();
    const client = new FarmacoGraphClient({ baseUrl: "http://api.test/api/v1/" });
    Object.defineProperty(client, "transport", { value: transport });

    await client.search("stub-query", { limit: 10 });

    expect(transport.request).toHaveBeenCalledWith("/search", {
      params: { q: "stub-query", limit: 10 },
      datasetVersion: undefined,
    });
  });
});
