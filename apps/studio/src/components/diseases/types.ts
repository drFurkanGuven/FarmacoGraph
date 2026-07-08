export interface DiseaseBrowseItem {
  slug: string;
  label: string;
  entity_id: string;
  module?: string;
  publication_status?: string;
  workflow_id?: string | null;
  workflow_state?: string | null;
  validation_valid?: boolean;
  validation_errors?: number;
}

export interface DiseaseBrowserFilters {
  query: string;
  workflowState: string;
}

export type DiseaseSortField = "slug" | "label";
export type DiseaseSortDirection = "asc" | "desc";
