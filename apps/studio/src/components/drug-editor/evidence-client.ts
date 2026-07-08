import type { FarmacoGraphClient, PaginationParams } from "@/lib/api";
import { buildPaginationParams } from "@/lib/api";
import { searchEvidence as searchEvidenceCatalog } from "@/lib/api/evidence";
import {
  parseDrugEvidenceAttachments,
  parseEvidenceItem,
} from "./evidence-helpers";
import type { CreateEvidenceInput, DrugEvidenceAttachment, EvidenceItem } from "./evidence-types";

const UUID_RE = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

export interface DrugEvidenceRouteContext {
  drugId?: string | null;
  entityId?: string | null;
  slug?: string | null;
}

function normalizeEvidenceId(evidenceId: string): string {
  return evidenceId.includes(":") ? evidenceId.split(":").pop()! : evidenceId;
}

function normalizeOptionalId(value: string | null | undefined): string | null {
  if (!value) return null;
  const normalized = value.includes(":") ? value.split(":").pop()! : value;
  return normalized.trim() || null;
}

function isUuid(value: string | null | undefined): value is string {
  return Boolean(value && UUID_RE.test(value));
}

function resolveDrugEvidenceRoute(context: DrugEvidenceRouteContext): string {
  const slug = context.slug?.trim();
  if (slug) {
    return `/curator/drugs/${encodeURIComponent(slug)}/evidence`;
  }

  const entityId = normalizeOptionalId(context.entityId);
  if (isUuid(entityId)) {
    return `/drugs/${entityId}/evidence`;
  }

  const drugId = normalizeOptionalId(context.drugId);
  if (isUuid(drugId)) {
    return `/drugs/${drugId}/evidence`;
  }

  throw new Error("Cannot resolve drug identity for evidence. Missing slug or UUID.");
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
  context: DrugEvidenceRouteContext,
): Promise<DrugEvidenceAttachment[]> {
  const route = resolveDrugEvidenceRoute(context);
  const envelope = await client.request<unknown[]>(route);
  return parseDrugEvidenceAttachments(envelope.data);
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
  context: DrugEvidenceRouteContext,
  evidenceId: string,
): Promise<DrugEvidenceAttachment> {
  const route = resolveDrugEvidenceRoute(context);
  const normalizedEvidenceId = normalizeEvidenceId(evidenceId);
  const envelope = await client.request<Record<string, unknown>>(route, {
    method: "POST",
    body: { evidence_id: normalizedEvidenceId },
  });
  const parsed = parseDrugEvidenceAttachments([envelope.data])[0];
  if (parsed) return parsed;

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
  context: DrugEvidenceRouteContext,
  evidenceId: string,
): Promise<void> {
  const route = resolveDrugEvidenceRoute(context);
  const normalizedEvidenceId = normalizeEvidenceId(evidenceId);

  await client.request(`${route}/${normalizedEvidenceId}`, {
    method: "DELETE",
  });
}
