"use client";

import { AlertCircle, ArrowRight, Database, GitPullRequest, Layers, Server } from "lucide-react";
import Link from "next/link";
import { ValidationBadge } from "@/components/badges";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Skeleton } from "@/components/ui/skeleton";
import {
  useCuratorQueue,
  useCurriculum,
  useHealth,
  useInfo,
  usePublishedDrugs,
  useStatistics,
} from "@/lib/hooks/use-dashboard";
import { useAuth } from "@/lib/auth/context";
import { ApiError } from "@/lib/api";

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

function ErrorPanel({ error }: { error: unknown }) {
  const message = error instanceof ApiError ? error.message : "Failed to load data";
  return (
    <Card className="border-destructive/40 bg-destructive/5">
      <CardHeader className="flex flex-row items-center gap-2 pb-2">
        <AlertCircle className="h-4 w-4 text-destructive" />
        <CardTitle className="text-sm">API error</CardTitle>
      </CardHeader>
      <CardContent className="text-sm text-muted-foreground">{message}</CardContent>
    </Card>
  );
}

export function DashboardView() {
  const { activeWorkspace } = useAuth();
  const health = useHealth();
  const info = useInfo();
  const stats = useStatistics();
  const curriculum = useCurriculum(activeWorkspace.slug === "default" ? "cardiovascular" : activeWorkspace.slug);
  const reviewQueue = useCuratorQueue("review");
  const draftQueue = useCuratorQueue("draft");
  const published = usePublishedDrugs("cardiovascular");

  const loading =
    health.isLoading || info.isLoading || stats.isLoading || curriculum.isLoading;

  const publishedCount = info.data?.data.published_drugs ?? published.data?.data.length ?? 0;
  const pendingReview = reviewQueue.data?.data.length ?? 0;
  const drafts = draftQueue.data?.data.length ?? 0;
  const completion = curriculum.data?.data.completion_pct ?? 0;

  return (
    <div className="space-y-6 animate-fade-in">
      <div className="flex flex-col gap-3 md:flex-row md:items-end md:justify-between">
        <div>
          <h2 className="text-2xl font-semibold tracking-tight">Knowledge operations</h2>
          <p className="text-sm text-muted-foreground">
            Live platform metrics from the public API — no direct database access.
          </p>
        </div>
        <div className="flex flex-wrap gap-2">
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

      {(health.error || info.error) && <ErrorPanel error={health.error ?? info.error} />}

      <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
        <StatCard title="Published drugs" value={publishedCount} hint="Neo4j graph" loading={loading} />
        <StatCard title="Pending review" value={pendingReview} hint="Curator queue" loading={loading} />
        <StatCard title="Draft workflows" value={drafts} hint="In progress" loading={loading} />
        <StatCard title="Module progress" value={`${completion}%`} hint="CV curriculum" loading={loading} />
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
            {reviewQueue.isLoading ? (
              <Skeleton className="h-24 w-full" />
            ) : reviewQueue.data?.data.length ? (
              <ul className="space-y-2">
                {reviewQueue.data.data.slice(0, 6).map((item) => (
                  <li
                    key={item.id}
                    className="flex items-center justify-between rounded-md border px-3 py-2 text-sm"
                  >
                    <div>
                      <p className="font-medium">{item.entity_type}</p>
                      <p className="font-mono text-xs text-muted-foreground">{item.entity_id}</p>
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
              {published.isLoading ? (
                <Skeleton className="h-16 w-full" />
              ) : published.data?.data.length ? (
                <ul className="space-y-2">
                  {published.data.data.slice(0, 5).map((drug) => (
                    <li key={drug.id} className="rounded-md border px-3 py-2 text-sm">
                      <span className="font-medium">{drug.label}</span>
                      <span className="ml-2 font-mono text-xs text-muted-foreground">{drug.slug}</span>
                    </li>
                  ))}
                </ul>
              ) : (
                <p className="text-sm text-muted-foreground">
                  No published drugs yet. Use Curation Studio editors (Phase 4.2+) — not manual JSON.
                </p>
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
            {health.isLoading ? (
              <Skeleton className="h-28 w-full" />
            ) : (
              <>
                <div className="flex items-center justify-between">
                  <span className="text-muted-foreground">API</span>
                  <ValidationBadge status={health.data?.data.status === "ok" ? "valid" : "invalid"} />
                </div>
                <div className="flex items-center justify-between">
                  <span className="text-muted-foreground">PostgreSQL</span>
                  <span>{health.data?.data.checks.postgresql ?? "—"}</span>
                </div>
                <div className="flex items-center justify-between">
                  <span className="text-muted-foreground">Neo4j</span>
                  <span>{health.data?.data.checks.neo4j ?? "—"}</span>
                </div>
                <div className="flex items-center justify-between">
                  <span className="text-muted-foreground">Snapshot</span>
                  <span className="font-mono text-xs">
                    {health.data?.data.checks.latest_snapshot ?? info.data?.data.dataset_version ?? "unpublished"}
                  </span>
                </div>
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
            {stats.isLoading ? (
              <>
                <Skeleton className="h-10" />
                <Skeleton className="h-10" />
              </>
            ) : (
              <>
                <div>
                  <p className="text-muted-foreground">Entities</p>
                  <p className="text-lg font-semibold">{stats.data?.data.entity_count ?? 0}</p>
                </div>
                <div>
                  <p className="text-muted-foreground">Relationships</p>
                  <p className="text-lg font-semibold">{stats.data?.data.relationship_count ?? 0}</p>
                </div>
                <div>
                  <p className="text-muted-foreground">Evidence</p>
                  <p className="text-lg font-semibold">{stats.data?.data.evidence_count ?? 0}</p>
                </div>
                <div>
                  <p className="text-muted-foreground">Ontology</p>
                  <p className="text-lg font-semibold">{info.data?.data.ontology_version ?? "—"}</p>
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
            {curriculum.isLoading ? (
              <Skeleton className="h-20 w-full" />
            ) : (
              <>
                <div className="flex justify-between">
                  <span>Curriculum slugs</span>
                  <span>{curriculum.data?.data.stats.total_slugs ?? 0}</span>
                </div>
                <div className="flex justify-between">
                  <span>Pending curation</span>
                  <span>{curriculum.data?.data.stats.by_status?.pending ?? 0}</span>
                </div>
                <div className="flex justify-between">
                  <span>Published in graph</span>
                  <span>{curriculum.data?.data.published_in_graph ?? 0}</span>
                </div>
                <div className="h-2 overflow-hidden rounded-full bg-muted">
                  <div className="h-full bg-primary transition-all" style={{ width: `${completion}%` }} />
                </div>
              </>
            )}
          </CardContent>
        </Card>
      </div>

      <Card>
        <CardHeader>
          <CardTitle className="text-base">Coming in Phase 4.2+</CardTitle>
          <CardDescription>Placeholder integrations wired on the dashboard</CardDescription>
        </CardHeader>
        <CardContent className="grid gap-3 text-sm text-muted-foreground md:grid-cols-3">
          <div>
            <p className="font-medium text-foreground">Validation failures</p>
            <p>API endpoint planned — center page is a placeholder.</p>
          </div>
          <div>
            <p className="font-medium text-foreground">Recent activity</p>
            <p>Audit timeline will surface curator events from PostgreSQL.</p>
          </div>
          <div>
            <p className="font-medium text-foreground">Background jobs</p>
            <p>Graph validation jobs will appear when job API ships.</p>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}
