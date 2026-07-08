"use client";

import { Loader2, Workflow } from "lucide-react";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { ValidationBadge } from "@/components/ui/validation-badge";
import { StatusBadge } from "@/components/ui/status-badge";
import { useDrugWorkflowState } from "@/lib/api/react-query/hooks";
import { formatRelativeTime } from "@/lib/utils";
import type { DrugEditorSnapshot } from "@/components/drug-editor/types";
import { isDrugSlug } from "@/components/drug-editor/api";

function workflowBadgeStatus(state: string | null | undefined) {
  switch (state) {
    case "draft":
      return "draft" as const;
    case "review":
      return "processing" as const;
    case "approved":
      return "processing" as const;
    case "published":
      return "active" as const;
    default:
      return "inactive" as const;
  }
}

export interface WorkflowStatePanelProps {
  snapshot: DrugEditorSnapshot;
}

export function WorkflowStatePanel({ snapshot }: WorkflowStatePanelProps) {
  const slug = isDrugSlug(snapshot.drugId)
    ? snapshot.drugId
    : String(snapshot.package.entity_payload.slug ?? "");
  const stateQuery = useDrugWorkflowState(slug);
  const remote = stateQuery.data?.data;

  const workflowState = snapshot.workflow?.state ?? remote?.status ?? null;
  const workflowId = snapshot.workflow?.id ?? remote?.workflow_id ?? null;
  const publishReady = remote?.publish_ready ?? snapshot.validation?.valid ?? false;
  const validationStatus = snapshot.validationPending
    ? "pending"
    : snapshot.validation?.valid
      ? "valid"
      : snapshot.validation
        ? "invalid"
        : "pending";

  return (
    <Card>
      <CardHeader className="pb-3">
        <CardTitle className="flex items-center gap-2 text-sm">
          <Workflow className="h-4 w-4" />
          Workflow state
        </CardTitle>
        <CardDescription>Draft → review → approved → published</CardDescription>
      </CardHeader>
      <CardContent className="space-y-2 text-sm">
        {stateQuery.isLoading && !snapshot.workflow ? (
          <p className="flex items-center gap-2 text-muted-foreground">
            <Loader2 className="h-3.5 w-3.5 animate-spin" />
            Loading workflow…
          </p>
        ) : (
          <>
            <div className="flex items-center justify-between gap-2">
              <span className="text-muted-foreground">Status</span>
              <StatusBadge status={workflowBadgeStatus(workflowState)} label={workflowState ?? "none"} />
            </div>
            {workflowId && (
              <div className="flex items-center justify-between gap-2">
                <span className="text-muted-foreground">Workflow ID</span>
                <span className="truncate font-mono text-xs">{workflowId}</span>
              </div>
            )}
            <div className="flex items-center justify-between gap-2">
              <span className="text-muted-foreground">Last autosave</span>
              <span className="text-xs">
                {snapshot.lastSavedAt
                  ? formatRelativeTime(snapshot.lastSavedAt)
                  : remote?.last_autosave?.at
                    ? formatRelativeTime(remote.last_autosave.at)
                    : "—"}
              </span>
            </div>
            <div className="flex items-center justify-between gap-2">
              <span className="text-muted-foreground">Validation</span>
              <ValidationBadge status={validationStatus} />
            </div>
            <div className="flex items-center justify-between gap-2">
              <span className="text-muted-foreground">Publish ready</span>
              <span className="text-xs font-medium">{publishReady ? "Yes" : "No"}</span>
            </div>
            {remote?.snapshot?.version_tag && (
              <div className="flex items-center justify-between gap-2">
                <span className="text-muted-foreground">Snapshot</span>
                <span className="font-mono text-xs">{remote.snapshot.version_tag}</span>
              </div>
            )}
            {remote?.approval?.approved_at && (
              <div className="flex items-center justify-between gap-2">
                <span className="text-muted-foreground">Approved</span>
                <span className="text-xs">{formatRelativeTime(remote.approval.approved_at)}</span>
              </div>
            )}
          </>
        )}
      </CardContent>
    </Card>
  );
}
