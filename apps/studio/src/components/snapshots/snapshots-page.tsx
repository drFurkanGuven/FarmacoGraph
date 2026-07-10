"use client";

import Link from "next/link";
import { Suspense, useMemo, useState } from "react";
import { useSearchParams } from "next/navigation";
import { Camera, CheckCircle2, Clock3, Database, GitBranch, Rocket } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { ErrorState } from "@/components/ui/error-state";
import { Skeleton } from "@/components/ui/skeleton";
import {
  useCuratorQueue,
  useDashboard,
  useDrugWorkflowState,
  useSnapshot,
  useSnapshots,
} from "@/lib/api/react-query/hooks";
import type { SnapshotItem } from "@/lib/api";
import { formatRelativeTime } from "@/components/dashboard/dashboard-utils";
import { cn } from "@/lib/utils";

function snapshotStatusVariant(status: string): "success" | "muted" | "warning" {
  if (status === "published" || status === "released") return "success";
  if (status === "staged") return "warning";
  return "muted";
}

function SnapshotMetrics({
  latestVersion,
  entityCount,
  publishedCount,
  loading,
}: {
  latestVersion: string | null;
  entityCount: number;
  publishedCount: number;
  loading: boolean;
}) {
  return (
    <div className="grid gap-3 md:grid-cols-3">
      <Card className="rounded-md">
        <CardHeader className="pb-2">
          <CardTitle className="flex items-center gap-2 text-sm">
            <Camera className="h-4 w-4" />
            Latest snapshot
          </CardTitle>
        </CardHeader>
        <CardContent>
          {loading ? (
            <Skeleton className="h-8 w-28" />
          ) : (
            <p className="truncate text-2xl font-semibold">{latestVersion ?? "None"}</p>
          )}
        </CardContent>
      </Card>
      <Card className="rounded-md">
        <CardHeader className="pb-2">
          <CardTitle className="flex items-center gap-2 text-sm">
            <Database className="h-4 w-4" />
            Entity count
          </CardTitle>
        </CardHeader>
        <CardContent className="text-2xl font-semibold tabular-nums">
          {loading ? <Skeleton className="h-8 w-20" /> : entityCount}
        </CardContent>
      </Card>
      <Card className="rounded-md">
        <CardHeader className="pb-2">
          <CardTitle className="flex items-center gap-2 text-sm">
            <CheckCircle2 className="h-4 w-4" />
            Published workflows
          </CardTitle>
        </CardHeader>
        <CardContent className="text-2xl font-semibold tabular-nums">
          {loading ? <Skeleton className="h-8 w-16" /> : publishedCount}
        </CardContent>
      </Card>
    </div>
  );
}

function SnapshotDetailPanel({ item, loading }: { item: SnapshotItem | null; loading: boolean }) {
  if (loading) {
    return (
      <div className="space-y-3">
        <Skeleton className="h-6 w-40" />
        <Skeleton className="h-24 w-full" />
        <Skeleton className="h-48 w-full" />
      </div>
    );
  }

  if (!item) {
    return (
      <p className="text-sm text-muted-foreground">
        Select a snapshot from the list to inspect release metadata and manifest JSON.
      </p>
    );
  }

  return (
    <div className="space-y-4">
      <div className="flex flex-wrap items-center gap-2">
        <h3 className="font-mono text-sm font-semibold">{item.version_tag}</h3>
        <Badge variant={snapshotStatusVariant(item.status)}>{item.status}</Badge>
      </div>
      <dl className="grid gap-2 text-sm">
        <div className="flex justify-between gap-3">
          <dt className="text-muted-foreground">Module</dt>
          <dd>{item.module ?? "—"}</dd>
        </div>
        <div className="flex justify-between gap-3">
          <dt className="text-muted-foreground">Released</dt>
          <dd>{formatRelativeTime(item.released_at)}</dd>
        </div>
        <div className="flex justify-between gap-3">
          <dt className="text-muted-foreground">Entities</dt>
          <dd className="tabular-nums">{item.entity_count}</dd>
        </div>
        <div className="flex justify-between gap-3">
          <dt className="text-muted-foreground">Relationships</dt>
          <dd className="tabular-nums">{item.relationship_count}</dd>
        </div>
        <div className="flex justify-between gap-3">
          <dt className="text-muted-foreground">Evidence</dt>
          <dd className="tabular-nums">{item.evidence_count}</dd>
        </div>
        <div className="flex justify-between gap-3">
          <dt className="text-muted-foreground">Ontology</dt>
          <dd className="font-mono text-xs">{item.ontology_version}</dd>
        </div>
      </dl>
      <div className="space-y-2">
        <p className="text-xs font-medium uppercase tracking-wide text-muted-foreground">Manifest JSON</p>
        <pre className="max-h-72 overflow-auto rounded-md border bg-muted/30 p-3 text-xs leading-relaxed">
          {JSON.stringify(item.manifest, null, 2)}
        </pre>
      </div>
    </div>
  );
}

function SnapshotsPageContent() {
  const searchParams = useSearchParams();
  const drugSlug = searchParams.get("drug")?.trim() ?? "";
  const [selectedVersion, setSelectedVersion] = useState<string | null>(null);

  const dashboard = useDashboard();
  const published = useCuratorQueue("published");
  const snapshots = useSnapshots({ limit: 100 });
  const drugWorkflow = useDrugWorkflowState(drugSlug);
  const selectedSnapshot = useSnapshot(selectedVersion ?? "");

  const snapshotRows = snapshots.data?.data ?? [];
  const dashboardSnapshot = dashboard.data?.data?.snapshot;
  const recentPublished = published.data?.data ?? dashboard.data?.data?.curator.recently_published ?? [];

  const latestRow = snapshotRows[0] ?? null;
  const latestVersion = latestRow?.version_tag ?? dashboardSnapshot?.version_tag ?? null;
  const latestEntityCount = latestRow?.entity_count ?? dashboardSnapshot?.entity_count ?? 0;

  const activeVersion = selectedVersion ?? latestRow?.version_tag ?? null;
  const activeDetail = useMemo(() => {
    if (selectedVersion) {
      return selectedSnapshot.data?.data ?? snapshotRows.find((row) => row.version_tag === selectedVersion) ?? null;
    }
    return latestRow;
  }, [latestRow, selectedSnapshot.data?.data, selectedVersion, snapshotRows]);

  const drugWorkflowSnapshot = drugWorkflow.data?.data?.snapshot ?? null;
  const loading = snapshots.isLoading || dashboard.isLoading;

  if (snapshots.error) {
    return (
      <ErrorState
        title="Unable to load snapshots"
        message={snapshots.error instanceof Error ? snapshots.error.message : "Snapshot API request failed."}
        onRetry={() => snapshots.refetch()}
      />
    );
  }

  return (
    <div className="mx-auto max-w-6xl space-y-6 animate-fade-in">
      <div className="flex flex-col gap-3 md:flex-row md:items-end md:justify-between">
        <div className="space-y-1">
          <p className="text-xs font-medium uppercase tracking-wide text-muted-foreground">Release operations</p>
          <h2 className="text-2xl font-semibold tracking-tight">Snapshots</h2>
          <p className="max-w-2xl text-sm text-muted-foreground">
            Read-only release manifests from publish workflows. Diff views and release-note tooling remain deferred.
          </p>
        </div>
        <div className="flex flex-wrap gap-2">
          <Button asChild variant="outline" size="sm">
            <Link href="/knowledge/drugs">
              <Rocket className="h-4 w-4" />
              Open drug queue
            </Link>
          </Button>
          <Button asChild variant="outline" size="sm">
            <Link href="/activity">
              <Clock3 className="h-4 w-4" />
              Activity
            </Link>
          </Button>
        </div>
      </div>

      <SnapshotMetrics
        latestVersion={latestVersion}
        entityCount={latestEntityCount}
        publishedCount={recentPublished.length}
        loading={loading}
      />

      {drugSlug ? (
        <div className="rounded-md border bg-muted/20 px-4 py-3 text-sm">
          <p className="font-medium">Drug workflow snapshot — {drugSlug}</p>
          {drugWorkflow.isLoading ? (
            <p className="mt-1 text-muted-foreground">Loading workflow state…</p>
          ) : drugWorkflowSnapshot?.version_tag ? (
            <p className="mt-1 text-muted-foreground">
              Latest linked snapshot:{" "}
              <button
                type="button"
                className="font-mono text-foreground underline-offset-2 hover:underline"
                onClick={() => setSelectedVersion(drugWorkflowSnapshot.version_tag)}
              >
                {drugWorkflowSnapshot.version_tag}
              </button>
              {drugWorkflowSnapshot.status ? ` (${drugWorkflowSnapshot.status})` : ""}
            </p>
          ) : (
            <p className="mt-1 text-muted-foreground">
              No snapshot linked yet. Publish this drug with <code>create_snapshot</code> to attach release metadata.
            </p>
          )}
        </div>
      ) : null}

      <div className="grid gap-4 lg:grid-cols-[minmax(0,1fr)_minmax(0,1.1fr)]">
        <section className="rounded-md border">
          <div className="border-b px-4 py-3">
            <h3 className="text-sm font-semibold">Snapshot list</h3>
            <p className="text-xs text-muted-foreground">Ordered by newest release first.</p>
          </div>
          <div className="max-h-[28rem] overflow-auto">
            {loading ? (
              <div className="space-y-3 p-4">
                <Skeleton className="h-10 w-full" />
                <Skeleton className="h-10 w-full" />
                <Skeleton className="h-10 w-full" />
              </div>
            ) : snapshotRows.length ? (
              <ul>
                {snapshotRows.map((row) => {
                  const isActive = row.version_tag === activeVersion;
                  return (
                    <li key={row.id} className="border-b last:border-b-0">
                      <button
                        type="button"
                        onClick={() => setSelectedVersion(row.version_tag)}
                        className={cn(
                          "flex w-full items-start justify-between gap-3 px-4 py-3 text-left transition-colors hover:bg-muted/40",
                          isActive && "bg-muted/50",
                        )}
                      >
                        <span className="min-w-0">
                          <span className="block truncate font-mono text-sm">{row.version_tag}</span>
                          <span className="block truncate text-xs text-muted-foreground">
                            {row.module ?? "module unknown"} · {formatRelativeTime(row.released_at)}
                          </span>
                        </span>
                        <Badge variant={snapshotStatusVariant(row.status)}>{row.status}</Badge>
                      </button>
                    </li>
                  );
                })}
              </ul>
            ) : (
              <p className="p-4 text-sm text-muted-foreground">
                No snapshots recorded yet. Publish a drug with snapshot creation enabled to populate this list.
              </p>
            )}
          </div>
        </section>

        <section className="rounded-md border p-4">
          <h3 className="mb-3 text-sm font-semibold">Snapshot detail</h3>
          <SnapshotDetailPanel
            item={activeDetail}
            loading={Boolean(selectedVersion) && selectedSnapshot.isLoading}
          />
        </section>
      </div>

      <section className="rounded-md border">
        <div className="border-b px-4 py-3">
          <h3 className="text-sm font-semibold">Recently published drugs</h3>
          <p className="text-xs text-muted-foreground">Return to the source Drug Editor workflow.</p>
        </div>
        <div className="p-4">
          {published.isLoading || dashboard.isLoading ? (
            <div className="space-y-3">
              <Skeleton className="h-12 w-full" />
              <Skeleton className="h-12 w-full" />
            </div>
          ) : recentPublished.length ? (
            <ul>
              {recentPublished.map((workflow) => (
                <li
                  key={workflow.id}
                  className="grid gap-2 border-b py-3 last:border-b-0 md:grid-cols-[1fr_auto] md:items-center"
                >
                  <div className="min-w-0">
                    <p className="truncate text-sm font-medium">
                      {workflow.entity_label ?? workflow.entity_slug ?? workflow.entity_id}
                    </p>
                    <p className="truncate text-xs text-muted-foreground">{workflow.id}</p>
                  </div>
                  <Button asChild variant="ghost" size="sm">
                    <Link
                      href={`/knowledge/drugs/${encodeURIComponent(workflow.entity_slug ?? workflow.entity_id)}`}
                    >
                      <GitBranch className="h-4 w-4" />
                      Editor
                    </Link>
                  </Button>
                </li>
              ))}
            </ul>
          ) : (
            <p className="text-sm text-muted-foreground">No published workflows returned yet.</p>
          )}
        </div>
      </section>
    </div>
  );
}

export function SnapshotsPageView() {
  return (
    <Suspense fallback={<Skeleton className="h-40 w-full" />}>
      <SnapshotsPageContent />
    </Suspense>
  );
}
