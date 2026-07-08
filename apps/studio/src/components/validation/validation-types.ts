/** Validation issue shape returned by POST /curator/validate. */

export type ValidationLevel = "schema" | "ontology" | "biomedical" | "educational";
export type ValidationSeverity = "error" | "warning" | "info";

export interface ValidationIssue {
  constraint_id?: string | null;
  level: ValidationLevel;
  severity: ValidationSeverity;
  message: string;
  field?: string | null;
  entity_id?: string | null;
  relationship_type?: string | null;
}

export interface ValidationSummaryData {
  failed_count: number;
  pending_count: number;
  recent_failures: Array<{
    source: string;
    job_id?: string;
    job_type?: string;
    entity_id?: string | null;
    message?: string | null;
    at?: string | null;
  }>;
}

export interface QueueValidationItem {
  workflowId: string;
  entityId: string;
  entityLabel: string;
  workflowState: string;
  valid: boolean;
  issues: ValidationIssue[];
}

export interface CategorizedIssues {
  errors: ValidationIssue[];
  warnings: ValidationIssue[];
  ontologyViolations: ValidationIssue[];
  missingEvidence: ValidationIssue[];
}

export type PublishReadinessStatus = "ready" | "blocked" | "pending" | "unknown";

export interface PublishReadiness {
  status: PublishReadinessStatus;
  draftCount: number;
  reviewCount: number;
  blockingErrors: number;
  graphFailures: number;
  graphPending: number;
  message: string;
}
