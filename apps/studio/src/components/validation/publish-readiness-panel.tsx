import Link from "next/link";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
  ListSkeleton,
  ValidationBadge,
} from "@/components/ui";
import { Button } from "@/components/ui/button";
import type { PublishReadiness, QueueValidationItem } from "./validation-types";

interface PublishReadinessPanelProps {
  readiness: PublishReadiness;
  queueItems: QueueValidationItem[];
  loading?: boolean;
}

function readinessBadgeStatus(status: PublishReadiness["status"]) {
  switch (status) {
    case "ready":
      return "valid" as const;
    case "blocked":
      return "invalid" as const;
    case "pending":
      return "pending" as const;
    default:
      return "pending" as const;
  }
}

function readinessLabel(status: PublishReadiness["status"]) {
  switch (status) {
    case "ready":
      return "Ready to publish";
    case "blocked":
      return "Blocked";
    case "pending":
      return "Validation pending";
    default:
      return "Unknown";
  }
}

export function PublishReadinessPanel({ readiness, queueItems, loading }: PublishReadinessPanelProps) {
  return (
    <Card>
      <CardHeader>
        <CardTitle className="flex items-center gap-2 text-base">
          Publish readiness
          {!loading && (
            <ValidationBadge
              status={readinessBadgeStatus(readiness.status)}
              label={readinessLabel(readiness.status)}
              className="ml-auto"
            />
          )}
        </CardTitle>
        <CardDescription>
          Dry-run validation for curator queue packages plus graph validation job status.
        </CardDescription>
      </CardHeader>
      <CardContent className="space-y-4">
        {loading ? (
          <ListSkeleton rows={4} />
        ) : (
          <>
            <p className="text-sm text-muted-foreground">{readiness.message}</p>
            <dl className="grid gap-3 text-sm sm:grid-cols-2">
              <div className="flex justify-between rounded-md border px-3 py-2">
                <dt className="text-muted-foreground">Drafts</dt>
                <dd className="font-semibold tabular-nums">{readiness.draftCount}</dd>
              </div>
              <div className="flex justify-between rounded-md border px-3 py-2">
                <dt className="text-muted-foreground">In review</dt>
                <dd className="font-semibold tabular-nums">{readiness.reviewCount}</dd>
              </div>
              <div className="flex justify-between rounded-md border px-3 py-2">
                <dt className="text-muted-foreground">Blocking errors</dt>
                <dd className="font-semibold tabular-nums">{readiness.blockingErrors}</dd>
              </div>
              <div className="flex justify-between rounded-md border px-3 py-2">
                <dt className="text-muted-foreground">Graph failures</dt>
                <dd className="font-semibold tabular-nums">{readiness.graphFailures}</dd>
              </div>
            </dl>

            {queueItems.length > 0 && (
              <div className="space-y-2">
                <p className="text-xs font-medium uppercase tracking-wide text-muted-foreground">
                  Queue packages
                </p>
                <ul className="space-y-2">
                  {queueItems.map((item) => (
                    <li
                      key={item.workflowId}
                      className="flex items-center justify-between gap-3 rounded-md border px-3 py-2 text-sm"
                    >
                      <div className="min-w-0">
                        <p className="truncate font-medium">{item.entityLabel}</p>
                        <p className="font-mono text-xs text-muted-foreground">
                          {item.workflowState} · {item.entityId}
                        </p>
                      </div>
                      <ValidationBadge status={item.valid ? "valid" : "invalid"} />
                    </li>
                  ))}
                </ul>
              </div>
            )}

            <Button variant="outline" size="sm" asChild>
              <Link href="/knowledge/drugs">Open drug editor</Link>
            </Button>
          </>
        )}
      </CardContent>
    </Card>
  );
}
