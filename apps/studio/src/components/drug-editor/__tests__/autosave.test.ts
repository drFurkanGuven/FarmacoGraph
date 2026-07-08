import { describe, expect, it, vi } from "vitest";
import {
  AUTOSAVE_DEBOUNCE_MS,
  createDebouncedFn,
  isUnsupportedSaveError,
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
  it("uses drug PATCH when available", async () => {
    const request = vi
      .fn()
      .mockResolvedValueOnce({ data: { ok: true }, meta: {} })
      .mockRejectedValue(new Error("should not reach draft save"));

    const client = { request } as never;
    const pkg = {
      entity_payload: { id: "drug-1", slug: "ramipril" },
      related_entities: [],
      relationships: [],
    };

    const result = await saveDrugPackage(client, "drug-1", null, pkg);

    expect(result.strategy).toBe("drug_patch");
    expect(request).toHaveBeenCalledWith("/drugs/drug-1", {
      method: "PATCH",
      body: pkg.entity_payload,
    });
  });

  it("falls back to curator draft save when PATCH is unsupported", async () => {
    const request = vi.fn().mockRejectedValueOnce(new ApiError("Not found", 404, null));
    const saveWorkflowPackage = vi.fn().mockResolvedValueOnce({
      data: { workflow: { id: "workflow-1" }, validation: { valid: true } },
      meta: {},
    });

    const client = { request, saveWorkflowPackage } as never;
    const pkg = {
      entity_payload: { id: "drug-1", slug: "ramipril" },
      related_entities: [],
      relationships: [],
    };

    const result = await saveDrugPackage(client, "drug-1", "workflow-1", pkg);

    expect(result.strategy).toBe("curator_draft");
    expect(saveWorkflowPackage).toHaveBeenCalledWith("workflow-1", pkg);
  });

  it("requires a workflow id for curator draft fallback", async () => {
    const request = vi.fn().mockRejectedValue(new ApiError("Not found", 404, null));
    const client = { request } as never;

    await expect(
      saveDrugPackage(
        client,
        "drug-1",
        null,
        { entity_payload: { id: "drug-1" }, related_entities: [], relationships: [] },
      ),
    ).rejects.toBeInstanceOf(ApiError);
  });
});

describe("mergeDirtySections", () => {
  it("tracks unique dirty section ids", () => {
    expect(mergeDirtySections([], "identity")).toEqual(["identity"]);
    expect(mergeDirtySections(["identity"], "identity")).toEqual(["identity"]);
    expect(mergeDirtySections(["identity"], "provenance")).toEqual(["identity", "provenance"]);
  });
});

describe("isUnsupportedSaveError", () => {
  it("detects missing or unsupported save endpoints", () => {
    expect(isUnsupportedSaveError(new ApiError("missing", 404, null))).toBe(true);
    expect(isUnsupportedSaveError(new ApiError("method", 405, null))).toBe(true);
    expect(isUnsupportedSaveError(new ApiError("server", 500, null))).toBe(false);
  });
});

describe("autosave constants", () => {
  it("uses a sub-second debounce window", () => {
    expect(AUTOSAVE_DEBOUNCE_MS).toBeGreaterThan(0);
    expect(AUTOSAVE_DEBOUNCE_MS).toBeLessThan(2000);
  });
});
