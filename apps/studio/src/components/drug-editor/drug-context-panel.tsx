"use client";

import { useMemo } from "react";
import Link from "next/link";
import {
  Activity,
  BookOpen,
  Camera,
  GitBranch,
  HeartPulse,
  Loader2,
  Network,
  ShieldCheck,
} from "lucide-react";
import { Button, ValidationBadge } from "@/components/ui";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Separator } from "@/components/ui/separator";
import { WorkflowStatePanel } from "@/components/publish-wizard/workflow-state-panel";
import { WorkflowTimeline } from "@/components/workflow-timeline";
import { cn } from "@/lib/utils";
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
    <div className="flex min-w-0 items-center gap-2 rounded-md border bg-card/60 px-2.5 py-2">
      <div className="text-muted-foreground">{icon}</div>
      <div className="min-w-0">
        <p className="text-xs text-muted-foreground">{label}</p>
        <p className="text-sm font-medium tabular-nums">{value}</p>
      </div>
    </div>
  );
}

export function DrugContextPanel({
  snapshot,
  onOpenEvidenceSection,
  className,
}: DrugContextPanelProps) {
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
  const drugContext = encodeURIComponent(slug ?? entityId);
  const contextLinks = [
    { label: "Education", href: `/knowledge/education?drug=${drugContext}`, icon: BookOpen },
    { label: "Diseases", href: `/knowledge/diseases?drug=${drugContext}`, icon: HeartPulse },
    { label: "Mechanisms", href: `/knowledge/mechanisms?drug=${drugContext}`, icon: GitBranch },
    { label: "Graph", href: `/graph?drug=${drugContext}`, icon: Network },
    { label: "Activity", href: `/activity?drug=${drugContext}`, icon: Activity },
    { label: "Snapshots", href: `/snapshots?drug=${drugContext}`, icon: Camera },
  ];

  return (
    <aside className={cn("minimal-scrollbar min-h-0 overflow-y-auto", className)}>
      <div className="min-w-0 space-y-3 p-3 pb-8">
        <div className="min-w-0">
          <p className="text-xs font-medium uppercase tracking-wide text-muted-foreground">
            Live context
          </p>
          <h3 className="truncate text-sm font-semibold">
            {String(
              snapshot.package.entity_payload.label ||
                snapshot.package.entity_payload.generic_name ||
                "Untitled drug"
            )}
          </h3>
        </div>

        <WorkflowStatePanel snapshot={snapshot} compact />

        <Card className="rounded-md">
          <CardHeader className="p-3 pb-2">
            <CardTitle className="flex items-center gap-2 text-sm">
              <ShieldCheck className="h-4 w-4" />
              Validation
            </CardTitle>
          </CardHeader>
          <CardContent className="space-y-2 p-3 pt-0">
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
            {snapshot.validation &&
              !snapshot.validation.valid &&
              snapshot.validation.issues.length > 0 && (
                <ul className="space-y-1.5 text-xs text-muted-foreground">
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
          compact
        />

        <div className="grid grid-cols-3 gap-2">
          <ContextMetric
            icon={<GitBranch className="h-4 w-4" />}
            label="Mechanism roots"
            value={counts.mechanisms}
          />
          <ContextMetric
            icon={<HeartPulse className="h-4 w-4" />}
            label="Indications"
            value={counts.indications}
          />
          <ContextMetric
            icon={<Network className="h-4 w-4" />}
            label="Drug classes"
            value={counts.classes}
          />
        </div>

        <Card className="rounded-md">
          <CardHeader className="p-3 pb-2">
            <CardTitle className="text-sm">Knowledge links</CardTitle>
          </CardHeader>
          <CardContent className="grid grid-cols-2 gap-2 p-3 pt-0">
            {contextLinks.map((item) => {
              const Icon = item.icon;
              return (
                <Button
                  key={item.href}
                  asChild
                  variant="outline"
                  size="sm"
                  className="justify-start overflow-hidden px-2"
                >
                  <Link href={item.href}>
                    <Icon className="h-3.5 w-3.5" />
                    <span className="truncate">{item.label}</span>
                  </Link>
                </Button>
              );
            })}
          </CardContent>
        </Card>

        {workflowId && <WorkflowTimeline workflowId={workflowId} limit={5} compact />}

        <Separator />
        <p className="text-[11px] leading-relaxed text-muted-foreground">
          Open the publish wizard from the header to submit, approve, and publish this drug.
        </p>
      </div>
    </aside>
  );
}
