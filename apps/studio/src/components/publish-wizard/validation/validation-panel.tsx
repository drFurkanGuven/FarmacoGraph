"use client";

import { AlertTriangle, Loader2, RefreshCw } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { EmptyState } from "@/components/ui/empty-state";
import { ListSkeleton, ValidationBadge } from "@/components/ui";
import { formatIssueLocation } from "@/components/validation/validation-utils";
import { resolveSectionForField } from "../issue-section-map";
import {
  getNonemptyEvidenceCategories,
  getNonemptyIssueGroups,
} from "./issue-grouping";
import {
  EVIDENCE_CATEGORY_LABELS,
  ISSUE_GROUP_LABELS,
  type EvidenceIssueCategory,
  type PublishValidationState,
  type PublishWizardIssue,
  type UsePublishReadinessResult,
} from "./types";

function readinessBadgeStatus(status: PublishValidationState["status"]) {
  switch (status) {
    case "ready":
      return "valid" as const;
    case "blocked":
      return "invalid" as const;
    case "pending":
      return "pending" as const;
    default:
      return "pending" as const;
  }
}

function readinessLabel(status: PublishValidationState["status"]) {
  switch (status) {
    case "ready":
      return "Ready";
    case "blocked":
      return "Blocked";
    case "pending":
      return "Pending";
    default:
      return "Unknown";
  }
}

function evidenceCategoryDescription(category: EvidenceIssueCategory): string {
  switch (category) {
    case "blockers":
      return "Error-severity evidence issues that block publish.";
    case "warnings":
      return "Evidence gaps that should be reviewed before publish.";
    case "missing":
      return "Required provenance, attestation, or source metadata.";
    case "lowConfidence":
      return "Assertions with weak or below-threshold confidence scores.";
  }
}

function wizardIssueKey(issue: PublishWizardIssue, index: number): string {
  return [issue.level, issue.message, issue.field ?? "", index].join("|");
}

function IssueRow({
  issue,
  onNavigateSection,
}: {
  issue: PublishWizardIssue;
  onNavigateSection?: (sectionId: string) => void;
}) {
  const location = formatIssueLocation({
    ...issue,
    level: issue.level === "workflow" ? "schema" : issue.level,
  });
  const sectionId = resolveSectionForField(issue.field);

  return (
    <li className="rounded-md border px-3 py-2 text-sm">
      <div className="flex flex-wrap items-center gap-2">
        <span className="rounded bg-muted px-1.5 py-0.5 text-[10px] font-medium uppercase tracking-wide text-muted-foreground">
          {issue.level}
        </span>
        {issue.severity !== "error" && (
          <span className="rounded bg-amber-500/10 px-1.5 py-0.5 text-[10px] font-medium uppercase tracking-wide text-amber-700 dark:text-amber-400">
            {issue.severity}
          </span>
        )}
        {sectionId && onNavigateSection && (
          <Button
            type="button"
            variant="link"
            size="sm"
            className="ml-auto h-auto p-0 text-xs"
            onClick={() => onNavigateSection(sectionId)}
          >
            Go to section
          </Button>
        )}
      </div>
      <p className="mt-1">{issue.message}</p>
      {location && <p className="mt-1 font-mono text-xs text-muted-foreground">{location}</p>}
    </li>
  );
}

interface ValidationReadinessPanelProps {
  readiness: UsePublishReadinessResult;
  onRefresh?: () => void;
  onNavigateSection?: (sectionId: string) => void;
}

export function ValidationReadinessPanel({
  readiness,
  onRefresh,
  onNavigateSection,
}: ValidationReadinessPanelProps) {
  const { validation, loading, validating, error } = readiness;
  const evidence = validation?.evidence;

  return (
    <Card>
      <CardHeader className="pb-3">
        <CardTitle className="flex items-center gap-2 text-base">
          Validation readiness
          {!loading && validation && (
            <ValidationBadge
              status={readinessBadgeStatus(validation.status)}
              label={readinessLabel(validation.status)}
              className="ml-auto"
            />
          )}
          {validating && (
            <span className="ml-auto inline-flex items-center gap-1 text-xs text-muted-foreground">
              <Loader2 className="h-3.5 w-3.5 animate-spin" />
              Checking
            </span>
          )}
        </CardTitle>
        <CardDescription>Package validation and publish gate status.</CardDescription>
      </CardHeader>
      <CardContent className="space-y-4">
        {loading ? (
          <ListSkeleton rows={3} />
        ) : error ? (
          <EmptyState
            title="Validation unavailable"
            description={error.message}
            icon={<AlertTriangle className="h-6 w-6" />}
            className="py-6"
          />
        ) : validation ? (
          <>
            <p className="text-sm text-muted-foreground">{validation.message}</p>
            <dl className="grid gap-2 text-sm sm:grid-cols-2">
              <div className="flex justify-between rounded-md border px-3 py-2">
                <dt className="text-muted-foreground">Blocking errors</dt>
                <dd className="font-semibold tabular-nums">{validation.blockingErrorCount}</dd>
              </div>
              <div className="flex justify-between rounded-md border px-3 py-2">
                <dt className="text-muted-foreground">Evidence blockers</dt>
                <dd className="font-semibold tabular-nums">{evidence?.blockerCount ?? 0}</dd>
              </div>
              <div className="flex justify-between rounded-md border px-3 py-2">
                <dt className="text-muted-foreground">Missing evidence</dt>
                <dd className="font-semibold tabular-nums">{evidence?.missingCount ?? 0}</dd>
              </div>
              <div className="flex justify-between rounded-md border px-3 py-2">
                <dt className="text-muted-foreground">Low-confidence</dt>
                <dd className="font-semibold tabular-nums">{evidence?.lowConfidenceCount ?? 0}</dd>
              </div>
              <div className="flex justify-between rounded-md border px-3 py-2">
                <dt className="text-muted-foreground">Evidence warnings</dt>
                <dd className="font-semibold tabular-nums">{evidence?.warningCount ?? 0}</dd>
              </div>
              <div className="flex justify-between rounded-md border px-3 py-2">
                <dt className="text-muted-foreground">Graph failures</dt>
                <dd className="font-semibold tabular-nums">{validation.graphFailures}</dd>
              </div>
              <div className="flex justify-between rounded-md border px-3 py-2">
                <dt className="text-muted-foreground">Graph pending</dt>
                <dd className="font-semibold tabular-nums">{validation.graphPending}</dd>
              </div>
              <div className="flex justify-between rounded-md border px-3 py-2">
                <dt className="text-muted-foreground">Publish ready</dt>
                <dd className="font-semibold">{validation.publishReady ? "Yes" : "No"}</dd>
              </div>
            </dl>
          </>
        ) : (
          <p className="text-sm text-muted-foreground">Open a workflow to run validation checks.</p>
        )}

        {onRefresh && (
          <Button variant="outline" size="sm" onClick={onRefresh} disabled={loading || validating}>
            <RefreshCw className="h-4 w-4" />
            Refresh validation
          </Button>
        )}

        {validation && !loading && !error ? (
          <EvidenceReadinessPanel readiness={readiness} onNavigateSection={onNavigateSection} embedded />
        ) : null}
      </CardContent>
    </Card>
  );
}

interface EvidenceReadinessPanelProps {
  readiness: UsePublishReadinessResult;
  onNavigateSection?: (sectionId: string) => void;
  /** When true, render without outer card chrome (nested inside validation readiness). */
  embedded?: boolean;
}

export function EvidenceReadinessPanel({
  readiness,
  onNavigateSection,
  embedded = false,
}: EvidenceReadinessPanelProps) {
  const { validation, loading } = readiness;
  const evidenceCategories = validation
    ? getNonemptyEvidenceCategories(validation.evidence.categorized)
    : [];

  const content = loading ? (
    <ListSkeleton rows={4} />
  ) : evidenceCategories.length === 0 ? (
    <EmptyState
      title="No evidence issues"
      description="Validation did not report evidence blockers, warnings, missing metadata, or low-confidence items."
      className="py-6"
    />
  ) : (
    <div className="space-y-4">
      {evidenceCategories.map((category) => (
        <div key={category.id} className="space-y-2">
          <div>
            <p className="text-xs font-medium uppercase tracking-wide text-muted-foreground">
              {EVIDENCE_CATEGORY_LABELS[category.id]}
            </p>
            <p className="text-xs text-muted-foreground">{evidenceCategoryDescription(category.id)}</p>
          </div>
          <ul className="space-y-2">
            {category.issues.map((issue, index) => (
              <IssueRow
                key={wizardIssueKey(issue, index)}
                issue={issue}
                onNavigateSection={onNavigateSection}
              />
            ))}
          </ul>
        </div>
      ))}
    </div>
  );

  if (embedded) {
    return (
      <div className="space-y-3 border-t pt-4">
        <div>
          <p className="text-sm font-medium">Evidence readiness</p>
          <p className="text-xs text-muted-foreground">
            Evidence blockers, warnings, missing metadata, and low-confidence assertions.
          </p>
        </div>
        {content}
      </div>
    );
  }

  return (
    <Card>
      <CardHeader className="pb-3">
        <CardTitle className="text-base">Evidence readiness</CardTitle>
        <CardDescription>
          Evidence blockers, warnings, missing metadata, and low-confidence assertions from validation.
        </CardDescription>
      </CardHeader>
      <CardContent>{content}</CardContent>
    </Card>
  );
}

interface MissingRequirementsPanelProps {
  readiness: UsePublishReadinessResult;
  onNavigateSection?: (sectionId: string) => void;
}

export function MissingRequirementsPanel({ readiness, onNavigateSection }: MissingRequirementsPanelProps) {
  const { validation, loading } = readiness;
  const groups = validation ? getNonemptyIssueGroups(validation.grouped) : [];

  return (
    <Card>
      <CardHeader className="pb-3">
        <CardTitle className="text-base">Missing requirements</CardTitle>
        <CardDescription>Issues that must be resolved before the next workflow step.</CardDescription>
      </CardHeader>
      <CardContent>
        {loading ? (
          <ListSkeleton rows={4} />
        ) : groups.length === 0 ? (
          <EmptyState
            title="No blocking issues"
            description="Validation did not report any missing requirements for the current package."
            className="py-6"
          />
        ) : (
          <div className="space-y-4">
            {groups.map((group) => (
              <div key={group.id} className="space-y-2">
                <p className="text-xs font-medium uppercase tracking-wide text-muted-foreground">
                  {ISSUE_GROUP_LABELS[group.id]}
                </p>
                {group.id === "evidence" ? (
                  <p className="text-xs text-muted-foreground">
                    See the evidence readiness panel for blockers, warnings, missing metadata, and
                    low-confidence items.
                  </p>
                ) : null}
                <ul className="space-y-2">
                  {group.issues.map((issue, index) => (
                    <IssueRow
                      key={wizardIssueKey(issue, index)}
                      issue={issue}
                      onNavigateSection={onNavigateSection}
                    />
                  ))}
                </ul>
              </div>
            ))}
          </div>
        )}
      </CardContent>
    </Card>
  );
}
