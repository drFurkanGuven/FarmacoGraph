import type { FarmacoGraphClient, PaginationParams } from "@/lib/api";
import { buildPaginationParams } from "@/lib/api";
import { searchEvidence as searchEvidenceCatalog } from "@/lib/api/evidence";
import {
  parseDrugEvidenceAttachments,
  parseEvidenceItem,
} from "./evidence-helpers";
import type { CreateEvidenceInput, DrugEvidenceAttachment, EvidenceItem } from "./evidence-types";

function normalizeDrugId(drugKey: string): string {
  return drugKey.includes(":") ? drugKey.split(":").pop()! : drugKey;
}

function normalizeEvidenceId(evidenceId: string): string {
  return evidenceId.includes(":") ? evidenceId.split(":").pop()! : evidenceId;
}

function searchHitToEvidenceItem(hit: {
  entity: {
    id: string;
    label: string;
    evidence_type?: string;
    quality_score?: number;
    year?: number;
    status?: string;
    [key: string]: unknown;
  };
}): EvidenceItem | null {
  return parseEvidenceItem({
    id: hit.entity.id,
    title: hit.entity.label,
    evidence_type: hit.entity.evidence_type ?? "review_article",
    quality_score: hit.entity.quality_score ?? 0.5,
    year: hit.entity.year ?? null,
    status: hit.entity.status ?? null,
  });
}

export async function fetchDrugEvidence(
  client: FarmacoGraphClient,
  drugKey: string,
): Promise<DrugEvidenceAttachment[]> {
  const drugId = normalizeDrugId(drugKey);

  try {
    const envelope = await client.request<unknown[]>(`/drugs/${drugId}/evidence`);
    return parseDrugEvidenceAttachments(envelope.data);
  } catch {
    // OpenAPI list route may not be implemented yet — fall back to evidence filter.
  }

  try {
    const envelope = await client.request<unknown[]>("/evidence", {
      params: { drug_id: drugId, limit: 200 },
    });
    return parseDrugEvidenceAttachments(envelope.data);
  } catch {
    return [];
  }
}

export async function searchEvidence(
  client: FarmacoGraphClient,
  options?: PaginationParams & { q?: string; evidenceType?: string },
): Promise<EvidenceItem[]> {
  const { q, evidenceType, ...pagination } = options ?? {};
  const query = q?.trim() ?? "";

  if (query) {
    try {
      const envelope = await searchEvidenceCatalog(client, query, pagination);
      const fromSearch = envelope.data
        .map((hit) => searchHitToEvidenceItem(hit))
        .filter((entry): entry is EvidenceItem => entry !== null);
      if (fromSearch.length > 0) {
        return fromSearch;
      }
    } catch {
      // Fall through to list endpoint.
    }
  }

  const envelope = await client.request<Record<string, unknown>[]>("/evidence", {
    params: {
      search: query || undefined,
      evidence_type: evidenceType,
      ...buildPaginationParams(pagination),
    },
  });

  return envelope.data
    .map((entry) => parseEvidenceItem(entry))
    .filter((entry): entry is EvidenceItem => entry !== null);
}

export async function createEvidenceRecord(
  client: FarmacoGraphClient,
  body: CreateEvidenceInput,
): Promise<EvidenceItem> {
  const envelope = await client.request<Record<string, unknown>>("/evidence", {
    method: "POST",
    body,
  });

  const parsed = parseEvidenceItem(envelope.data);
  if (!parsed) {
    throw new Error("Evidence API returned an invalid create response.");
  }
  return parsed;
}

export async function attachEvidenceToDrug(
  client: FarmacoGraphClient,
  drugKey: string,
  evidenceId: string,
): Promise<DrugEvidenceAttachment> {
  const drugId = normalizeDrugId(drugKey);
  const normalizedEvidenceId = normalizeEvidenceId(evidenceId);

  try {
    const envelope = await client.request<Record<string, unknown>>(`/drugs/${drugId}/evidence`, {
      method: "POST",
      body: { evidence_id: normalizedEvidenceId },
    });
    const parsed = parseDrugEvidenceAttachments([envelope.data])[0];
    if (parsed) return parsed;
  } catch {
    // Fall back to implemented evidence router path.
  }

  const envelope = await client.request<Record<string, unknown>>(
    `/evidence/${normalizedEvidenceId}/drugs/${drugId}`,
    { method: "POST" },
  );

  const detail = await client.request<Record<string, unknown>>(`/evidence/${normalizedEvidenceId}`);
  const evidence = parseEvidenceItem(detail.data);
  if (!evidence) {
    throw new Error("Evidence API returned an invalid attach response.");
  }

  return {
    evidence_id: evidence.id,
    evidence,
    attached_at: typeof envelope.data.attached_at === "string" ? envelope.data.attached_at : null,
  };
}

export async function detachEvidenceFromDrug(
  client: FarmacoGraphClient,
  drugKey: string,
  evidenceId: string,
): Promise<void> {
  const drugId = normalizeDrugId(drugKey);
  const normalizedEvidenceId = normalizeEvidenceId(evidenceId);

  try {
    await client.request(`/drugs/${drugId}/evidence/${normalizedEvidenceId}`, {
      method: "DELETE",
    });
    return;
  } catch {
    // Fall back to implemented evidence router path.
  }

  await client.request(`/evidence/${normalizedEvidenceId}/drugs/${drugId}`, {
    method: "DELETE",
  });
}
