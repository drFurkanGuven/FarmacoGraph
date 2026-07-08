"use client";

import { Clock, RefreshCw, ShieldCheck } from "lucide-react";
import { formatRelativeTime, jobStatusLabel } from "@/components/dashboard/dashboard-utils";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
  ErrorState,
  ListSkeleton,
  Timeline,
} from "@/components/ui";
import { Button } from "@/components/ui/button";
import { ApiError } from "@/lib/api";
import { DASHBOARD_REFRESH_MS } from "@/lib/api/react-query/config";
import { PublishReadinessPanel } from "./publish-readiness-panel";
import {
  useGraphValidationJobs,
  useQueueValidation,
  useValidationSummary,
} from "./validation-hooks";
import { ValidationIssueSection } from "./validation-issue-section";
import {
  aggregateQueueIssues,
  categorizeIssues,
  computePublishReadiness,
} from "./validation-utils";

function GraphValidationTimeline({
  loading,
  failures,
}: {
  loading?: boolean;
  failures: Array<{
    job_id?: string;
    entity_id?: string | null;
    message?: string | null;
    at?: string | null;
  }>;
}) {
  return (
    <Card>
      <CardHeader>
        <CardTitle className="text-base">Graph validation failures</CardTitle>
        <CardDescription>Recent post-publish integrity checks from graph validation jobs.</CardDescription>
      </CardHeader>
      <CardContent>
        {loading ? (
          <ListSkeleton rows={4} />
        ) : failures.length > 0 ? (
          <Timeline
            items={failures.map((failure) => ({
              id: failure.job_id ?? failure.entity_id ?? failure.message ?? "failure",
              title: failure.entity_id ?? "Graph validation",
              description: failure.message ?? "Validation failed",
              timestamp: formatRelativeTime(failure.at),
            }))}
          />
        ) : (
          <p className="text-sm text-muted-foreground">No graph validation failures recorded.</p>
        )}
      </CardContent>
    </Card>
  );
}

export function ValidationCenterView() {
  const summaryQuery = useValidationSummary();
  const jobsQuery = useGraphValidationJobs();
  const queueQuery = useQueueValidation();

  const loading = summaryQuery.isLoading || jobsQuery.isLoading || queueQuery.isLoading;
  const isFetching = (summaryQuery.isFetching || jobsQuery.isFetching || queueQuery.isFetching) && !loading;

  const error = summaryQuery.error ?? jobsQuery.error ?? queueQuery.error;

  const queueItems = queueQuery.data?.data.items ?? [];
  const queueIssues = aggregateQueueIssues(queueItems);
  const categorized = categorizeIssues(queueIssues);
  const summary = summaryQuery.data?.data;
  const readiness = computePublishReadiness(summary, queueItems, categorized);

  const failedJobs = jobsQuery.data?.data.filter((job) => job.status === "failed") ?? [];
  const pendingJobs = jobsQuery.data?.data.filter((job) => job.status === "pending" || job.status === "running") ?? [];

  const refetchAll = () => {
    void summaryQuery.refetch();
    void jobsQuery.refetch();
    void queueQuery.refetch();
  };

  return (
    <div className="space-y-6 animate-fade-in">
      <div className="flex flex-col gap-3 md:flex-row md:items-end md:justify-between">
        <div>
          <h2 className="flex items-center gap-2 text-2xl font-semibold tracking-tight">
            <ShieldCheck className="h-6 w-6" />
            Validation Center
          </h2>
          <p className="text-sm text-muted-foreground">
            Live validation from curator dry-runs and graph validation jobs — refreshes every{" "}
            {Math.round(DASHBOARD_REFRESH_MS / 1000)}s.
          </p>
          {summaryQuery.dataUpdatedAt > 0 && (
            <p className="mt-1 flex items-center gap-1 text-xs text-muted-foreground">
              <Clock className="h-3 w-3" />
              Updated {formatRelativeTime(new Date(summaryQuery.dataUpdatedAt).toISOString())}
              {isFetching && " · refreshing…"}
            </p>
          )}
        </div>
        <Button variant="outline" size="sm" onClick={refetchAll} disabled={isFetching}>
          <RefreshCw className={`mr-1 h-4 w-4 ${isFetching ? "animate-spin" : ""}`} />
          Refresh
        </Button>
      </div>

      {error && (
        <ErrorState
          title="Failed to load validation data"
          message={error instanceof ApiError ? error.message : "An unexpected error occurred."}
          onRetry={refetchAll}
        />
      )}

      <div className="grid gap-4 lg:grid-cols-3">
        <Card>
          <CardHeader className="pb-2">
            <CardDescription>Graph validation failures</CardDescription>
            <CardTitle className="text-2xl font-semibold tabular-nums">
              {loading ? "—" : (summary?.failed_count ?? 0)}
            </CardTitle>
          </CardHeader>
        </Card>
        <Card>
          <CardHeader className="pb-2">
            <CardDescription>Pending graph jobs</CardDescription>
            <CardTitle className="text-2xl font-semibold tabular-nums">
              {loading ? "—" : (summary?.pending_count ?? pendingJobs.length)}
            </CardTitle>
          </CardHeader>
        </Card>
        <Card>
          <CardHeader className="pb-2">
            <CardDescription>Publish blocking errors</CardDescription>
            <CardTitle className="text-2xl font-semibold tabular-nums">
              {loading ? "—" : categorized.errors.length}
            </CardTitle>
          </CardHeader>
        </Card>
      </div>

      <div className="grid gap-4 xl:grid-cols-2">
        <PublishReadinessPanel readiness={readiness} queueItems={queueItems} loading={loading} />
        <GraphValidationTimeline loading={loading} failures={summary?.recent_failures ?? []} />
      </div>

      <div className="grid gap-4 xl:grid-cols-2">
        <ValidationIssueSection
          title="Errors"
          description="Blocking validation issues from curator queue dry-runs."
          issues={categorized.errors}
          loading={loading}
          emptyTitle="No errors"
          emptyDescription="Queue packages passed error-level validation checks."
          icon="error"
        />
        <ValidationIssueSection
          title="Warnings"
          description="Non-blocking issues that may need curator attention."
          issues={categorized.warnings}
          loading={loading}
          emptyTitle="No warnings"
          emptyDescription="No warning-level issues in the current queue."
          icon="warning"
        />
        <ValidationIssueSection
          title="Ontology violations"
          description="Relationship semantics and ontology constraint failures."
          issues={categorized.ontologyViolations}
          loading={loading}
          emptyTitle="No ontology violations"
          emptyDescription="Relationship types and entity pairings match the ontology."
          icon="ontology"
        />
        <ValidationIssueSection
          title="Missing evidence"
          description="Provenance, attestation, and evidence metadata gaps."
          issues={categorized.missingEvidence}
          loading={loading}
          emptyTitle="No evidence gaps"
          emptyDescription="Required provenance and evidence fields are present."
          icon="evidence"
        />
      </div>

      {failedJobs.length > 0 && (
        <Card>
          <CardHeader>
            <CardTitle className="text-base">Failed graph validation jobs</CardTitle>
            <CardDescription>Worker jobs with status failed.</CardDescription>
          </CardHeader>
          <CardContent>
            <ul className="space-y-2 text-sm">
              {failedJobs.map((job) => (
                <li key={job.id} className="rounded-md border px-3 py-2">
                  <div className="flex flex-wrap items-center justify-between gap-2">
                    <span className="font-mono text-xs text-muted-foreground">{job.id}</span>
                    <span className="text-xs text-muted-foreground">{jobStatusLabel(job.status)}</span>
                  </div>
                  <p className="mt-1 line-clamp-2">{job.error_message ?? "Validation failed"}</p>
                  <p className="mt-1 text-xs text-muted-foreground">
                    {formatRelativeTime(job.completed_at)}
                  </p>
                </li>
              ))}
            </ul>
          </CardContent>
        </Card>
      )}
    </div>
  );
}
