"use client";

import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import type { DrugWorkflowState, PublishWorkflowResult } from "@/lib/api";
import { formatRelativeTime } from "@/lib/utils";

export interface SnapshotResultCardProps {
  result: PublishWorkflowResult | null;
  workflowState?: DrugWorkflowState;
  slug: string;
}

export function SnapshotResultCard({ result, workflowState, slug }: SnapshotResultCardProps) {
  const snapshot = result?.snapshot ?? workflowState?.snapshot ?? null;
  const publishedSlug = result?.published_slug ?? slug;
  const datasetVersion =
    result?.dataset_version ??
    workflowState?.package?.dataset_version ??
    workflowState?.package?.entity_payload?.dataset_version ??
    null;
  const publishedAt = result?.published_at ?? null;
  const graphWrite = result?.graph_write;

  return (
    <Card>
      <CardHeader className="pb-3">
        <CardTitle className="text-sm">Snapshot &amp; graph write</CardTitle>
        <CardDescription>Outcome of the most recent publish action.</CardDescription>
      </CardHeader>
      <CardContent className="space-y-2 text-sm">
        <div className="flex justify-between gap-2">
          <span className="text-muted-foreground">Published slug</span>
          <code className="text-xs">{publishedSlug}</code>
        </div>
        {datasetVersion && (
          <div className="flex justify-between gap-2">
            <span className="text-muted-foreground">Dataset version</span>
            <span className="font-mono text-xs">{String(datasetVersion)}</span>
          </div>
        )}
        {publishedAt && (
          <div className="flex justify-between gap-2">
            <span className="text-muted-foreground">Published</span>
            <span className="text-xs">{formatRelativeTime(publishedAt)}</span>
          </div>
        )}
        {snapshot?.id && (
          <div className="flex justify-between gap-2">
            <span className="text-muted-foreground">Snapshot ID</span>
            <span className="truncate font-mono text-xs">{snapshot.id}</span>
          </div>
        )}
        {snapshot?.version_tag && (
          <div className="flex justify-between gap-2">
            <span className="text-muted-foreground">Snapshot version</span>
            <span className="font-mono text-xs">{snapshot.version_tag}</span>
          </div>
        )}
        {graphWrite && (
          <div className="flex justify-between gap-2">
            <span className="text-muted-foreground">Graph write</span>
            <span className="text-xs">
              {graphWrite.available ? graphWrite.status : "Neo4j unavailable — skipped"}
            </span>
          </div>
        )}
        {result?.validation_summary && (
          <div className="flex justify-between gap-2">
            <span className="text-muted-foreground">Validation</span>
            <span className="text-xs">
              {result.validation_summary.valid ? "Passed" : "Failed"}
            </span>
          </div>
        )}
        {!result && !snapshot && (
          <p className="text-muted-foreground">Publish this workflow to see snapshot metadata.</p>
        )}
      </CardContent>
    </Card>
  );
}
