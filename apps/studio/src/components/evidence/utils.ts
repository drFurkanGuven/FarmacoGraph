import type { EvidenceRecord, EvidenceSearchHit, OntologyEvidenceType } from "@/lib/api/evidence";
import { ONTOLOGY_EVIDENCE_TYPES } from "@/lib/api/evidence";
import type { EvidenceBrowserFilters, EvidenceBrowserRow, EvidenceSortField, SortDirection } from "./types";

export function searchHitToRow(hit: EvidenceSearchHit): EvidenceBrowserRow {
  const entity = hit.entity;
  const evidenceType =
    (typeof entity.evidence_type === "string" ? entity.evidence_type : null) ??
    (entity.type?.toLowerCase() === "evidence" ? null : entity.type);

  return {
    id: entity.id,
    slug: entity.slug,
    label: entity.label,
    evidenceType,
    year: typeof entity.year === "number" ? entity.year : null,
    qualityScore:
      typeof entity.quality_score === "number"
        ? entity.quality_score
        : typeof entity.confidence_score === "number"
          ? entity.confidence_score
          : null,
    status: entity.status ?? null,
    snippet: hit.snippet ?? null,
    searchScore: typeof hit.score === "number" ? hit.score : null,
    source: "search",
  };
}

export function recordToRow(record: EvidenceRecord): EvidenceBrowserRow {
  return {
    id: record.id,
    slug: record.slug ?? record.id,
    label: record.title ?? record.label ?? record.id,
    evidenceType: record.evidence_type ?? null,
    year: record.year ?? null,
    qualityScore: record.quality_score ?? record.confidence_score ?? null,
    status: record.status ?? null,
    snippet: record.extract ?? null,
    searchScore: null,
    source: "lookup",
  };
}

export function filterEvidenceRows(rows: EvidenceBrowserRow[], filters: EvidenceBrowserFilters): EvidenceBrowserRow[] {
  return rows.filter((row) => {
    if (filters.evidenceType !== "all" && row.evidenceType !== filters.evidenceType) {
      return false;
    }
    if (filters.status !== "all" && row.status !== filters.status) {
      return false;
    }
    if (filters.minQuality !== null && (row.qualityScore ?? 0) < filters.minQuality) {
      return false;
    }
    if (filters.yearFrom !== null && (row.year ?? 0) < filters.yearFrom) {
      return false;
    }
    if (filters.yearTo !== null && (row.year ?? 9999) > filters.yearTo) {
      return false;
    }
    return true;
  });
}

export function sortEvidenceRows(
  rows: EvidenceBrowserRow[],
  field: EvidenceSortField,
  direction: SortDirection,
): EvidenceBrowserRow[] {
  const sorted = [...rows].sort((a, b) => {
    const compareStrings = (left: string | null, right: string | null) =>
      (left ?? "").localeCompare(right ?? "", undefined, { sensitivity: "base" });
    const compareNumbers = (left: number | null, right: number | null) => (left ?? -1) - (right ?? -1);

    switch (field) {
      case "evidenceType":
        return compareStrings(a.evidenceType, b.evidenceType);
      case "year":
        return compareNumbers(a.year, b.year);
      case "qualityScore":
        return compareNumbers(a.qualityScore, b.qualityScore);
      case "score":
        return compareNumbers(a.searchScore, b.searchScore);
      case "label":
      default:
        return compareStrings(a.label, b.label);
    }
  });

  return direction === "desc" ? sorted.reverse() : sorted;
}

export function paginateRows<T>(rows: T[], page: number, pageSize: number): T[] {
  const start = (page - 1) * pageSize;
  return rows.slice(start, start + pageSize);
}

export function totalPages(totalItems: number, pageSize: number): number {
  return Math.max(1, Math.ceil(totalItems / pageSize));
}

export function formatEvidenceTypeLabel(value: string | null): string {
  if (!value) return "Unknown";
  return value
    .split("_")
    .map((part) => part.charAt(0).toUpperCase() + part.slice(1))
    .join(" ");
}

export function qualityToConfidenceLevel(score: number | null): "high" | "medium" | "low" | null {
  if (score === null) return null;
  if (score >= 0.75) return "high";
  if (score >= 0.45) return "medium";
  return "low";
}

export function evidenceFormToPayload(values: {
  evidence_type: string;
  title: string;
  authors: string;
  year: string;
  quality_score: string;
  journal: string;
  extract: string;
  supports_claim: string;
}): EvidenceRecord {
  const authors = values.authors
    .split(",")
    .map((author) => author.trim())
    .filter(Boolean);

  return {
    id: crypto.randomUUID(),
    entity_type: "Evidence",
    evidence_type: values.evidence_type,
    title: values.title.trim(),
    authors,
    year: values.year ? Number(values.year) : null,
    quality_score: values.quality_score ? Number(values.quality_score) : 0.5,
    journal: values.journal.trim() || null,
    extract: values.extract.trim() || null,
    supports_claim: values.supports_claim.trim() || null,
  };
}

export function recordToFormValues(record: EvidenceRecord) {
  const evidenceType = record.evidence_type;
  const normalizedType: OntologyEvidenceType =
    typeof evidenceType === "string" &&
    (ONTOLOGY_EVIDENCE_TYPES as readonly string[]).includes(evidenceType)
      ? (evidenceType as OntologyEvidenceType)
      : "pubmed_article";

  return {
    evidence_type: normalizedType,
    title: record.title ?? record.label ?? "",
    authors: Array.isArray(record.authors) ? record.authors.join(", ") : "",
    year: record.year ? String(record.year) : "",
    quality_score: record.quality_score !== undefined && record.quality_score !== null ? String(record.quality_score) : "0.5",
    journal: record.journal ?? "",
    extract: record.extract ?? "",
    supports_claim: record.supports_claim ?? "",
  };
}
