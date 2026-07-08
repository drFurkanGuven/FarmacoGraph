"use client";

import Link from "next/link";
import { Camera, CheckCircle2, Clock3, Database, GitBranch, Rocket } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Skeleton } from "@/components/ui/skeleton";
import { useCuratorQueue, useDashboard } from "@/lib/api/react-query/hooks";
import { formatRelativeTime } from "@/components/dashboard/dashboard-utils";

export function SnapshotsPageView() {
  const dashboard = useDashboard();
  const published = useCuratorQueue("published");
  const snapshot = dashboard.data?.data?.snapshot;
  const recentPublished = published.data?.data ?? dashboard.data?.data?.curator.recently_published ?? [];

  return (
    <div className="mx-auto max-w-6xl space-y-6 animate-fade-in">
      <div className="flex flex-col gap-3 md:flex-row md:items-end md:justify-between">
        <div className="space-y-1">
          <p className="text-xs font-medium uppercase tracking-wide text-muted-foreground">Release operations</p>
          <h2 className="text-2xl font-semibold tracking-tight">Snapshots</h2>
          <p className="max-w-2xl text-sm text-muted-foreground">
            Snapshot status is created by the publish workflow. Dedicated diff and release-note tools remain planned.
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

      <div className="grid gap-3 md:grid-cols-3">
        <Card className="rounded-md">
          <CardHeader className="pb-2">
            <CardTitle className="flex items-center gap-2 text-sm">
              <Camera className="h-4 w-4" />
              Latest snapshot
            </CardTitle>
          </CardHeader>
          <CardContent>
            {dashboard.isLoading ? (
              <Skeleton className="h-8 w-28" />
            ) : (
              <p className="truncate text-2xl font-semibold">{snapshot?.version_tag ?? "None"}</p>
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
            {dashboard.isLoading ? <Skeleton className="h-8 w-20" /> : (snapshot?.entity_count ?? 0)}
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
            {published.isLoading ? <Skeleton className="h-8 w-16" /> : recentPublished.length}
          </CardContent>
        </Card>
      </div>

      <div className="grid gap-4 lg:grid-cols-[420px_minmax(0,1fr)]">
        <Card className="rounded-md">
          <CardHeader>
            <CardTitle className="text-base">Current release marker</CardTitle>
            <CardDescription>Read from the dashboard snapshot summary.</CardDescription>
          </CardHeader>
          <CardContent className="space-y-3 text-sm">
            <div className="flex items-center justify-between gap-3">
              <span className="text-muted-foreground">Status</span>
              <Badge variant={snapshot?.status === "released" ? "success" : "muted"}>
                {snapshot?.status ?? "not available"}
              </Badge>
            </div>
            <div className="flex items-center justify-between gap-3">
              <span className="text-muted-foreground">Released</span>
              <span>{formatRelativeTime(snapshot?.released_at)}</span>
            </div>
            <div className="flex items-center justify-between gap-3">
              <span className="text-muted-foreground">Module</span>
              <span>{dashboard.data?.data?.module ?? "cardiovascular"}</span>
            </div>
            <p className="rounded-md border bg-muted/30 p-3 text-xs leading-relaxed text-muted-foreground">
              Publish from the Drug Editor to create or update snapshot metadata. A full snapshot manager with
              release diffs is intentionally deferred until a public snapshot HTTP API exists.
            </p>
          </CardContent>
        </Card>

        <Card className="rounded-md">
          <CardHeader>
            <CardTitle className="text-base">Recently published drugs</CardTitle>
            <CardDescription>Use these rows to return to the source Drug Editor workflow.</CardDescription>
          </CardHeader>
          <CardContent>
            {published.isLoading || dashboard.isLoading ? (
              <div className="space-y-3">
                <Skeleton className="h-12 w-full" />
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
                      <Link href={`/knowledge/drugs/${encodeURIComponent(workflow.entity_slug ?? workflow.entity_id)}`}>
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
          </CardContent>
        </Card>
      </div>
    </div>
  );
}
