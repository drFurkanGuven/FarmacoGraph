import type { FarmacoGraphClient } from "./client";
import { buildPaginationParams } from "./pagination";
import type { PaginatedEnvelope, PaginationParams } from "./types";

/** Ontology `EvidenceType` values from `farmacograph.models.enums`. */
export const ONTOLOGY_EVIDENCE_TYPES = [
  "pubmed_article",
  "fda_label",
  "ema_smpc",
  "who_guideline",
  "nice_guideline",
  "rct",
  "meta_analysis",
  "systematic_review",
  "review_article",
  "clinical_guideline",
  "expert_consensus",
  "textbook",
] as const;

export type OntologyEvidenceType = (typeof ONTOLOGY_EVIDENCE_TYPES)[number];

export interface EvidenceRecord {
  id: string;
  entity_type?: string;
  evidence_type?: OntologyEvidenceType | string;
  title?: string;
  label?: string;
  authors?: string[];
  year?: number | null;
  quality_score?: number | null;
  extract?: string | null;
  supports_claim?: string | null;
  journal?: string | null;
  status?: string;
  slug?: string;
  confidence_score?: number | null;
  [key: string]: unknown;
}

export interface EvidenceSearchHit {
  entity: {
    id: string;
    type: string;
    slug: string;
    label: string;
    status?: string;
    confidence_score?: number;
    evidence_type?: string;
    year?: number;
    quality_score?: number;
    [key: string]: unknown;
  };
  score?: number;
  snippet?: string;
}

export interface EvidenceSearchOptions extends PaginationParams {
  datasetVersion?: string | null;
}

export function searchEvidence(
  client: FarmacoGraphClient,
  query: string,
  options?: EvidenceSearchOptions,
) {
  const { datasetVersion, ...pagination } = options ?? {};
  return client.request<EvidenceSearchHit[]>("/search", {
    params: {
      q: query,
      types: "evidence",
      ...buildPaginationParams(pagination),
    },
    datasetVersion,
  });
}

export function getEvidence(client: FarmacoGraphClient, evidenceId: string) {
  const normalizedId = evidenceId.includes(":") ? evidenceId.split(":").pop()! : evidenceId;
  return client.request<EvidenceRecord>(`/evidence/${normalizedId}`);
}

export interface CreateEvidenceBody {
  title: string;
  evidence_type: string;
  quality_score?: number;
  year?: number | null;
  authors?: string[];
  journal?: string | null;
  extract?: string | null;
  supports_claim?: string | null;
  slug?: string | null;
  dataset_version?: string | null;
}

export interface UpdateEvidenceBody {
  title?: string;
  evidence_type?: string;
  quality_score?: number;
  year?: number | null;
  authors?: string[];
  journal?: string | null;
  extract?: string | null;
  supports_claim?: string | null;
  slug?: string | null;
  dataset_version?: string | null;
}

export function createEvidence(client: FarmacoGraphClient, body: CreateEvidenceBody) {
  return client.request<EvidenceRecord>("/evidence", {
    method: "POST",
    body,
  });
}

export function updateEvidence(
  client: FarmacoGraphClient,
  evidenceId: string,
  body: UpdateEvidenceBody,
) {
  const normalizedId = evidenceId.includes(":") ? evidenceId.split(":").pop()! : evidenceId;
  return client.request<EvidenceRecord>(`/evidence/${normalizedId}`, {
    method: "PATCH",
    body,
  });
}

export function isEvidenceIdQuery(query: string): boolean {
  const trimmed = query.trim();
  if (!trimmed) return false;
  if (/^evidence:[0-9a-f-]{36}$/i.test(trimmed)) return true;
  return /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(trimmed);
}

export function normalizeEvidenceId(query: string): string {
  const trimmed = query.trim();
  if (trimmed.startsWith("evidence:")) {
    return trimmed.slice("evidence:".length);
  }
  return trimmed;
}

export type EvidenceListEnvelope = PaginatedEnvelope<EvidenceSearchHit>;
