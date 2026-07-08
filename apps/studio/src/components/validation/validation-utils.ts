import type {
  CategorizedIssues,
  PublishReadiness,
  PublishReadinessStatus,
  QueueValidationItem,
  ValidationIssue,
  ValidationLevel,
  ValidationSeverity,
  ValidationSummaryData,
} from "./validation-types";

const LEVELS = new Set<ValidationLevel>(["schema", "ontology", "biomedical", "educational"]);
const SEVERITIES = new Set<ValidationSeverity>(["error", "warning", "info"]);

const EVIDENCE_CONSTRAINT_IDS = new Set(["FG-C012", "FG-C018", "FG-C019", "FG-C020", "FG-C026", "FG-C028"]);
const EVIDENCE_KEYWORDS = /\b(evidence|provenance|attestation|source)\b/i;

/** Map drug relationship keys to ontology target entity types. */
const RELATIONSHIP_TARGET_TYPES: Record<string, string> = {
  BELONGS_TO: "DrugClass",
  IS_A: "DrugClass",
  TREATS: "Disease",
  PREVENTS: "Disease",
  HAS_MECHANISM_ROOT: "MechanismFragment",
  TARGETS: "Target",
  INHIBITS: "Target",
  CAUSES: "SideEffect",
  CONTRAINDICATED_IN: "Disease",
  INTERACTS_WITH: "Drug",
  AVOID_WITH: "Drug",
  METABOLIZED_BY: "Enzyme",
  COVERS: "Pathogen",
  FIRST_LINE_FOR: "Disease",
};

export function parseValidationIssue(raw: Record<string, unknown>): ValidationIssue | null {
  const level = raw.level;
  const severity = raw.severity;
  const message = raw.message;

  if (typeof message !== "string" || !LEVELS.has(level as ValidationLevel)) {
    return null;
  }

  const parsedSeverity = SEVERITIES.has(severity as ValidationSeverity)
    ? (severity as ValidationSeverity)
    : "error";

  return {
    constraint_id: typeof raw.constraint_id === "string" ? raw.constraint_id : null,
    level: level as ValidationLevel,
    severity: parsedSeverity,
    message,
    field: typeof raw.field === "string" ? raw.field : null,
    entity_id: typeof raw.entity_id === "string" ? raw.entity_id : null,
    relationship_type: typeof raw.relationship_type === "string" ? raw.relationship_type : null,
  };
}

export function parseValidationIssues(issues: Record<string, unknown>[]): ValidationIssue[] {
  return issues
    .map((issue) => parseValidationIssue(issue))
    .filter((issue): issue is ValidationIssue => issue !== null);
}

export function isMissingEvidenceIssue(issue: ValidationIssue): boolean {
  if (issue.constraint_id && EVIDENCE_CONSTRAINT_IDS.has(issue.constraint_id)) {
    return true;
  }
  if (issue.field && EVIDENCE_KEYWORDS.test(issue.field)) {
    return true;
  }
  return EVIDENCE_KEYWORDS.test(issue.message);
}

export function categorizeIssues(issues: ValidationIssue[]): CategorizedIssues {
  const errors: ValidationIssue[] = [];
  const warnings: ValidationIssue[] = [];
  const ontologyViolations: ValidationIssue[] = [];
  const missingEvidence: ValidationIssue[] = [];

  for (const issue of issues) {
    if (issue.severity === "error") {
      errors.push(issue);
    } else {
      warnings.push(issue);
    }

    if (issue.level === "ontology") {
      ontologyViolations.push(issue);
    }

    if (isMissingEvidenceIssue(issue)) {
      missingEvidence.push(issue);
    }
  }

  return { errors, warnings, ontologyViolations, missingEvidence };
}

export function buildRelationshipsFromDrug(drug: Record<string, unknown>): Record<string, unknown>[] {
  const drugId = String(drug.id ?? "");
  const relationships = drug.relationships;

  if (!relationships || typeof relationships !== "object" || Array.isArray(relationships)) {
    return [];
  }

  const edges: Record<string, unknown>[] = [];

  for (const [relationshipType, targets] of Object.entries(relationships)) {
    if (!Array.isArray(targets)) continue;

    const targetType = RELATIONSHIP_TARGET_TYPES[relationshipType] ?? "Entity";

    for (const targetId of targets) {
      if (typeof targetId !== "string") continue;
      edges.push({
        relationship_type: relationshipType,
        source_type: "Drug",
        target_type: targetType,
        source_id: drugId,
        target_id: targetId,
      });
    }
  }

  return edges;
}

export function aggregateQueueIssues(items: QueueValidationItem[]): ValidationIssue[] {
  return items.flatMap((item) =>
    item.issues.map((issue) => ({
      ...issue,
      entity_id: issue.entity_id ?? item.entityId,
    })),
  );
}

export function computePublishReadiness(
  summary: ValidationSummaryData | undefined,
  queueItems: QueueValidationItem[],
  categorized: CategorizedIssues,
): PublishReadiness {
  const draftCount = queueItems.filter((item) => item.workflowState === "draft").length;
  const reviewCount = queueItems.filter((item) => item.workflowState === "review").length;
  const graphFailures = summary?.failed_count ?? 0;
  const graphPending = summary?.pending_count ?? 0;
  const blockingErrors = categorized.errors.length + graphFailures;

  let status: PublishReadinessStatus = "unknown";
  let message = "No packages in the curator queue.";

  if (graphPending > 0) {
    status = "pending";
    message = `${graphPending} graph validation job${graphPending === 1 ? "" : "s"} still running.`;
  } else if (graphFailures > 0 || categorized.errors.length > 0) {
    status = "blocked";
    const parts: string[] = [];
    if (categorized.errors.length > 0) {
      parts.push(`${categorized.errors.length} publish error${categorized.errors.length === 1 ? "" : "s"}`);
    }
    if (graphFailures > 0) {
      parts.push(`${graphFailures} graph validation failure${graphFailures === 1 ? "" : "s"}`);
    }
    message = `Blocked: ${parts.join(" and ")}.`;
  } else if (draftCount + reviewCount > 0) {
    status = "ready";
    message = `${draftCount + reviewCount} package${draftCount + reviewCount === 1 ? "" : "s"} passed dry-run validation.`;
  } else if (graphFailures === 0 && graphPending === 0) {
    status = "ready";
    message = "No blocking validation issues detected.";
  }

  return {
    status,
    draftCount,
    reviewCount,
    blockingErrors,
    graphFailures,
    graphPending,
    message,
  };
}

export function issueKey(issue: ValidationIssue, index: number): string {
  return [
    issue.constraint_id ?? "no-constraint",
    issue.level,
    issue.entity_id ?? "no-entity",
    issue.relationship_type ?? "no-rel",
    issue.field ?? "no-field",
    index,
  ].join(":");
}

export function formatIssueLocation(issue: ValidationIssue): string | undefined {
  const parts: string[] = [];
  if (issue.entity_id) parts.push(issue.entity_id);
  if (issue.relationship_type) parts.push(issue.relationship_type);
  if (issue.field) parts.push(issue.field);
  return parts.length > 0 ? parts.join(" · ") : undefined;
}
