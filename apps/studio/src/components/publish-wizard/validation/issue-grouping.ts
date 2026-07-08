import { isMissingEvidenceIssue } from "@/components/validation/validation-utils";
import type { ValidationIssue } from "@/components/validation/validation-types";
import {
  ISSUE_GROUP_ORDER,
  type CategorizedEvidenceIssues,
  type EvidenceGatingState,
  type EvidenceIssueCategory,
  type GroupedValidationIssues,
  type IssueGroupId,
  type PublishWizardIssue,
  type WorkflowGatingContext,
} from "./types";

const LEVEL_GROUPS = new Set<IssueGroupId>([
  "schema",
  "ontology",
  "biomedical",
  "educational",
]);

/** Score threshold aligned with drug browser confidence levels (medium starts at 0.5). */
export const LOW_CONFIDENCE_SCORE_THRESHOLD = 0.5;

const EVIDENCE_WARNING_CONSTRAINT_IDS = new Set(["FG-C026"]);
const EVIDENCE_KEYWORDS =
  /\b(evidence|provenance|attestation|source|guideline|supported_by|recommended_by)\b/i;
const LOW_CONFIDENCE_KEYWORDS =
  /\b(low[- ]confidence|weak evidence|insufficient evidence|below threshold|uncertain)\b/i;
const CONFIDENCE_SCORE_PATTERN = /\bconfidence(?:\s*score)?\s*(?:is\s*)?[:=]?\s*([0-9]*\.?[0-9]+)/i;

function emptyGroups(): GroupedValidationIssues {
  return {
    schema: [],
    ontology: [],
    biomedical: [],
    educational: [],
    evidence: [],
    workflow: [],
  };
}

function isLevelGroup(level: string): level is IssueGroupId {
  return LEVEL_GROUPS.has(level as IssueGroupId);
}

export function buildAttestationIssue(): PublishWizardIssue {
  return {
    constraint_id: null,
    level: "biomedical",
    severity: "error",
    message: "Curator attestation is required before publishing.",
    field: "entity_payload.provenance.curator_attestation",
    entity_id: null,
    relationship_type: null,
  };
}

export function buildWorkflowStateIssue(
  workflowState: string | null,
  requiredState: string,
  actionLabel: string,
): PublishWizardIssue {
  return {
    constraint_id: null,
    level: "workflow",
    severity: "error",
    message: `Workflow must be in "${requiredState}" before ${actionLabel}. Current state: ${workflowState ?? "unknown"}.`,
    field: "workflow.state",
    entity_id: null,
    relationship_type: null,
  };
}

export function buildGraphPendingIssue(pendingCount: number): PublishWizardIssue {
  return {
    constraint_id: null,
    level: "workflow",
    severity: "error",
    message: `${pendingCount} graph validation job${pendingCount === 1 ? "" : "s"} still running.`,
    field: null,
    entity_id: null,
    relationship_type: null,
  };
}

export function buildGraphFailureIssue(message: string, entityId?: string | null): PublishWizardIssue {
  return {
    constraint_id: null,
    level: "workflow",
    severity: "error",
    message,
    field: null,
    entity_id: entityId ?? null,
    relationship_type: null,
  };
}

export function isLowConfidenceEvidenceIssue(issue: ValidationIssue): boolean {
  const scoreMatch = issue.message.match(CONFIDENCE_SCORE_PATTERN);
  const hasLowScore =
    scoreMatch !== null &&
    !Number.isNaN(Number.parseFloat(scoreMatch[1])) &&
    Number.parseFloat(scoreMatch[1]) < LOW_CONFIDENCE_SCORE_THRESHOLD;

  const hasLowConfidenceSignal =
    LOW_CONFIDENCE_KEYWORDS.test(issue.message) ||
    hasLowScore ||
    (issue.field !== null &&
      issue.field !== undefined &&
      /\bconfidence_score\b/i.test(issue.field) &&
      (issue.severity === "warning" ||
        issue.severity === "info" ||
        /\blow\b/i.test(issue.message))) ||
    (issue.field !== null &&
      issue.field !== undefined &&
      /\bevidence_level\b/i.test(issue.field) &&
      (issue.severity !== "error" || /\blow\b/i.test(issue.message)));

  if (!hasLowConfidenceSignal) {
    return false;
  }

  if (issue.constraint_id === "FG-C018") {
    return false;
  }

  if (
    isMissingEvidenceIssue(issue) &&
    !LOW_CONFIDENCE_KEYWORDS.test(issue.message) &&
    !hasLowScore
  ) {
    return false;
  }

  return true;
}

export function isEvidenceIssue(issue: ValidationIssue): boolean {
  if (isMissingEvidenceIssue(issue)) {
    return true;
  }

  if (isLowConfidenceEvidenceIssue(issue)) {
    return true;
  }

  if (issue.constraint_id && EVIDENCE_WARNING_CONSTRAINT_IDS.has(issue.constraint_id)) {
    return true;
  }

  if (issue.field && EVIDENCE_KEYWORDS.test(issue.field)) {
    return true;
  }

  return EVIDENCE_KEYWORDS.test(issue.message);
}

function emptyEvidenceCategories(): CategorizedEvidenceIssues {
  return {
    blockers: [],
    warnings: [],
    missing: [],
    lowConfidence: [],
  };
}

function asValidationIssue(issue: PublishWizardIssue): ValidationIssue | null {
  if (issue.level === "workflow") {
    return null;
  }
  return { ...issue, level: issue.level };
}

/**
 * Split evidence-group issues into publish-wizard evidence buckets.
 * Issues may appear in multiple buckets (e.g. missing provenance is both missing and a blocker).
 */
export function categorizeEvidenceIssues(issues: PublishWizardIssue[]): CategorizedEvidenceIssues {
  const categorized = emptyEvidenceCategories();

  for (const issue of issues) {
    const validationIssue = asValidationIssue(issue);
    if (!validationIssue || !isEvidenceIssue(validationIssue)) {
      continue;
    }

    if (issue.severity === "error") {
      categorized.blockers.push(issue);
    } else {
      categorized.warnings.push(issue);
    }

    if (isMissingEvidenceIssue(validationIssue)) {
      categorized.missing.push(issue);
    }

    if (isLowConfidenceEvidenceIssue(validationIssue)) {
      categorized.lowConfidence.push(issue);
    }
  }

  return categorized;
}

export function computeEvidenceGating(evidenceIssues: PublishWizardIssue[]): EvidenceGatingState {
  const categorized = categorizeEvidenceIssues(evidenceIssues);

  return {
    categorized,
    blockerCount: categorized.blockers.length,
    warningCount: categorized.warnings.length,
    missingCount: categorized.missing.length,
    lowConfidenceCount: categorized.lowConfidence.length,
    hasEvidenceBlockers: categorized.blockers.length > 0,
    publishBlockedByEvidence: categorized.blockers.length > 0,
  };
}

export function getNonemptyEvidenceCategories(
  categorized: CategorizedEvidenceIssues,
): Array<{ id: EvidenceIssueCategory; issues: PublishWizardIssue[] }> {
  const order: EvidenceIssueCategory[] = ["blockers", "missing", "lowConfidence", "warnings"];

  return order
    .filter((id) => categorized[id].length > 0)
    .map((id) => ({ id, issues: categorized[id] }));
}

export function buildWorkflowIssues(context: WorkflowGatingContext): PublishWizardIssue[] {
  const issues: PublishWizardIssue[] = [];
  const summary = context.summary;
  const entityId = context.entityId ?? null;

  if (summary && summary.pending_count > 0) {
    issues.push(buildGraphPendingIssue(summary.pending_count));
  }

  if (summary && summary.failed_count > 0) {
    const entityFailures = summary.recent_failures.filter(
      (failure) => !entityId || failure.entity_id === entityId,
    );

    if (entityFailures.length > 0) {
      for (const failure of entityFailures) {
        issues.push(
          buildGraphFailureIssue(
            failure.message ?? "Graph validation failed.",
            failure.entity_id ?? entityId,
          ),
        );
      }
    } else if (!entityId) {
      issues.push(
        buildGraphFailureIssue(
          `${summary.failed_count} graph validation failure${summary.failed_count === 1 ? "" : "s"} recorded.`,
        ),
      );
    }
  }

  return issues;
}

/**
 * Partition validation issues into wizard groups.
 * Level-based groups use `issue.level`; evidence and workflow are derived buckets.
 */
export function groupValidationIssues(
  issues: ValidationIssue[],
  workflowContext?: WorkflowGatingContext,
): GroupedValidationIssues {
  const grouped = emptyGroups();

  for (const issue of issues) {
    if (isLevelGroup(issue.level)) {
      grouped[issue.level].push(issue);
    }

    if (isMissingEvidenceIssue(issue) || isEvidenceIssue(issue)) {
      grouped.evidence.push(issue);
    }
  }

  if (workflowContext) {
    grouped.workflow.push(...buildWorkflowIssues(workflowContext));
  }

  return grouped;
}

export function countBlockingIssues(grouped: GroupedValidationIssues): number {
  const seen = new Set<string>();
  let count = 0;

  for (const groupId of ISSUE_GROUP_ORDER) {
    for (const issue of grouped[groupId]) {
      if (issue.severity !== "error") continue;

      const key = [
        issue.constraint_id ?? "",
        issue.level,
        issue.message,
        issue.field ?? "",
        issue.entity_id ?? "",
      ].join("|");

      if (seen.has(key)) continue;
      seen.add(key);
      count += 1;
    }
  }

  return count;
}

export function getNonemptyIssueGroups(
  grouped: GroupedValidationIssues,
): Array<{ id: IssueGroupId; issues: PublishWizardIssue[] }> {
  return ISSUE_GROUP_ORDER.filter((groupId) => grouped[groupId].length > 0).map((groupId) => ({
    id: groupId,
    issues: grouped[groupId],
  }));
}

export function hasBlockingIssues(grouped: GroupedValidationIssues): boolean {
  return countBlockingIssues(grouped) > 0;
}
