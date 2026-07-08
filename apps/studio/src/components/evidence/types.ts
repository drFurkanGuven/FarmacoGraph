import type { OntologyEvidenceType } from "@/lib/api/evidence";

export type EvidenceSortField = "label" | "evidenceType" | "year" | "qualityScore" | "score";
export type SortDirection = "asc" | "desc";

export interface EvidenceBrowserFilters {
  query: string;
  evidenceType: "all" | OntologyEvidenceType;
  minQuality: number | null;
  yearFrom: number | null;
  yearTo: number | null;
  status: "all" | "published" | "draft" | "review" | "approved" | "deprecated";
}

export const DEFAULT_EVIDENCE_BROWSER_FILTERS: EvidenceBrowserFilters = {
  query: "",
  evidenceType: "all",
  minQuality: null,
  yearFrom: null,
  yearTo: null,
  status: "all",
};

export const DEFAULT_PAGE_SIZE = 25;

export interface EvidenceBrowserRow {
  id: string;
  slug: string;
  label: string;
  evidenceType: string | null;
  year: number | null;
  qualityScore: number | null;
  status: string | null;
  snippet: string | null;
  searchScore: number | null;
  source: "search" | "lookup";
}

export type EvidenceFormMode = "create" | "edit";

export interface EvidenceFormValues {
  evidence_type: OntologyEvidenceType;
  title: string;
  authors: string;
  year: string;
  quality_score: string;
  journal: string;
  extract: string;
  supports_claim: string;
}

export const DEFAULT_EVIDENCE_FORM_VALUES: EvidenceFormValues = {
  evidence_type: "pubmed_article",
  title: "",
  authors: "",
  year: "",
  quality_score: "0.5",
  journal: "",
  extract: "",
  supports_claim: "",
};
