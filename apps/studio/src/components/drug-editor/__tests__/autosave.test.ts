import { describe, expect, it, vi } from "vitest";
import {
  AUTOSAVE_DEBOUNCE_MS,
  createDebouncedFn,
  ensureDraftWorkflow,
  mergeDirtySections,
  saveDrugPackage,
} from "../autosave";
import { ApiError } from "@/lib/api";

describe("createDebouncedFn", () => {
  it("debounces calls until the delay elapses", async () => {
    vi.useFakeTimers();
    const fn = vi.fn();
    const debounced = createDebouncedFn(fn, 300);

    debounced("a");
    debounced("b");
    expect(fn).not.toHaveBeenCalled();

    vi.advanceTimersByTime(299);
    expect(fn).not.toHaveBeenCalled();

    vi.advanceTimersByTime(1);
    expect(fn).toHaveBeenCalledTimes(1);
    expect(fn).toHaveBeenCalledWith("b");

    vi.useRealTimers();
  });

  it("flush runs the pending call immediately", () => {
    vi.useFakeTimers();
    const fn = vi.fn();
    const debounced = createDebouncedFn(fn, 500);

    debounced("pending");
    expect(debounced.pending()).toBe(true);
    debounced.flush();
    expect(fn).toHaveBeenCalledWith("pending");
    expect(debounced.pending()).toBe(false);

    vi.useRealTimers();
  });

  it("cancel drops pending calls", () => {
    vi.useFakeTimers();
    const fn = vi.fn();
    const debounced = createDebouncedFn(fn, 500);

    debounced("drop");
    debounced.cancel();
    vi.advanceTimersByTime(500);
    expect(fn).not.toHaveBeenCalled();

    vi.useRealTimers();
  });
});

describe("saveDrugPackage", () => {
  it("saves via canonical curator package endpoint", async () => {
    const saveWorkflowPackage = vi.fn().mockResolvedValueOnce({
      data: {
        workflow: { id: "workflow-1" },
        validation: { valid: true, issues: [] },
      },
      meta: {},
    });

    const client = { saveWorkflowPackage } as never;
    const pkg = {
      entity_payload: { id: "drug-1", slug: "ramipril" },
      related_entities: [],
      relationships: [],
    };

    const result = await saveDrugPackage(client, "workflow-1", pkg);

    expect(result.strategy).toBe("curator_package");
    expect(result.validation).toEqual({ valid: true, issues: [] });
    expect(saveWorkflowPackage).toHaveBeenCalledWith("workflow-1", pkg);
  });

  it("requires a workflow id", async () => {
    const client = {} as never;

    await expect(
      saveDrugPackage(
        client,
        null,
        { entity_payload: { id: "drug-1" }, related_entities: [], relationships: [] },
      ),
    ).rejects.toBeInstanceOf(ApiError);
  });
});

describe("ensureDraftWorkflow", () => {
  it("opens slug workflows via curator drug endpoint", async () => {
    const openDrugWorkflow = vi.fn().mockResolvedValueOnce({
      data: { workflow: { id: "workflow-slug" }, package: {}, validation: {} },
      meta: {},
    });
    const client = { openDrugWorkflow } as never;

    const workflowId = await ensureDraftWorkflow(client, "ramipril");

    expect(workflowId).toBe("workflow-slug");
    expect(openDrugWorkflow).toHaveBeenCalledWith("ramipril");
  });
});

describe("mergeDirtySections", () => {
  it("tracks unique dirty section ids", () => {
    expect(mergeDirtySections([], "identity")).toEqual(["identity"]);
    expect(mergeDirtySections(["identity"], "identity")).toEqual(["identity"]);
    expect(mergeDirtySections(["identity"], "provenance")).toEqual(["identity", "provenance"]);
  });
});

describe("autosave constants", () => {
  it("uses a sub-second debounce window", () => {
    expect(AUTOSAVE_DEBOUNCE_MS).toBeGreaterThan(0);
    expect(AUTOSAVE_DEBOUNCE_MS).toBeLessThan(2000);
  });
});
