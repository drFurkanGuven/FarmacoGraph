import type { ConfidenceLevel } from "@/components/ui/confidence-badge";
import type { ValidationStatus } from "@/components/ui/validation-badge";
import type { CurriculumData, DrugBrowseItem, WorkflowItem } from "@/lib/api/types";
import type {
  ApiDrugSummary,
  DrugBrowserFilters,
  DrugBrowserRow,
  SortDirection,
  SortField,
} from "./types";

/** Studio drug editor route — always keyed by slug (curriculum + curator workflows). */
export function drugEditorHref(slug: string): string {
  return `/knowledge/drugs/${encodeURIComponent(slug)}`;
}

export function confidenceLevelFromScore(score: number | null | undefined): ConfidenceLevel | null {
  if (score === null || score === undefined) return null;
  if (score >= 0.8) return "high";
  if (score >= 0.5) return "medium";
  return "low";
}

/**
 * Map package validation fields to a badge status.
 * Matches disease browser: valid → Valid, errors → Invalid, else Pending.
 * Published graph drugs without an open draft are treated as Valid (validated at publish).
 */
export function validationStatusFromRow(input: {
  status?: string;
  curriculumStatus?: string;
  validation_valid?: boolean | null;
  validation_errors?: number | null;
  source?: DrugBrowserRow["source"];
  workflowState?: string;
}): ValidationStatus {
  if (input.validation_valid === true) return "valid";
  if ((input.validation_errors ?? 0) > 0) return "invalid";
  if (input.status === "published" || input.curriculumStatus === "published") return "valid";
  return "pending";
}

export function browseItemToRow(item: DrugBrowseItem): DrugBrowserRow {
  return {
    id: item.entity_id,
    slug: item.slug,
    label: item.label,
    module: item.module,
    status: item.publication_status,
    confidenceScore: item.confidence_score ?? null,
    confidenceLevel: confidenceLevelFromScore(item.confidence_score),
    validationStatus: validationStatusFromRow({
      status: item.publication_status,
      curriculumStatus: item.curriculum_status,
      validation_valid: item.validation_valid,
      validation_errors: item.validation_errors,
    }),
    curriculumStatus: item.curriculum_status,
    workflowState: item.workflow_state ?? undefined,
    workflowId: item.workflow_id ?? undefined,
    source: item.publication_status === "published" ? "graph" : "curriculum",
  };
}

export function buildDrugRows(input: {
  drugs: ApiDrugSummary[];
  curriculum?: CurriculumData | null;
  drafts: WorkflowItem[];
  reviews: WorkflowItem[];
  module?: string;
}): DrugBrowserRow[] {
  const bySlug = new Map<string, DrugBrowserRow>();

  const workflowByEntityId = new Map<string, WorkflowItem>();
  const workflowBySlug = new Map<string, WorkflowItem>();
  for (const workflow of [...input.drafts, ...input.reviews]) {
    workflowByEntityId.set(workflow.entity_id, workflow);
    if (workflow.entity_slug) workflowBySlug.set(workflow.entity_slug, workflow);
  }

  for (const drug of input.drugs) {
    const workflow = workflowByEntityId.get(drug.id) ?? workflowBySlug.get(drug.slug);
    const status = drug.status ?? "published";
    const row: DrugBrowserRow = {
      id: drug.id,
      slug: drug.slug,
      label: drug.label || drug.generic_name || drug.slug,
      module: drug.module ?? input.module,
      status,
      confidenceScore: drug.confidence_score ?? null,
      confidenceLevel: confidenceLevelFromScore(drug.confidence_score),
      validationStatus: "pending",
      workflowState: workflow?.state,
      workflowId: workflow?.id,
      curriculumStatus: "published",
      source: "graph",
    };
    row.validationStatus = validationStatusFromRow({
      status: row.status,
      curriculumStatus: row.curriculumStatus,
      validation_valid: drug.validation_valid,
      validation_errors: drug.validation_errors,
    });
    bySlug.set(drug.slug, row);
  }

  const categories = input.curriculum?.curriculum?.categories ?? [];
  for (const category of categories) {
    for (const curriculumDrug of category.drugs) {
      const existing = bySlug.get(curriculumDrug.slug);
      const workflow = workflowBySlug.get(curriculumDrug.slug);

      if (existing) {
        existing.curriculumStatus = curriculumDrug.status;
        continue;
      }

      const row: DrugBrowserRow = {
        id: workflow?.entity_id ?? curriculumDrug.slug,
        slug: curriculumDrug.slug,
        label: curriculumDrug.slug,
        module: input.module,
        status: curriculumDrug.status,
        confidenceScore: null,
        confidenceLevel: null,
        validationStatus: "pending",
        workflowState: workflow?.state,
        workflowId: workflow?.id,
        curriculumStatus: curriculumDrug.status,
        source: "curriculum",
      };
      row.validationStatus = validationStatusFromRow({
        status: row.status,
        curriculumStatus: row.curriculumStatus,
      });
      bySlug.set(curriculumDrug.slug, row);
    }
  }

  return Array.from(bySlug.values());
}

export function filterDrugRows(rows: DrugBrowserRow[], filters: DrugBrowserFilters): DrugBrowserRow[] {
  return rows.filter((row) => {
    if (filters.module !== "all" && row.module && row.module !== filters.module) {
      return false;
    }

    if (filters.status !== "all") {
      if (filters.status === "published" && row.status !== "published" && row.curriculumStatus !== "published") {
        return false;
      }
      if (filters.status === "pending" && row.curriculumStatus !== "pending" && row.status !== "pending") {
        return false;
      }
      if (filters.status === "draft" && row.workflowState !== "draft") {
        return false;
      }
      if (filters.status === "review" && row.workflowState !== "review") {
        return false;
      }
    }

    if (filters.validation !== "all" && row.validationStatus !== filters.validation) {
      return false;
    }

    return true;
  });
}

function compareStrings(a: string, b: string, direction: SortDirection): number {
  const result = a.localeCompare(b, undefined, { sensitivity: "base" });
  return direction === "asc" ? result : -result;
}

function compareNullableNumbers(
  a: number | null,
  b: number | null,
  direction: SortDirection,
): number {
  if (a === null && b === null) return 0;
  if (a === null) return 1;
  if (b === null) return -1;
  const result = a - b;
  return direction === "asc" ? result : -result;
}

export function sortDrugRows(
  rows: DrugBrowserRow[],
  field: SortField,
  direction: SortDirection,
): DrugBrowserRow[] {
  const sorted = [...rows];
  sorted.sort((a, b) => {
    switch (field) {
      case "slug":
        return compareStrings(a.slug, b.slug, direction);
      case "module":
        return compareStrings(a.module ?? "", b.module ?? "", direction);
      case "status":
        return compareStrings(a.status, b.status, direction);
      case "confidence":
        return compareNullableNumbers(a.confidenceScore, b.confidenceScore, direction);
      case "label":
      default:
        return compareStrings(a.label, b.label, direction);
    }
  });
  return sorted;
}

export function paginateDrugRows(rows: DrugBrowserRow[], page: number, pageSize: number): DrugBrowserRow[] {
  const start = (page - 1) * pageSize;
  return rows.slice(start, start + pageSize);
}

export function totalPages(totalItems: number, pageSize: number): number {
  return Math.max(1, Math.ceil(totalItems / pageSize));
}
