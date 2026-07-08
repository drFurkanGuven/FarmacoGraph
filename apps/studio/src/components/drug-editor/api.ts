import type { FarmacoGraphClient, ValidationResult, WorkflowItem } from "@/lib/api";
import { ensureDraftWorkflow } from "./autosave";
import type { DrugPublishPackage } from "./types";
import { drugRecordToPackage } from "./package";

const UUID_RE = /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;

export function isDrugSlug(value: string): boolean {
  return !UUID_RE.test(value);
}

export async function loadDrugRecord(
  client: FarmacoGraphClient,
  drugId: string,
): Promise<Record<string, unknown> | null> {
  if (isDrugSlug(drugId)) return null;
  try {
    const envelope = await client.getDrug(drugId);
    return envelope.data;
  } catch {
    return null;
  }
}

export async function loadCuratorDrugPackage(
  client: FarmacoGraphClient,
  slugOrId: string,
): Promise<{ package: DrugPublishPackage; workflow: WorkflowItem | null }> {
  if (isDrugSlug(slugOrId)) {
    const envelope = await client.openDrugWorkflow(slugOrId);
    return {
      package: envelope.data.package as DrugPublishPackage,
      workflow: envelope.data.workflow,
    };
  }

  const record = await loadDrugRecord(client, slugOrId);
  const pkg = record ? drugRecordToPackage(slugOrId, record) : null;
  const workflow = await findDraftWorkflow(client, slugOrId);
  if (pkg) return { package: pkg, workflow };
  throw new Error(`Drug not found: ${slugOrId}`);
}

export async function findDraftWorkflow(
  client: FarmacoGraphClient,
  drugId: string,
): Promise<WorkflowItem | null> {
  const queue = await client.curatorQueue("draft", { limit: 100 });
  return queue.data.find((item) => item.entity_id === drugId) ?? null;
}

export async function resolveWorkflow(
  client: FarmacoGraphClient,
  drugId: string,
): Promise<WorkflowItem | null> {
  const existing = await findDraftWorkflow(client, drugId);
  if (existing) return existing;

  const workflowId = await ensureDraftWorkflow(client, drugId);
  const envelope = await client.getWorkflow(workflowId);
  return envelope.data;
}

export async function validateDrugPackage(
  client: FarmacoGraphClient,
  pkg: DrugPublishPackage,
): Promise<ValidationResult> {
  const envelope = await client.validatePackage(pkg);
  return envelope.data;
}

export async function loadEntityAuditCount(
  client: FarmacoGraphClient,
  drugId: string,
): Promise<number> {
  const envelope = await client.auditLogs({ resourceType: "Drug", limit: 20 });
  return envelope.data.filter((entry) => entry.resource_id === drugId).length;
}
