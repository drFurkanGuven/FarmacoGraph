import { ApiError, type FarmacoGraphClient } from "@/lib/api";
import type { DrugPublishPackage, SaveResult, SaveStrategy } from "./types";

export const AUTOSAVE_DEBOUNCE_MS = 800;
export const VALIDATION_DEBOUNCE_MS = 600;

export interface DebouncedFn<T extends unknown[]> {
  (...args: T): void;
  cancel: () => void;
  flush: () => void;
  pending: () => boolean;
}

export function createDebouncedFn<T extends unknown[]>(
  fn: (...args: T) => void | Promise<void>,
  delayMs: number,
): DebouncedFn<T> {
  let timer: ReturnType<typeof setTimeout> | null = null;
  let lastArgs: T | null = null;

  const debounced = ((...args: T) => {
    lastArgs = args;
    if (timer) clearTimeout(timer);
    timer = setTimeout(() => {
      timer = null;
      const pendingArgs = lastArgs;
      lastArgs = null;
      if (pendingArgs) void fn(...pendingArgs);
    }, delayMs);
  }) as DebouncedFn<T>;

  debounced.cancel = () => {
    if (timer) clearTimeout(timer);
    timer = null;
    lastArgs = null;
  };

  debounced.flush = () => {
    if (!lastArgs) return;
    const pendingArgs = lastArgs;
    debounced.cancel();
    void fn(...pendingArgs);
  };

  debounced.pending = () => timer !== null;

  return debounced;
}

export function isUnsupportedSaveError(error: unknown): boolean {
  if (!(error instanceof ApiError)) return false;
  return error.status === 404 || error.status === 405 || error.status === 501;
}

export async function saveDrugPackage(
  client: FarmacoGraphClient,
  drugId: string,
  workflowId: string | null,
  pkg: DrugPublishPackage,
): Promise<SaveResult> {
  try {
    await client.request<Record<string, unknown>>(`/drugs/${drugId}`, {
      method: "PATCH",
      body: pkg.entity_payload,
    });
    return { strategy: "drug_patch", savedAt: new Date().toISOString() };
  } catch (error) {
    if (!isUnsupportedSaveError(error)) throw error;
  }

  if (!workflowId) {
    throw new ApiError("Curator workflow is required before draft autosave.", 400, {
      message: "No workflow available for curator draft save.",
    });
  }

  await client.saveWorkflowPackage(workflowId, pkg);

  return { strategy: "curator_draft", savedAt: new Date().toISOString() };
}

export async function ensureDraftWorkflow(
  client: FarmacoGraphClient,
  drugId: string,
): Promise<string> {
  const queue = await client.curatorQueue("draft", { limit: 100 });
  const existing = queue.data.find((item) => item.entity_id === drugId);
  if (existing) return existing.id;

  const created = await client.createWorkflow({
    entity_id: drugId,
    entity_type: "Drug",
    notes: "Opened in Studio drug editor",
  });
  return created.data.id;
}

export function mergeDirtySections(current: string[], sectionId: string): string[] {
  if (current.includes(sectionId)) return current;
  return [...current, sectionId];
}

export function clearDirtySection(current: string[], sectionId: string): string[] {
  return current.filter((entry) => entry !== sectionId);
}

export function describeSaveStrategy(strategy: SaveStrategy): string {
  return strategy === "drug_patch" ? "Drug PATCH" : "Curator draft";
}
