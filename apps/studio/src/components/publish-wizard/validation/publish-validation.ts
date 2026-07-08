import type { FarmacoGraphClient, PublishPackageInput } from "@/lib/api";
import { parseValidationIssues } from "@/components/validation/validation-utils";
import type { ValidationSummaryData } from "@/components/validation/validation-types";
import {
  buildAttestationIssue,
  buildWorkflowIssues,
  buildWorkflowStateIssue,
  computeEvidenceGating,
  countBlockingIssues,
  groupValidationIssues,
} from "./issue-grouping";
import type {
  EvidenceGatingState,
  PackageValidationSnapshot,
  PublishActionGate,
  PublishReadinessStatus,
  PublishValidationState,
  PublishWizardAction,
  PublishWizardIssue,
  WorkflowGatingContext,
} from "./types";

const REQUIRED_WORKFLOW_STATE: Record<PublishWizardAction, string> = {
  submit: "draft",
  approve: "review",
  publish: "approved",
};

const ACTION_LABELS: Record<PublishWizardAction, string> = {
  submit: "submitting for review",
  approve: "approval",
  publish: "publishing",
};

function readCuratorAttestation(packageInput: PublishPackageInput): boolean {
  const provenance = packageInput.entity_payload?.provenance;
  if (!provenance || typeof provenance !== "object" || Array.isArray(provenance)) {
    return false;
  }
  return (provenance as Record<string, unknown>).curator_attestation === true;
}

export function computePublishReady(valid: boolean, packageInput: PublishPackageInput): boolean {
  return valid && readCuratorAttestation(packageInput);
}

export function toPackageValidationSnapshot(
  validation: { valid: boolean; issues: Record<string, unknown>[] },
  packageInput: PublishPackageInput,
): PackageValidationSnapshot {
  const issues = parseValidationIssues(validation.issues);
  const errorCount = issues.filter((issue) => issue.severity === "error").length;
  const warningCount = issues.filter((issue) => issue.severity === "warning").length;

  return {
    valid: validation.valid,
    issues: validation.issues,
    publish_ready: computePublishReady(validation.valid, packageInput),
    error_count: errorCount,
    warning_count: warningCount,
  };
}

export async function validatePublishPackage(
  client: FarmacoGraphClient,
  packageInput: PublishPackageInput,
): Promise<PackageValidationSnapshot> {
  const envelope = await client.validatePackage(packageInput);
  return toPackageValidationSnapshot(envelope.data, packageInput);
}

export async function fetchValidationSummary(
  client: FarmacoGraphClient,
): Promise<ValidationSummaryData> {
  const envelope = await client.request<ValidationSummaryData>("/curator/validation-summary");
  return envelope.data;
}

function appendAttestationIssue(
  issues: ReturnType<typeof parseValidationIssues>,
  packageInput: PublishPackageInput,
): PublishWizardIssue[] {
  if (readCuratorAttestation(packageInput)) {
    return issues;
  }
  return [...issues, buildAttestationIssue()];
}

function formatEvidenceBlockerSummary(evidence: EvidenceGatingState): string | null {
  if (!evidence.hasEvidenceBlockers) {
    return null;
  }

  const parts: string[] = [`${evidence.blockerCount} evidence blocker${evidence.blockerCount === 1 ? "" : "s"}`];

  if (evidence.missingCount > 0) {
    parts.push(`${evidence.missingCount} missing evidence gap${evidence.missingCount === 1 ? "" : "s"}`);
  }

  return parts.join(", ");
}

export function getEvidenceGatingBlockers(state: PublishValidationState): string[] {
  const blockers: string[] = [];
  const { evidence } = state;

  const summary = formatEvidenceBlockerSummary(evidence);
  if (summary) {
    blockers.push(summary);
  }

  if (evidence.lowConfidenceCount > 0 && evidence.blockerCount === 0) {
    blockers.push(
      `${evidence.lowConfidenceCount} low-confidence evidence item${evidence.lowConfidenceCount === 1 ? "" : "s"} flagged`,
    );
  }

  if (evidence.warningCount > 0 && evidence.blockerCount === 0) {
    blockers.push(
      `${evidence.warningCount} evidence warning${evidence.warningCount === 1 ? "" : "s"} should be reviewed`,
    );
  }

  return blockers;
}

export function computePublishValidationState(input: {
  packageValidation: PackageValidationSnapshot;
  packageInput: PublishPackageInput;
  workflowState: string | null;
  summary?: ValidationSummaryData;
  entityId?: string | null;
}): PublishValidationState {
  const { packageValidation, packageInput, workflowState, summary, entityId } = input;
  const parsedIssues = parseValidationIssues(packageValidation.issues);
  const withAttestation = appendAttestationIssue(parsedIssues, packageInput);

  const workflowContext: WorkflowGatingContext = {
    workflowState,
    entityId,
    summary,
  };

  const grouped = groupValidationIssues(parsedIssues, workflowContext);

  if (!readCuratorAttestation(packageInput)) {
    const attestationIssue = buildAttestationIssue();
    grouped.biomedical.push(attestationIssue);
    grouped.evidence.push(attestationIssue);
  }

  const evidence = computeEvidenceGating(grouped.evidence);
  const graphFailures = summary?.failed_count ?? 0;
  const graphPending = summary?.pending_count ?? 0;
  const blockingErrorCount = countBlockingIssues(grouped);
  const publishReady = packageValidation.publish_ready;
  const canPublish =
    publishReady && workflowState === "approved" && graphPending === 0 && blockingErrorCount === 0;

  let status: PublishReadinessStatus = "unknown";
  let message = "Validation has not completed yet.";

  if (graphPending > 0) {
    status = "pending";
    message = `${graphPending} graph validation job${graphPending === 1 ? "" : "s"} still running.`;
  } else if (!packageValidation.valid || !publishReady || blockingErrorCount > 0) {
    status = "blocked";
    const parts: string[] = [];
    if (!packageValidation.valid || blockingErrorCount > 0) {
      parts.push(`${blockingErrorCount || packageValidation.error_count} blocking validation issue${(blockingErrorCount || packageValidation.error_count) === 1 ? "" : "s"}`);
    }
    const evidenceSummary = formatEvidenceBlockerSummary(evidence);
    if (evidenceSummary) {
      parts.push(evidenceSummary);
    }
    if (!publishReady && packageValidation.valid) {
      parts.push("curator attestation is missing");
    }
    if (graphFailures > 0) {
      parts.push(`${graphFailures} graph validation failure${graphFailures === 1 ? "" : "s"}`);
    }
    message = `Blocked: ${parts.join(", ")}.`;
  } else if (canPublish) {
    status = "ready";
    message = "Package passed validation and is ready to publish.";
  } else if (workflowState !== "approved") {
    status = "blocked";
    message = `Workflow must be approved before publishing. Current state: ${workflowState ?? "unknown"}.`;
  } else {
    status = "ready";
    message = "No blocking validation issues detected.";
  }

  return {
    valid: packageValidation.valid,
    publishReady,
    canPublish,
    status,
    message,
    issues: withAttestation,
    grouped,
    evidence,
    blockingErrorCount,
    graphFailures,
    graphPending,
  };
}

export function isPublishBlocked(state: PublishValidationState): boolean {
  return !state.canPublish;
}

export function getPublishBlockReason(state: PublishValidationState): string | null {
  return state.canPublish ? null : state.message;
}

export function gatePublishAction(
  action: PublishWizardAction,
  state: PublishValidationState | null,
  workflowState: string | null,
): PublishActionGate {
  const requiredState = REQUIRED_WORKFLOW_STATE[action];
  const actionLabel = ACTION_LABELS[action];

  if (!state) {
    return { allowed: false, reason: "Validation has not completed yet." };
  }

  if (workflowState !== requiredState) {
    return {
      allowed: false,
      reason: buildWorkflowStateIssue(workflowState, requiredState, actionLabel).message,
    };
  }

  if (action === "publish") {
    if (state.graphPending > 0) {
      return {
        allowed: false,
        reason: `${state.graphPending} graph validation job${state.graphPending === 1 ? "" : "s"} still running.`,
      };
    }
    if (state.evidence.publishBlockedByEvidence) {
      return {
        allowed: false,
        reason:
          formatEvidenceBlockerSummary(state.evidence) ??
          `${state.evidence.blockerCount} evidence blocker${state.evidence.blockerCount === 1 ? "" : "s"} must be resolved.`,
      };
    }
    if (!state.publishReady) {
      return { allowed: false, reason: state.message };
    }
    if (!state.canPublish) {
      return { allowed: false, reason: state.message };
    }
    return { allowed: true, reason: null };
  }

  if (state.status === "pending") {
    return { allowed: false, reason: state.message };
  }

  if (state.blockingErrorCount > 0) {
    if (state.evidence.publishBlockedByEvidence) {
      const evidenceReason = formatEvidenceBlockerSummary(state.evidence);
      if (evidenceReason) {
        return { allowed: false, reason: `${evidenceReason} must be resolved.` };
      }
    }

    return {
      allowed: false,
      reason: `${state.blockingErrorCount} blocking validation issue${state.blockingErrorCount === 1 ? "" : "s"} must be resolved.`,
    };
  }

  return { allowed: true, reason: null };
}

/** @internal Exported for tests that need workflow issue synthesis without full state. */
export { buildWorkflowIssues };
