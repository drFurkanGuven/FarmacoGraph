import type { WorkflowTimelineEvent, WorkflowTimelineKind } from "@/lib/api";

export interface TimelinePresentation {
  title: string;
  description?: string;
}

const KIND_LABELS: Record<WorkflowTimelineKind, string> = {
  workflow_created: "Workflow created",
  autosaved: "Draft autosaved",
  validation_run: "Validation run",
  submitted: "Submitted for review",
  approved: "Approved",
  returned_to_draft: "Returned to draft",
  published: "Published",
  publish_failed: "Publish failed",
  snapshot_created: "Snapshot created",
  unknown: "Activity",
};

export function timelineLabel(kind: WorkflowTimelineKind): string {
  return KIND_LABELS[kind] ?? KIND_LABELS.unknown;
}

export function toTimelinePresentation(event: WorkflowTimelineEvent): TimelinePresentation {
  return {
    title: timelineLabel(event.kind),
    description: event.detail ?? undefined,
  };
}

export function sortTimelineEvents(events: WorkflowTimelineEvent[]): WorkflowTimelineEvent[] {
  return [...events].sort((left, right) => {
    const leftTime = left.timestamp ? Date.parse(left.timestamp) : 0;
    const rightTime = right.timestamp ? Date.parse(right.timestamp) : 0;
    return leftTime - rightTime;
  });
}
