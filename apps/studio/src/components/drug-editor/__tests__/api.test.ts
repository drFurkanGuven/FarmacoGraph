import { describe, expect, it, vi } from "vitest";
import { ApiError } from "@/lib/api";
import { formatDrugEditorLoadError, isDrugSlug } from "../api";

describe("isDrugSlug", () => {
  it("treats curriculum slugs as slugs and UUIDs as ids", () => {
    expect(isDrugSlug("ramipril")).toBe(true);
    expect(isDrugSlug("00000000-0000-4000-8000-000000000001")).toBe(false);
  });
});

describe("formatDrugEditorLoadError", () => {
  it("maps 404 slug errors to actionable copy", () => {
    const message = formatDrugEditorLoadError(new ApiError("Not found", 404, null), "ramipril");
    expect(message).toContain("ramipril");
    expect(message).toContain("drug browser");
  });

  it("maps permission errors", () => {
    const message = formatDrugEditorLoadError(new ApiError("Forbidden", 403, null), "ramipril");
    expect(message).toContain("permission");
  });

  it("maps generic drug-not-found errors for slugs", () => {
    const message = formatDrugEditorLoadError(new Error("Drug not found: ramipril"), "ramipril");
    expect(message).toContain("curriculum queue");
  });
});

describe("ensureDraftWorkflow uuid path", () => {
  it("reuses an existing draft workflow by entity id", async () => {
    const { ensureDraftWorkflow } = await import("../autosave");
    const entityId = "00000000-0000-4000-8000-000000000099";
    const curatorQueue = vi.fn().mockResolvedValueOnce({
      data: [{ id: "workflow-uuid", entity_id: entityId }],
      meta: {},
    });
    const client = { curatorQueue } as never;

    const workflowId = await ensureDraftWorkflow(client, entityId);

    expect(workflowId).toBe("workflow-uuid");
    expect(curatorQueue).toHaveBeenCalledWith("draft", { limit: 100 });
  });
});
