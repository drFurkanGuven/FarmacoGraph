import { describe, expect, it, vi } from "vitest";
import { FarmacoGraphClient } from "../client";
import { ApiError } from "../errors";

function createMockTransport() {
  return {
    request: vi.fn().mockResolvedValue({
      data: { id: "wf-1", state: "review" },
      meta: { api_version: "v1" },
    }),
    interceptorRegistry: { use: vi.fn(), eject: vi.fn() },
  };
}

const publishPackage = {
  entity_payload: { id: "drug-1", slug: "ramipril", entity_type: "Drug" },
  related_entities: [],
  relationships: [],
};

describe("FarmacoGraphClient publish workflow mutations", () => {
  it("calls submit workflow endpoint", async () => {
    const transport = createMockTransport();
    const client = new FarmacoGraphClient({ baseUrl: "http://api.test/api/v1/" });
    Object.defineProperty(client, "transport", { value: transport });

    await client.submitWorkflow("workflow-1");

    expect(transport.request).toHaveBeenCalledWith("/curator/workflows/workflow-1/submit", {
      method: "POST",
    });
  });

  it("calls approve workflow endpoint", async () => {
    const transport = createMockTransport();
    const client = new FarmacoGraphClient({ baseUrl: "http://api.test/api/v1/" });
    Object.defineProperty(client, "transport", { value: transport });

    await client.approveWorkflow("workflow-1");

    expect(transport.request).toHaveBeenCalledWith("/curator/workflows/workflow-1/approve", {
      method: "POST",
    });
  });

  it("calls return workflow to draft endpoint", async () => {
    const transport = createMockTransport();
    const client = new FarmacoGraphClient({ baseUrl: "http://api.test/api/v1/" });
    Object.defineProperty(client, "transport", { value: transport });

    await client.returnWorkflowToDraft("workflow-1");

    expect(transport.request).toHaveBeenCalledWith("/curator/workflows/workflow-1/return-to-draft", {
      method: "POST",
    });
  });

  it("calls publish workflow endpoint with package body", async () => {
    const transport = createMockTransport();
    transport.request.mockResolvedValueOnce({
      data: {
        workflow: { id: "workflow-1", state: "published" },
        published_slug: "ramipril",
        graph_write: { available: false, status: "skipped" },
        validation_summary: { valid: true, publish_ready: true },
      },
      meta: { api_version: "v1" },
    });
    const client = new FarmacoGraphClient({ baseUrl: "http://api.test/api/v1/" });
    Object.defineProperty(client, "transport", { value: transport });

    const envelope = await client.publishWorkflow("workflow-1", publishPackage);

    expect(transport.request).toHaveBeenCalledWith("/curator/workflows/workflow-1/publish", {
      method: "POST",
      body: publishPackage,
    });
    expect(envelope.data.workflow.state).toBe("published");
    expect(envelope.data.published_slug).toBe("ramipril");
  });

  it("calls workflow timeline endpoint", async () => {
    const transport = createMockTransport();
    const client = new FarmacoGraphClient({ baseUrl: "http://api.test/api/v1/" });
    Object.defineProperty(client, "transport", { value: transport });

    await client.getWorkflowTimeline("workflow-1", { limit: 10 });

    expect(transport.request).toHaveBeenCalledWith("/curator/workflows/workflow-1/timeline", {
      params: { limit: 10, offset: undefined },
    });
  });

  it("calls drug workflow state endpoint", async () => {
    const transport = createMockTransport();
    const client = new FarmacoGraphClient({ baseUrl: "http://api.test/api/v1/" });
    Object.defineProperty(client, "transport", { value: transport });

    await client.getDrugWorkflowState("ramipril");

    expect(transport.request).toHaveBeenCalledWith("/curator/drugs/ramipril/workflow-state", {});
  });

  it("surfaces ApiError from failed publish mutation", async () => {
    const transport = createMockTransport();
    transport.request.mockRejectedValueOnce(
      new ApiError("Cannot publish from state: draft", 400, { message: "Cannot publish from state: draft" }),
    );
    const client = new FarmacoGraphClient({ baseUrl: "http://api.test/api/v1/" });
    Object.defineProperty(client, "transport", { value: transport });

    await expect(client.publishWorkflow("workflow-1", publishPackage)).rejects.toMatchObject({
      status: 400,
      message: "Cannot publish from state: draft",
    });
  });
});
