"use client";

import Link from "next/link";
import { Activity, BriefcaseBusiness, Clock3, DatabaseZap, ExternalLink, Filter } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Skeleton } from "@/components/ui/skeleton";
import { useAuditLogs, useJobs } from "@/lib/api/react-query/hooks";
import type { AuditLogItem, JobItem } from "@/lib/api/types";
import { describeAuditEntry, formatRelativeTime, jobStatusLabel } from "@/components/dashboard/dashboard-utils";

function formatAction(action: string): string {
  return action.replace(/_/g, " ");
}

function resourceHref(entry: AuditLogItem): string | null {
  if (!entry.resource_id) return null;
  if (entry.resource_type.toLowerCase().includes("drug")) {
    return `/knowledge/drugs/${encodeURIComponent(entry.resource_id)}`;
  }
  return null;
}

function ActivityRow({ entry }: { entry: AuditLogItem }) {
  const href = resourceHref(entry);
  return (
    <li className="grid gap-2 border-b py-3 last:border-b-0 md:grid-cols-[1fr_auto] md:items-center">
      <div className="min-w-0 space-y-1">
        <div className="flex min-w-0 flex-wrap items-center gap-2">
          <Badge variant="outline" className="capitalize">
            {formatAction(entry.action)}
          </Badge>
          <p className="min-w-0 truncate text-sm font-medium">{describeAuditEntry(entry)}</p>
        </div>
        <p className="truncate text-xs text-muted-foreground">
          {entry.resource_type}
          {entry.actor_id ? ` by ${entry.actor_id}` : ""}
        </p>
      </div>
      <div className="flex items-center gap-2 text-xs text-muted-foreground">
        <Clock3 className="h-3.5 w-3.5" />
        <span>{formatRelativeTime(entry.timestamp)}</span>
        {href && (
          <Button asChild variant="ghost" size="icon" className="h-7 w-7" aria-label="Open related drug">
            <Link href={href}>
              <ExternalLink className="h-3.5 w-3.5" />
            </Link>
          </Button>
        )}
      </div>
    </li>
  );
}

function JobRow({ job }: { job: JobItem }) {
  return (
    <li className="grid gap-2 border-b py-3 last:border-b-0 md:grid-cols-[1fr_auto] md:items-center">
      <div className="min-w-0">
        <p className="truncate text-sm font-medium">{job.job_type.replace(/_/g, " ")}</p>
        <p className="truncate text-xs text-muted-foreground">{job.error_message ?? "No error reported"}</p>
      </div>
      <div className="flex items-center gap-2">
        <Badge variant={job.status === "failed" ? "danger" : job.status === "completed" ? "success" : "muted"}>
          {jobStatusLabel(job.status)}
        </Badge>
        <span className="text-xs text-muted-foreground">{formatRelativeTime(job.created_at)}</span>
      </div>
    </li>
  );
}

export function ActivityPageView() {
  const auditLogs = useAuditLogs({ limit: 40 });
  const jobs = useJobs({ limit: 8 });
  const entries = auditLogs.data?.data ?? [];
  const recentJobs = jobs.data?.data ?? [];
  const failedJobs = recentJobs.filter((job) => job.status === "failed").length;

  return (
    <div className="mx-auto max-w-6xl space-y-6 animate-fade-in">
      <div className="flex flex-col gap-3 md:flex-row md:items-end md:justify-between">
        <div className="space-y-1">
          <p className="text-xs font-medium uppercase tracking-wide text-muted-foreground">Operations</p>
          <h2 className="text-2xl font-semibold tracking-tight">Activity</h2>
          <p className="max-w-2xl text-sm text-muted-foreground">
            Curator audit trail and background job signals for the live curation path.
          </p>
        </div>
        <div className="flex flex-wrap gap-2">
          <Button asChild variant="outline" size="sm">
            <Link href="/knowledge/drugs">
              <DatabaseZap className="h-4 w-4" />
              Drugs
            </Link>
          </Button>
          <Button asChild variant="outline" size="sm">
            <Link href="/validation">
              <Filter className="h-4 w-4" />
              Validation
            </Link>
          </Button>
        </div>
      </div>

      <div className="grid gap-3 md:grid-cols-3">
        <Card className="rounded-md">
          <CardHeader className="pb-2">
            <CardTitle className="flex items-center gap-2 text-sm">
              <Activity className="h-4 w-4" />
              Audit entries
            </CardTitle>
          </CardHeader>
          <CardContent className="text-2xl font-semibold tabular-nums">
            {auditLogs.isLoading ? <Skeleton className="h-8 w-16" /> : entries.length}
          </CardContent>
        </Card>
        <Card className="rounded-md">
          <CardHeader className="pb-2">
            <CardTitle className="flex items-center gap-2 text-sm">
              <BriefcaseBusiness className="h-4 w-4" />
              Recent jobs
            </CardTitle>
          </CardHeader>
          <CardContent className="text-2xl font-semibold tabular-nums">
            {jobs.isLoading ? <Skeleton className="h-8 w-16" /> : recentJobs.length}
          </CardContent>
        </Card>
        <Card className="rounded-md">
          <CardHeader className="pb-2">
            <CardTitle className="text-sm">Failed jobs</CardTitle>
          </CardHeader>
          <CardContent className="text-2xl font-semibold tabular-nums">{failedJobs}</CardContent>
        </Card>
      </div>

      <div className="grid gap-4 lg:grid-cols-[minmax(0,1fr)_380px]">
        <Card className="rounded-md">
          <CardHeader>
            <CardTitle className="text-base">Audit timeline</CardTitle>
            <CardDescription>Latest API audit-log entries exposed through `GET /audit-logs`.</CardDescription>
          </CardHeader>
          <CardContent>
            {auditLogs.isLoading ? (
              <div className="space-y-3">
                <Skeleton className="h-12 w-full" />
                <Skeleton className="h-12 w-full" />
                <Skeleton className="h-12 w-full" />
              </div>
            ) : entries.length ? (
              <ul>
                {entries.map((entry) => (
                  <ActivityRow key={entry.id} entry={entry} />
                ))}
              </ul>
            ) : (
              <p className="text-sm text-muted-foreground">No audit entries returned yet.</p>
            )}
          </CardContent>
        </Card>

        <Card className="rounded-md">
          <CardHeader>
            <CardTitle className="text-base">Background jobs</CardTitle>
            <CardDescription>Recent graph, validation, and snapshot work from `GET /jobs`.</CardDescription>
          </CardHeader>
          <CardContent>
            {jobs.isLoading ? (
              <div className="space-y-3">
                <Skeleton className="h-12 w-full" />
                <Skeleton className="h-12 w-full" />
              </div>
            ) : recentJobs.length ? (
              <ul>
                {recentJobs.map((job) => (
                  <JobRow key={job.id} job={job} />
                ))}
              </ul>
            ) : (
              <p className="text-sm text-muted-foreground">No background jobs returned yet.</p>
            )}
          </CardContent>
        </Card>
      </div>
    </div>
  );
}
