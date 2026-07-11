import type { ConfidenceLevel } from "@/components/ui/confidence-badge";
import type { ValidationStatus } from "@/components/ui/validation-badge";

/** API drug summary with optional fields returned by EntitySummary. */
export interface ApiDrugSummary {
  id: string;
  slug: string;
  label: string;
  generic_name?: string;
  module?: string;
  status?: string;
  confidence_score?: number | null;
  type?: string;
  validation_valid?: boolean;
  validation_errors?: number;
}

export type DrugSource = "graph" | "curriculum";

export type DrugStatusFilter = "all" | "published" | "pending" | "draft" | "review";

export type DrugValidationFilter = "all" | ValidationStatus;

export type SortField = "label" | "slug" | "module" | "status" | "confidence";

export type SortDirection = "asc" | "desc";

export interface DrugBrowserFilters {
  query: string;
  module: string;
  status: DrugStatusFilter;
  validation: DrugValidationFilter;
}

export interface DrugBrowserRow {
  id: string;
  slug: string;
  label: string;
  module?: string;
  status: string;
  confidenceScore: number | null;
  confidenceLevel: ConfidenceLevel | null;
  validationStatus: ValidationStatus;
  curriculumStatus?: string;
  workflowState?: string;
  workflowId?: string;
  source: DrugSource;
}

export const DEFAULT_DRUG_BROWSER_FILTERS: DrugBrowserFilters = {
  query: "",
  module: "all",
  status: "all",
  validation: "all",
};

export const DEFAULT_PAGE_SIZE = 25;
