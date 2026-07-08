"use client";

import { AlertCircle, CheckCircle2, Loader2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import {
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import type { PublishWizardAction } from "./validation";
import { SnapshotResultCard } from "./snapshot-result-card";
import type { PublishWizardResult } from "./types";

interface PublishConfirmationProps {
  action: PublishWizardAction;
  actionLabel: string;
  workflowState: string | null;
  blockers: string[];
  isExecuting: boolean;
  onConfirm: () => void;
  onCancel: () => void;
}

export function PublishConfirmation({
  action,
  actionLabel,
  workflowState,
  blockers,
  isExecuting,
  onConfirm,
  onCancel,
}: PublishConfirmationProps) {
  const canProceed = blockers.length === 0;

  return (
    <>
      <DialogHeader>
        <DialogTitle>Confirm {actionLabel.toLowerCase()}</DialogTitle>
        <DialogDescription>
          This will advance the workflow from <span className="font-mono">{workflowState ?? "unknown"}</span> using
          the live curator API.
        </DialogDescription>
      </DialogHeader>

      <div className="space-y-4 py-2">
        {action === "publish" && (
          <p className="text-sm text-muted-foreground">
            Publishing writes the current package to the knowledge graph and creates a snapshot when configured.
          </p>
        )}

        {blockers.length > 0 && (
          <div className="rounded-md border border-destructive/40 bg-destructive/5 p-3">
            <p className="text-sm font-medium text-destructive">Cannot proceed yet</p>
            <ul className="mt-2 list-disc space-y-1 pl-5 text-sm text-muted-foreground">
              {blockers.map((blocker) => (
                <li key={blocker}>{blocker}</li>
              ))}
            </ul>
          </div>
        )}

        {canProceed && (
          <p className="text-sm text-muted-foreground">
            Review validation results above before confirming. This action cannot be undone from the wizard.
          </p>
        )}
      </div>

      <DialogFooter>
        <Button variant="outline" onClick={onCancel} disabled={isExecuting}>
          Back
        </Button>
        <Button onClick={onConfirm} disabled={!canProceed || isExecuting}>
          {isExecuting ? (
            <>
              <Loader2 className="h-4 w-4 animate-spin" />
              Working…
            </>
          ) : (
            actionLabel
          )}
        </Button>
      </DialogFooter>
    </>
  );
}

interface PublishResultProps {
  result: PublishWizardResult;
  actionLabel: string;
  slug: string;
  onClose: () => void;
  onDone: () => void;
}

export function PublishResult({ result, actionLabel, slug, onClose, onDone }: PublishResultProps) {
  const success = result.status === "success";

  return (
    <>
      <DialogHeader>
        <DialogTitle className="flex items-center gap-2">
          {success ? (
            <CheckCircle2 className="h-5 w-5 text-emerald-600" />
          ) : (
            <AlertCircle className="h-5 w-5 text-destructive" />
          )}
          {success ? `${actionLabel} succeeded` : `${actionLabel} failed`}
        </DialogTitle>
        <DialogDescription>{result.message}</DialogDescription>
      </DialogHeader>

      {result.workflow && (
        <div className="rounded-md border bg-muted/30 px-3 py-2 text-sm">
          <p className="text-muted-foreground">Workflow state</p>
          <p className="font-mono font-medium">{result.workflow.state}</p>
        </div>
      )}

      {result.publishOutcome && (
        <SnapshotResultCard result={result.publishOutcome} slug={slug} />
      )}

      <DialogFooter>
        {success ? (
          <Button onClick={onDone}>Done</Button>
        ) : (
          <>
            <Button variant="outline" onClick={onClose}>
              Back to wizard
            </Button>
            <Button onClick={onDone}>Close</Button>
          </>
        )}
      </DialogFooter>
    </>
  );
}
