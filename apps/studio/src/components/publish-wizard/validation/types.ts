import type { PublishPackageInput, ValidationResult } from "@/lib/api";
import type {
  ValidationIssue,
  ValidationLevel,
  ValidationSummaryData,
} from "@/components/validation/validation-types";

/** Issue buckets surfaced in the publish wizard validation panel. */
export type IssueGroupId =
  | "schema"
  | "ontology"
  | "biomedical"
  | "educational"
  | "evidence"
  | "workflow";

/** Validation levels from the API plus synthetic workflow issues. */
export type PublishWizardIssueLevel = ValidationLevel | "workflow";

export interface PublishWizardIssue extends Omit<ValidationIssue, "level"> {
  level: PublishWizardIssueLevel;
}

export const ISSUE_GROUP_ORDER: IssueGroupId[] = [
  "schema",
  "ontology",
  "biomedical",
  "educational",
  "evidence",
  "workflow",
];

export const ISSUE_GROUP_LABELS: Record<IssueGroupId, string> = {
  schema: "Schema",
  ontology: "Ontology",
  biomedical: "Biomedical",
  educational: "Educational",
  evidence: "Evidence",
  workflow: "Workflow",
};

export type GroupedValidationIssues = Record<IssueGroupId, PublishWizardIssue[]>;

/** Evidence issue buckets surfaced in the publish wizard. */
export type EvidenceIssueCategory = "blockers" | "warnings" | "missing" | "lowConfidence";

export interface CategorizedEvidenceIssues {
  blockers: PublishWizardIssue[];
  warnings: PublishWizardIssue[];
  missing: PublishWizardIssue[];
  lowConfidence: PublishWizardIssue[];
}

export interface EvidenceGatingState {
  categorized: CategorizedEvidenceIssues;
  blockerCount: number;
  warningCount: number;
  missingCount: number;
  lowConfidenceCount: number;
  hasEvidenceBlockers: boolean;
  /** True when error-severity evidence issues block publish/submit. */
  publishBlockedByEvidence: boolean;
}

export const EVIDENCE_CATEGORY_LABELS: Record<EvidenceIssueCategory, string> = {
  blockers: "Evidence blockers",
  warnings: "Evidence warnings",
  missing: "Missing evidence",
  lowConfidence: "Low-confidence evidence",
};

export const EVIDENCE_CATEGORY_ORDER: EvidenceIssueCategory[] = [
  "blockers",
  "missing",
  "lowConfidence",
  "warnings",
];

export type PublishReadinessStatus = "ready" | "blocked" | "pending" | "unknown";

export interface WorkflowGatingContext {
  workflowState: string | null;
  entityId?: string | null;
  summary?: ValidationSummaryData;
}

export interface PublishValidationState {
  valid: boolean;
  /** Mirrors backend `publish_ready` semantics from package validation. */
  publishReady: boolean;
  /** Final gate for the publish step in the wizard. */
  canPublish: boolean;
  status: PublishReadinessStatus;
  message: string;
  issues: PublishWizardIssue[];
  grouped: GroupedValidationIssues;
  evidence: EvidenceGatingState;
  blockingErrorCount: number;
  graphFailures: number;
  graphPending: number;
}

export interface PackageValidationSnapshot extends ValidationResult {
  publish_ready: boolean;
  error_count: number;
  warning_count: number;
}

export type PublishWizardAction = "submit" | "approve" | "publish";

export interface PublishActionGate {
  allowed: boolean;
  reason: string | null;
}

export interface UsePublishReadinessOptions {
  workflowId: string | null;
  workflowState: string | null;
  package: PublishPackageInput | null;
  entityId?: string | null;
  enabled?: boolean;
  /** When set, reuse editor dry-run validation instead of POST /curator/validate. */
  editorValidation?: { valid: boolean; issues: Record<string, unknown>[] } | null;
  skipPackageFetch?: boolean;
}

export interface UsePublishReadinessResult {
  validation: PublishValidationState | null;
  packageValidation: PackageValidationSnapshot | null;
  summary: ValidationSummaryData | undefined;
  loading: boolean;
  validating: boolean;
  error: Error | null;
  refetch: () => void;
  gateAction: (action: PublishWizardAction) => PublishActionGate;
}
