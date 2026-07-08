"use client";

import { useMemo } from "react";
import {
  Activity,
  GitBranch,
  HeartPulse,
  Loader2,
  Network,
  ShieldCheck,
  Workflow,
} from "lucide-react";
import { ValidationBadge } from "@/components/ui";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { EmptyState } from "@/components/ui/empty-state";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Separator } from "@/components/ui/separator";
import { StatusBadge } from "@/components/ui/status-badge";
import { useAuditLogs, useExplain } from "@/lib/hooks/use-dashboard";
import { relationshipCounts } from "./package";
import type { DrugEditorSnapshot } from "./types";

export interface DrugContextPanelProps {
  snapshot: DrugEditorSnapshot;
  className?: string;
}

function ContextMetric({
  icon,
  label,
  value,
}: {
  icon: React.ReactNode;
  label: string;
  value: string | number;
}) {
  return (
    <div className="flex items-start gap-3 rounded-lg border bg-card/60 p-3">
      <div className="mt-0.5 text-muted-foreground">{icon}</div>
      <div>
        <p className="text-xs text-muted-foreground">{label}</p>
        <p className="text-sm font-medium">{value}</p>
      </div>
    </div>
  );
}

export function DrugContextPanel({ snapshot, className }: DrugContextPanelProps) {
  const slug = String(snapshot.package.entity_payload.slug ?? "");
  const counts = useMemo(() => relationshipCounts(snapshot.package), [snapshot.package]);
  const auditQuery = useAuditLogs({ resourceType: "Drug", limit: 20 });
  const explainQuery = useExplain(slug, undefined);

  const recentActivity = useMemo(() => {
    return (auditQuery.data?.data ?? []).filter((entry) => entry.resource_id === snapshot.drugId).slice(0, 5);
  }, [auditQuery.data?.data, snapshot.drugId]);

  const validationStatus = snapshot.validationPending
    ? "pending"
    : snapshot.validation?.valid
      ? "valid"
      : snapshot.validation
        ? "invalid"
        : "pending";

  return (
    <aside className={className}>
      <ScrollArea className="h-full">
        <div className="space-y-4 p-4">
          <div>
            <p className="text-xs font-medium uppercase tracking-wide text-muted-foreground">Live context</p>
            <h3 className="text-base font-semibold">
              {String(snapshot.package.entity_payload.label || snapshot.package.entity_payload.generic_name || "Untitled drug")}
            </h3>
          </div>

          <Card>
            <CardHeader className="pb-3">
              <CardTitle className="flex items-center gap-2 text-sm">
                <Workflow className="h-4 w-4" />
                Workflow
              </CardTitle>
              <CardDescription>Curator draft state for this entity.</CardDescription>
            </CardHeader>
            <CardContent className="space-y-2 text-sm">
              {snapshot.workflow ? (
                <>
                  <div className="flex items-center justify-between gap-2">
                    <span className="text-muted-foreground">State</span>
                    <StatusBadge status={snapshot.workflow.state === "draft" ? "draft" : "processing"} />
                  </div>
                  <div className="flex items-center justify-between gap-2">
                    <span className="text-muted-foreground">Workflow ID</span>
                    <span className="truncate font-mono text-xs">{snapshot.workflow.id}</span>
                  </div>
                </>
              ) : (
                <EmptyState
                  title="No workflow yet"
                  description="A curator workflow is created automatically on first autosave."
                  className="py-6"
                />
              )}
            </CardContent>
          </Card>

          <Card>
            <CardHeader className="pb-3">
              <CardTitle className="flex items-center gap-2 text-sm">
                <ShieldCheck className="h-4 w-4" />
                Validation
              </CardTitle>
              <CardDescription>Debounced dry-run against curator validators.</CardDescription>
            </CardHeader>
            <CardContent className="space-y-3">
              <div className="flex items-center justify-between gap-2">
                <span className="text-sm text-muted-foreground">Package status</span>
                {snapshot.validationPending ? (
                  <span className="inline-flex items-center gap-1 text-xs text-muted-foreground">
                    <Loader2 className="h-3.5 w-3.5 animate-spin" />
                    Checking
                  </span>
                ) : (
                  <ValidationBadge status={validationStatus} />
                )}
              </div>
              {snapshot.validation && !snapshot.validation.valid && snapshot.validation.issues.length > 0 && (
                <ul className="space-y-2 text-xs text-muted-foreground">
                  {snapshot.validation.issues.slice(0, 4).map((issue, index) => (
                    <li key={index} className="rounded-md border bg-muted/30 px-2 py-1.5">
                      {String((issue as { message?: string }).message ?? JSON.stringify(issue))}
                    </li>
                  ))}
                </ul>
              )}
            </CardContent>
          </Card>

          <div className="grid gap-2">
            <ContextMetric icon={<GitBranch className="h-4 w-4" />} label="Mechanism roots" value={counts.mechanisms} />
            <ContextMetric icon={<HeartPulse className="h-4 w-4" />} label="Indications" value={counts.indications} />
            <ContextMetric icon={<Network className="h-4 w-4" />} label="Drug classes" value={counts.classes} />
          </div>

          <Card>
            <CardHeader className="pb-3">
              <CardTitle className="flex items-center gap-2 text-sm">
                <Activity className="h-4 w-4" />
                Recent activity
              </CardTitle>
            </CardHeader>
            <CardContent>
              {auditQuery.isLoading ? (
                <p className="text-sm text-muted-foreground">Loading audit events…</p>
              ) : recentActivity.length ? (
                <ul className="space-y-2 text-xs">
                  {recentActivity.map((entry) => (
                    <li key={entry.id} className="rounded-md border px-2 py-1.5">
                      <p className="font-medium">{entry.action}</p>
                      <p className="text-muted-foreground">{entry.timestamp ?? "Unknown time"}</p>
                    </li>
                  ))}
                </ul>
              ) : (
                <p className="text-sm text-muted-foreground">No recent audit events for this drug.</p>
              )}
            </CardContent>
          </Card>

          {slug && (
            <Card>
              <CardHeader className="pb-3">
                <CardTitle className="text-sm">Explain preview</CardTitle>
                <CardDescription>Live mechanism query for the current slug.</CardDescription>
              </CardHeader>
              <CardContent className="text-xs text-muted-foreground">
                {explainQuery.isLoading ? (
                  <p>Loading explain response…</p>
                ) : explainQuery.isError ? (
                  <p>Explain API unavailable for this slug.</p>
                ) : (
                  <pre className="max-h-40 overflow-auto whitespace-pre-wrap rounded-md border bg-muted/20 p-2 font-mono text-[11px]">
                    {JSON.stringify(explainQuery.data?.data ?? {}, null, 2)}
                  </pre>
                )}
              </CardContent>
            </Card>
          )}

          <Separator />
          <p className="text-[11px] leading-relaxed text-muted-foreground">
            Context updates as you edit. Graph neighborhood and publish preview endpoints are planned for Studio 4.3.
          </p>
        </div>
      </ScrollArea>
    </aside>
  );
}
