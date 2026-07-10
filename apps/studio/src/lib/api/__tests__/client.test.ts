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

  it("opens slug workflow via curator drug endpoint", async () => {
    const transport = createMockTransport();
    const client = new FarmacoGraphClient({ baseUrl: "http://api.test/api/v1/" });
    Object.defineProperty(client, "transport", { value: transport });

    await client.openDrugWorkflow("ramipril");

    expect(transport.request).toHaveBeenCalledWith("/curator/drugs/ramipril/workflows", {
      method: "POST",
    });
  });

  it("saves workflow package via canonical PUT endpoint", async () => {
    const transport = createMockTransport();
    const client = new FarmacoGraphClient({ baseUrl: "http://api.test/api/v1/" });
    Object.defineProperty(client, "transport", { value: transport });

    const body = {
      entity_payload: { id: "drug-1", slug: "ramipril" },
      related_entities: [],
      relationships: [],
    };

    await client.saveWorkflowPackage("workflow-1", body);

    expect(transport.request).toHaveBeenCalledWith("/curator/workflows/workflow-1/package", {
      method: "PUT",
      body,
    });
  });

  it("calls graph and mechanism routes with UUID drug identity", async () => {
    const transport = createMockTransport();
    const client = new FarmacoGraphClient({ baseUrl: "http://api.test/api/v1/" });
    Object.defineProperty(client, "transport", { value: transport });

    await client.getDrugGraph("00000000-0000-4000-8000-000000000001", { depth: 3 });
    await client.getDrugMechanism("00000000-0000-4000-8000-000000000001");

    expect(transport.request).toHaveBeenNthCalledWith(
      1,
      "/drugs/00000000-0000-4000-8000-000000000001/graph",
      { params: { depth: 3 }, datasetVersion: undefined },
    );
    expect(transport.request).toHaveBeenNthCalledWith(
      2,
      "/drugs/00000000-0000-4000-8000-000000000001/mechanism",
      { params: {}, datasetVersion: undefined },
    );
  });

  it("calls explain mechanism route with slug drug identity", async () => {
    const transport = createMockTransport();
    const client = new FarmacoGraphClient({ baseUrl: "http://api.test/api/v1/" });
    Object.defineProperty(client, "transport", { value: transport });

    await client.explain({ drug: "ramipril" });

    expect(transport.request).toHaveBeenCalledWith("/explain", {
      params: {
        drug: "ramipril",
        effect: undefined,
        question_type: "mechanism",
      },
    });
  });
});
