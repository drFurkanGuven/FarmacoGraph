"use client";

import {
  AlertCircle,
  Camera,
  CheckCircle2,
  FileCheck2,
  GitBranchPlus,
  Loader2,
  RotateCcw,
  Save,
  Send,
  ShieldCheck,
} from "lucide-react";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
  ListSkeleton,
  Timeline,
  type TimelineItem,
} from "@/components/ui";
import { EmptyState } from "@/components/ui/empty-state";
import { useWorkflowTimeline } from "@/lib/api/react-query/hooks";
import type { WorkflowTimelineKind } from "@/lib/api";
import { formatRelativeTime } from "@/lib/utils";
import { sortTimelineEvents, toTimelinePresentation } from "./timeline-utils";

const KIND_ICONS: Record<WorkflowTimelineKind, React.ReactNode> = {
  workflow_created: <GitBranchPlus className="h-4 w-4" />,
  autosaved: <Save className="h-4 w-4" />,
  validation_run: <FileCheck2 className="h-4 w-4" />,
  submitted: <Send className="h-4 w-4" />,
  approved: <ShieldCheck className="h-4 w-4" />,
  returned_to_draft: <RotateCcw className="h-4 w-4" />,
  published: <CheckCircle2 className="h-4 w-4" />,
  publish_failed: <AlertCircle className="h-4 w-4 text-destructive" />,
  snapshot_created: <Camera className="h-4 w-4" />,
  unknown: <Loader2 className="h-4 w-4" />,
};

export interface WorkflowTimelineProps {
  workflowId: string;
  className?: string;
  limit?: number;
  compact?: boolean;
}

function toTimelineItems(events: ReturnType<typeof sortTimelineEvents>): TimelineItem[] {
  return events.map((event) => {
    const presentation = toTimelinePresentation(event);
    return {
      id: event.id,
      title: presentation.title,
      description: presentation.description,
      timestamp: formatRelativeTime(event.timestamp),
      icon: KIND_ICONS[event.kind],
    };
  });
}

export function WorkflowTimeline({ workflowId, className, limit = 50, compact = false }: WorkflowTimelineProps) {
  const timelineQuery = useWorkflowTimeline(workflowId, { limit });
  const events = sortTimelineEvents(timelineQuery.data?.data ?? []);
  const items = toTimelineItems(events);

  return (
    <Card className={className}>
      <CardHeader className={compact ? "p-3 pb-2" : undefined}>
        <CardTitle className={compact ? "text-sm" : "text-base"}>Activity timeline</CardTitle>
        {!compact && <CardDescription>Workflow audit events from draft through publish.</CardDescription>}
      </CardHeader>
      <CardContent className={compact ? "p-3 pt-0" : undefined}>
        {timelineQuery.isLoading ? (
          <ListSkeleton rows={4} />
        ) : timelineQuery.isError ? (
          <EmptyState
            title="Timeline unavailable"
            description="Could not load workflow activity. Try again after saving the draft."
            className="py-6"
          />
        ) : items.length === 0 ? (
          <EmptyState
            title="No activity yet"
            description="Workflow events appear here after creation, autosave, validation, and publish steps."
            className="py-6"
          />
        ) : (
          <Timeline items={items} />
        )}
      </CardContent>
    </Card>
  );
}
