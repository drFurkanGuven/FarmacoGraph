"use client";

import Link from "next/link";
import { Activity, Camera, HeartPulse, Loader2, ShieldCheck } from "lucide-react";
import { Button, ValidationBadge } from "@/components/ui";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Separator } from "@/components/ui/separator";
import { WorkflowStatePanel } from "@/components/publish-wizard/workflow-state-panel";
import { WorkflowTimeline } from "@/components/workflow-timeline";
import { cn } from "@/lib/utils";
import type { EntityEditorSnapshot } from "@/components/entity-editor";

export interface DiseaseContextPanelProps {
  snapshot: EntityEditorSnapshot;
  diseaseSlug: string;
  className?: string;
}

export function DiseaseContextPanel({ snapshot, diseaseSlug, className }: DiseaseContextPanelProps) {
  const workflowId = snapshot.workflow?.id ?? null;
  const slug =
    typeof snapshot.package.entity_payload.slug === "string" && snapshot.package.entity_payload.slug
      ? snapshot.package.entity_payload.slug
      : diseaseSlug;
  const label = String(snapshot.package.entity_payload.label ?? slug);
  const diseaseContext = encodeURIComponent(slug);

  const validationStatus = snapshot.validationPending
    ? "pending"
    : snapshot.validation?.valid
      ? "valid"
      : snapshot.validation
        ? "invalid"
        : "pending";

  const contextLinks = [
    { label: "Drugs", href: `/knowledge/drugs?disease=${diseaseContext}`, icon: HeartPulse },
    { label: "Activity", href: `/activity?drug=${diseaseContext}`, icon: Activity },
    { label: "Snapshots", href: `/snapshots?drug=${diseaseContext}`, icon: Camera },
    { label: "Validation", href: "/validation", icon: ShieldCheck },
  ];

  return (
    <aside className={cn("minimal-scrollbar min-h-0 overflow-y-auto", className)}>
      <div className="min-w-0 space-y-3 p-3 pb-8">
        <div className="min-w-0">
          <p className="text-xs font-medium uppercase tracking-wide text-muted-foreground">
            Live context
          </p>
          <h3 className="truncate text-sm font-semibold">{label}</h3>
        </div>

        <WorkflowStatePanel
          snapshot={{
            drugId: diseaseSlug,
            workflow: snapshot.workflow,
            package: snapshot.package,
            activeSectionId: snapshot.activeSectionId,
            saveStatus: snapshot.saveStatus,
            saveError: snapshot.saveError,
            lastSavedAt: snapshot.lastSavedAt,
            lastSaveStrategy: null,
            dirtySections: snapshot.dirtySections,
            validation: snapshot.validation,
            validationPending: snapshot.validationPending,
          }}
          entityType="Disease"
          compact
        />

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

        {workflowId ? <WorkflowTimeline workflowId={workflowId} limit={5} compact /> : null}

        <Separator />
        <p className="text-[11px] leading-relaxed text-muted-foreground">
          Open the publish wizard from the header to submit, approve, and publish this disease.
          Disease-specific evidence attach remains deferred.
        </p>
      </div>
    </aside>
  );
}
