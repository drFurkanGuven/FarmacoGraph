"use client";

import { useMemo } from "react";
import {
  GitBranch,
  HeartPulse,
  Loader2,
  Network,
  ShieldCheck,
} from "lucide-react";
import { ValidationBadge } from "@/components/ui";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Separator } from "@/components/ui/separator";
import { WorkflowStatePanel } from "@/components/publish-wizard/workflow-state-panel";
import { WorkflowTimeline } from "@/components/workflow-timeline";
import { DrugEvidencePanel } from "./drug-evidence-panel";
import { relationshipCounts } from "./package";
import type { DrugEditorSnapshot } from "./types";

export interface DrugContextPanelProps {
  snapshot: DrugEditorSnapshot;
  onOpenEvidenceSection?: () => void;
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

export function DrugContextPanel({ snapshot, onOpenEvidenceSection, className }: DrugContextPanelProps) {
  const counts = useMemo(() => relationshipCounts(snapshot.package), [snapshot.package]);
  const workflowId = snapshot.workflow?.id ?? null;
  const entityId = String(snapshot.package.entity_payload.id ?? snapshot.drugId);
  const slug =
    typeof snapshot.package.entity_payload.slug === "string" && snapshot.package.entity_payload.slug
      ? snapshot.package.entity_payload.slug
      : null;

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

          <WorkflowStatePanel snapshot={snapshot} />

          <Card>
            <CardHeader className="pb-3">
              <CardTitle className="flex items-center gap-2 text-sm">
                <ShieldCheck className="h-4 w-4" />
                Validation
              </CardTitle>
              <CardDescription>Same dry-run state used by the publish wizard.</CardDescription>
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

          <DrugEvidencePanel
            drugId={snapshot.drugId}
            entityId={entityId}
            slug={slug}
            validation={snapshot.validation}
            onOpenSection={onOpenEvidenceSection}
          />

          <div className="grid gap-2">
            <ContextMetric icon={<GitBranch className="h-4 w-4" />} label="Mechanism roots" value={counts.mechanisms} />
            <ContextMetric icon={<HeartPulse className="h-4 w-4" />} label="Indications" value={counts.indications} />
            <ContextMetric icon={<Network className="h-4 w-4" />} label="Drug classes" value={counts.classes} />
          </div>

          {workflowId && <WorkflowTimeline workflowId={workflowId} limit={8} />}

          <Separator />
          <p className="text-[11px] leading-relaxed text-muted-foreground">
            Open the publish wizard from the header to submit, approve, and publish this drug.
          </p>
        </div>
      </ScrollArea>
    </aside>
  );
}
