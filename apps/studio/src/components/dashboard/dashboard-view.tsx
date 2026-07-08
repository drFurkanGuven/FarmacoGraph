"use client";

import {
  Activity,
  AlertCircle,
  ArrowRight,
  Clock,
  Database,
  GitPullRequest,
  Layers,
  RefreshCw,
  Server,
  ShieldAlert,
  Workflow,
} from "lucide-react";
import Link from "next/link";
import { ValidationBadge } from "@/components/badges";
import { describeAuditEntry, formatRelativeTime, jobStatusLabel } from "@/components/dashboard/dashboard-utils";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Skeleton } from "@/components/ui/skeleton";
import { useDashboard } from "@/lib/hooks/use-dashboard";
import { useAuth } from "@/lib/auth/context";
import { ApiError } from "@/lib/api";
import { DASHBOARD_REFRESH_MS } from "@/lib/api/react-query/config";

function StatCard({
  title,
  value,
  hint,
  loading,
}: {
  title: string;
  value: string | number;
  hint?: string;
  loading?: boolean;
}) {
  return (
    <Card>
      <CardHeader className="pb-2">
        <CardDescription>{title}</CardDescription>
        <CardTitle className="text-2xl font-semibold tabular-nums">
          {loading ? <Skeleton className="h-8 w-20" /> : value}
        </CardTitle>
      </CardHeader>
      {hint && (
        <CardContent className="pt-0 text-xs text-muted-foreground">{hint}</CardContent>
      )}
    </Card>
  );
}

function ErrorPanel({ error, onRetry }: { error: unknown; onRetry?: () => void }) {
  const message = error instanceof ApiError ? error.message : "Failed to load dashboard data";
  return (
    <Card className="border-destructive/40 bg-destructive/5">
      <CardHeader className="flex flex-row items-center justify-between gap-2 pb-2">
        <div className="flex items-center gap-2">
          <AlertCircle className="h-4 w-4 text-destructive" />
          <CardTitle className="text-sm">API error</CardTitle>
        </div>
        {onRetry && (
          <Button variant="outline" size="sm" onClick={onRetry}>
            Retry
          </Button>
        )}
      </CardHeader>
      <CardContent className="text-sm text-muted-foreground">{message}</CardContent>
    </Card>
  );
}

function SectionSkeleton({ rows = 3 }: { rows?: number }) {
  return (
    <div className="space-y-2">
      {Array.from({ length: rows }).map((_, i) => (
        <Skeleton key={i} className="h-10 w-full" />
      ))}
    </div>
  );
}

export function DashboardView() {
  const { activeWorkspace } = useAuth();
  const dashboard = useDashboard(activeWorkspace.slug);
  const data = dashboard.data?.data;
  const loading = dashboard.isLoading;
  const isFetching = dashboard.isFetching && !dashboard.isLoading;

  const publishedCount =
    data?.published_drugs ??
    data?.curriculum?.published_in_graph ??
    data?.curator.recently_published.length ??
    0;
  const pendingReview = data?.curator.queue_counts.review ?? data?.curator.pending_review.length ?? 0;
  const drafts = data?.curator.queue_counts.draft ?? data?.curator.drafts.length ?? 0;
  const completion = data?.curriculum?.completion_pct ?? 0;
  const snapshotTag =
    data?.snapshot.version_tag ??
    data?.health.checks.latest_snapshot ??
    data?.statistics.latest_snapshot ??
    "unpublished";

  return (
    <div className="space-y-6 animate-fade-in">
      <div className="flex flex-col gap-3 md:flex-row md:items-end md:justify-between">
        <div>
          <h2 className="text-2xl font-semibold tracking-tight">Knowledge operations</h2>
          <p className="text-sm text-muted-foreground">
            Live platform metrics from the public API — auto-refreshes every{" "}
            {Math.round(DASHBOARD_REFRESH_MS / 1000)}s.
          </p>
          {dashboard.dataUpdatedAt > 0 && (
            <p className="mt-1 flex items-center gap-1 text-xs text-muted-foreground">
              <Clock className="h-3 w-3" />
              Updated {formatRelativeTime(new Date(dashboard.dataUpdatedAt).toISOString())}
              {isFetching && " · refreshing…"}
            </p>
          )}
        </div>
        <div className="flex flex-wrap gap-2">
          <Button
            variant="outline"
            size="sm"
            onClick={() => dashboard.refetch()}
            disabled={dashboard.isFetching}
          >
            <RefreshCw className={`mr-1 h-4 w-4 ${dashboard.isFetching ? "animate-spin" : ""}`} />
            Refresh
          </Button>
          <Button asChild variant="outline" size="sm">
            <Link href="/validation">Validation Center</Link>
          </Button>
          <Button asChild size="sm">
            <Link href="/knowledge/drugs">
              Browse drugs <ArrowRight className="h-4 w-4" />
            </Link>
          </Button>
        </div>
      </div>

      {dashboard.error && (
        <ErrorPanel error={dashboard.error} onRetry={() => dashboard.refetch()} />
      )}

      <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
        <StatCard title="Published drugs" value={publishedCount} hint="Knowledge graph" loading={loading} />
        <StatCard title="Pending review" value={pendingReview} hint="Curator queue" loading={loading} />
        <StatCard title="Draft workflows" value={drafts} hint="In progress" loading={loading} />
        <StatCard
          title="Module progress"
          value={`${completion}%`}
          hint={data?.module ?? activeWorkspace.name}
          loading={loading}
        />
      </div>

      <div className="grid gap-4 lg:grid-cols-3">
        <Card className="lg:col-span-2">
          <CardHeader>
            <CardTitle className="flex items-center gap-2 text-base">
              <GitPullRequest className="h-4 w-4" /> Curator queue
            </CardTitle>
            <CardDescription>Workflows awaiting review and recently published entities</CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            {loading ? (
              <SectionSkeleton rows={4} />
            ) : data?.curator.pending_review.length ? (
              <ul className="space-y-2">
                {data.curator.pending_review.slice(0, 6).map((item) => (
                  <li
                    key={item.id}
                    className="flex items-center justify-between rounded-md border px-3 py-2 text-sm"
                  >
                    <div>
                      <p className="font-medium">{item.entity_type}</p>
                      <p className="font-mono text-xs text-muted-foreground">
                        {item.entity_label ?? item.entity_id}
                      </p>
                    </div>
                    <ValidationBadge status="pending" />
                  </li>
                ))}
              </ul>
            ) : (
              <p className="text-sm text-muted-foreground">No items in review queue.</p>
            )}

            <div>
              <p className="mb-2 text-xs font-medium uppercase tracking-wide text-muted-foreground">
                Recently published
              </p>
              {loading ? (
                <SectionSkeleton rows={2} />
              ) : data?.curator.recently_published.length ? (
                <ul className="space-y-2">
                  {data.curator.recently_published.slice(0, 5).map((item) => (
                    <li key={item.id} className="rounded-md border px-3 py-2 text-sm">
                      <span className="font-medium">{item.entity_label ?? item.entity_id}</span>
                      {item.entity_slug && (
                        <span className="ml-2 font-mono text-xs text-muted-foreground">
                          {item.entity_slug}
                        </span>
                      )}
                    </li>
                  ))}
                </ul>
              ) : (
                <p className="text-sm text-muted-foreground">No recently published entities.</p>
              )}
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2 text-base">
              <Server className="h-4 w-4" /> System health
            </CardTitle>
          </CardHeader>
          <CardContent className="space-y-3 text-sm">
            {loading ? (
              <SectionSkeleton rows={4} />
            ) : (
              <>
                <div className="flex items-center justify-between">
                  <span className="text-muted-foreground">API</span>
                  <ValidationBadge status={data?.health.status === "ok" ? "valid" : "invalid"} />
                </div>
                <div className="flex items-center justify-between">
                  <span className="text-muted-foreground">PostgreSQL</span>
                  <span>{data?.health.checks.postgresql ?? "—"}</span>
                </div>
                <div className="flex items-center justify-between">
                  <span className="text-muted-foreground">Neo4j</span>
                  <span>{data?.health.checks.neo4j ?? "—"}</span>
                </div>
                <div className="flex items-center justify-between">
                  <span className="text-muted-foreground">Snapshot</span>
                  <span className="font-mono text-xs">{snapshotTag}</span>
                </div>
                {data?.snapshot.released_at && (
                  <div className="flex items-center justify-between">
                    <span className="text-muted-foreground">Released</span>
                    <span className="text-xs">{formatRelativeTime(data.snapshot.released_at)}</span>
                  </div>
                )}
              </>
            )}
          </CardContent>
        </Card>
      </div>

      <div className="grid gap-4 md:grid-cols-2">
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2 text-base">
              <Layers className="h-4 w-4" /> Knowledge statistics
            </CardTitle>
          </CardHeader>
          <CardContent className="grid grid-cols-2 gap-3 text-sm">
            {loading ? (
              <>
                <Skeleton className="h-10" />
                <Skeleton className="h-10" />
                <Skeleton className="h-10" />
                <Skeleton className="h-10" />
              </>
            ) : (
              <>
                <div>
                  <p className="text-muted-foreground">Entities</p>
                  <p className="text-lg font-semibold">{data?.statistics.entity_count ?? 0}</p>
                </div>
                <div>
                  <p className="text-muted-foreground">Relationships</p>
                  <p className="text-lg font-semibold">{data?.statistics.relationship_count ?? 0}</p>
                </div>
                <div>
                  <p className="text-muted-foreground">Evidence</p>
                  <p className="text-lg font-semibold">{data?.statistics.evidence_count ?? 0}</p>
                </div>
                <div>
                  <p className="text-muted-foreground">Ontology</p>
                  <p className="text-lg font-semibold">
                    {data?.ontology_version ?? dashboard.data?.meta.ontology_version ?? "—"}
                  </p>
                </div>
              </>
            )}
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2 text-base">
              <Database className="h-4 w-4" /> Module progress
            </CardTitle>
            <CardDescription>{activeWorkspace.name}</CardDescription>
          </CardHeader>
          <CardContent className="space-y-3 text-sm">
            {loading ? (
              <SectionSkeleton rows={3} />
            ) : data?.curriculum ? (
              <>
                <div className="flex justify-between">
                  <span>Curriculum slugs</span>
                  <span>{data.curriculum.stats.total_slugs ?? 0}</span>
                </div>
                <div className="flex justify-between">
                  <span>Pending curation</span>
                  <span>{data.curriculum.stats.by_status?.pending ?? 0}</span>
                </div>
                <div className="flex justify-between">
                  <span>Published in graph</span>
                  <span>{data.curriculum.published_in_graph ?? 0}</span>
                </div>
                <div className="h-2 overflow-hidden rounded-full bg-muted">
                  <div className="h-full bg-primary transition-all" style={{ width: `${completion}%` }} />
                </div>
              </>
            ) : (
              <p className="text-sm text-muted-foreground">
                No curriculum data for module &ldquo;{data?.module ?? activeWorkspace.slug}&rdquo;.
              </p>
            )}
          </CardContent>
        </Card>
      </div>

      <div className="grid gap-4 md:grid-cols-3">
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2 text-base">
              <ShieldAlert className="h-4 w-4" /> Validation summary
            </CardTitle>
            <CardDescription>Graph validation job failures</CardDescription>
          </CardHeader>
          <CardContent className="space-y-3 text-sm">
            {loading ? (
              <SectionSkeleton rows={3} />
            ) : (
              <>
                <div className="flex justify-between">
                  <span className="text-muted-foreground">Failed validations</span>
                  <span className="font-semibold tabular-nums">{data?.validation.failed_count ?? 0}</span>
                </div>
                {data?.validation.recent_failures.length ? (
                  <ul className="space-y-2">
                    {data.validation.recent_failures.slice(0, 5).map((failure) => (
                      <li key={failure.job_id} className="rounded-md border px-3 py-2">
                        <p className="font-mono text-xs text-muted-foreground">
                          {failure.entity_id ?? failure.job_type}
                        </p>
                        <p className="line-clamp-2 text-xs">{failure.message ?? "Validation failed"}</p>
                      </li>
                    ))}
                  </ul>
                ) : (
                  <p className="text-muted-foreground">No validation failures recorded.</p>
                )}
              </>
            )}
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2 text-base">
              <Activity className="h-4 w-4" /> Recent activity
            </CardTitle>
            <CardDescription>Curator audit timeline</CardDescription>
          </CardHeader>
          <CardContent>
            {loading ? (
              <SectionSkeleton rows={5} />
            ) : data?.activity.length ? (
              <ul className="space-y-2 text-sm">
                {data.activity.slice(0, 8).map((entry) => (
                  <li key={entry.id} className="flex items-start justify-between gap-2 border-b pb-2 last:border-0">
                    <span className="line-clamp-2">{describeAuditEntry(entry)}</span>
                    <span className="shrink-0 text-xs text-muted-foreground">
                      {formatRelativeTime(entry.timestamp)}
                    </span>
                  </li>
                ))}
              </ul>
            ) : (
              <p className="text-sm text-muted-foreground">No recent curator activity.</p>
            )}
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2 text-base">
              <Workflow className="h-4 w-4" /> Background jobs
            </CardTitle>
            <CardDescription>Async graph and validation workers</CardDescription>
          </CardHeader>
          <CardContent className="space-y-3 text-sm">
            {loading ? (
              <SectionSkeleton rows={4} />
            ) : (
              <>
                {Object.keys(data?.jobs.counts ?? {}).length > 0 && (
                  <div className="flex flex-wrap gap-2">
                    {Object.entries(data?.jobs.counts ?? {}).map(([status, count]) => (
                      <span
                        key={status}
                        className="rounded-md border px-2 py-1 text-xs capitalize text-muted-foreground"
                      >
                        {jobStatusLabel(status)}: {count}
                      </span>
                    ))}
                  </div>
                )}
                {data?.jobs.recent.length ? (
                  <ul className="space-y-2">
                    {data.jobs.recent.slice(0, 6).map((job) => (
                      <li key={job.id} className="flex items-center justify-between rounded-md border px-3 py-2">
                        <div>
                          <p className="font-medium">{job.job_type}</p>
                          <p className="text-xs text-muted-foreground">
                            {formatRelativeTime(job.created_at)}
                          </p>
                        </div>
                        <ValidationBadge
                          status={
                            job.status === "completed"
                              ? "valid"
                              : job.status === "failed"
                                ? "invalid"
                                : "pending"
                          }
                        />
                      </li>
                    ))}
                  </ul>
                ) : (
                  <p className="text-muted-foreground">No background jobs in queue.</p>
                )}
              </>
            )}
          </CardContent>
        </Card>
      </div>
    </div>
  );
}
