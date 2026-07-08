import { ApiError, type FarmacoGraphClient, type ValidationResult } from "@/lib/api";
import { isDrugSlug } from "./api";
import type { DrugPublishPackage, SaveResult } from "./types";

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

/** Persist draft package via canonical curator workflow API. */
export async function saveDrugPackage(
  client: FarmacoGraphClient,
  workflowId: string | null,
  pkg: DrugPublishPackage,
): Promise<SaveResult> {
  if (!workflowId) {
    throw new ApiError("Curator workflow is required before draft autosave.", 400, {
      message: "No workflow available for curator draft save.",
    });
  }

  const envelope = await client.saveWorkflowPackage(workflowId, pkg);

  return {
    strategy: "curator_package",
    savedAt: new Date().toISOString(),
    validation: envelope.data.validation as ValidationResult | undefined,
  };
}

/** Open or create a draft workflow for the drug editor. */
export async function ensureDraftWorkflow(
  client: FarmacoGraphClient,
  drugIdOrSlug: string,
): Promise<string> {
  if (isDrugSlug(drugIdOrSlug)) {
    const envelope = await client.openDrugWorkflow(drugIdOrSlug);
    return envelope.data.workflow.id;
  }

  const queue = await client.curatorQueue("draft", { limit: 100 });
  const existing = queue.data.find((item) => item.entity_id === drugIdOrSlug);
  if (existing) return existing.id;

  const created = await client.createWorkflow({
    entity_id: drugIdOrSlug,
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

export function describeSaveStrategy(strategy: "curator_package"): string {
  return "Curator package";
}
