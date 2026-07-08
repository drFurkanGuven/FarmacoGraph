"use client";

import { useEffect } from "react";
import { Loader2, Rocket, Send, ShieldCheck } from "lucide-react";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { ErrorState } from "@/components/ui/error-state";
import { WorkflowStatePanel } from "./workflow-state-panel";
import type { PublishWizardAction } from "./validation";
import { PublishConfirmation, PublishResult } from "./publish-phases";
import { MissingRequirementsPanel, ValidationReadinessPanel } from "./validation-panel";
import type { DrugEditorSnapshot } from "@/components/drug-editor/types";
import type { PublishWizardProps } from "./types";
import { usePublishWizard } from "./use-publish-wizard";
import { WorkflowStepper } from "./workflow-steps";

const ACTION_ICONS: Record<PublishWizardAction, React.ReactNode> = {
  submit: <Send className="h-4 w-4" />,
  approve: <ShieldCheck className="h-4 w-4" />,
  publish: <Rocket className="h-4 w-4" />,
};

function toEditorSnapshot(props: PublishWizardProps): DrugEditorSnapshot {
  return {
    drugId: props.drugId,
    workflow: props.workflow,
    package: props.package,
    activeSectionId: "identity",
    saveStatus: props.saveStatus,
    saveError: null,
    lastSavedAt: null,
    lastSaveStrategy: null,
    dirtySections: props.dirtySections,
    validation: props.editorValidation,
    validationPending: props.validationPending,
  };
}

export function PublishWizard({
  open,
  onOpenChange,
  drugId,
  workflow,
  package: packageInput,
  saveStatus,
  dirtySections,
  editorValidation,
  validationPending,
  onWorkflowUpdated,
  onNavigateSection,
}: PublishWizardProps) {
  const editorSnapshot = toEditorSnapshot({
    open,
    onOpenChange,
    drugId,
    workflow,
    package: packageInput,
    saveStatus,
    dirtySections,
    editorValidation,
    validationPending,
    onWorkflowUpdated,
    onNavigateSection,
  });

  const wizard = usePublishWizard({
    drugId,
    workflow,
    package: packageInput,
    saveStatus,
    dirtySections,
    editorValidation,
    validationPending,
    onWorkflowUpdated,
    enabled: open,
  });

  useEffect(() => {
    if (!open) {
      wizard.reset();
      return;
    }

    void wizard.ensureWorkflow();
  }, [open]);

  const handleOpenChange = (nextOpen: boolean) => {
    if (!nextOpen && wizard.isExecuting) return;
    if (!nextOpen) wizard.reset();
    onOpenChange(nextOpen);
  };

  const title =
    wizard.phase === "confirm"
      ? "Confirm action"
      : wizard.phase === "result"
        ? "Workflow update"
        : "Publish wizard";

  const primaryAction = wizard.availableAction;
  const primaryBlockers = primaryAction ? wizard.getActionBlockers(primaryAction) : [];
  const primaryLabel = primaryAction ? wizard.actionLabels[primaryAction] : null;

  return (
    <Dialog open={open} onOpenChange={handleOpenChange}>
      <DialogContent className="max-h-[90vh] max-w-2xl overflow-y-auto">
        {wizard.phase === "overview" && (
          <>
            <DialogHeader>
              <DialogTitle>{title}</DialogTitle>
              <DialogDescription>
                Review workflow state, validation readiness, and advance the package through submit, approve, and
                publish.
              </DialogDescription>
            </DialogHeader>

            <div className="space-y-4">
              <WorkflowStatePanel snapshot={editorSnapshot} />

              {wizard.ensuringWorkflow && (
                <p className="inline-flex items-center gap-2 text-sm text-muted-foreground">
                  <Loader2 className="h-4 w-4 animate-spin" />
                  Opening curator workflow…
                </p>
              )}

              {wizard.ensureError && (
                <ErrorState title="Workflow unavailable" message={wizard.ensureError} className="py-4" />
              )}

              {wizard.hasUnsavedChanges && (
                <div className="rounded-md border border-amber-500/40 bg-amber-500/5 px-3 py-2 text-sm text-amber-900 dark:text-amber-200">
                  Autosave is still in progress. Wait for changes to save before submitting or publishing.
                </div>
              )}

              <WorkflowStepper workflowState={wizard.workflowState} />

              <ValidationReadinessPanel
                readiness={wizard.readiness}
                onRefresh={wizard.readiness.refetch}
                onNavigateSection={onNavigateSection}
              />

              <MissingRequirementsPanel readiness={wizard.readiness} onNavigateSection={onNavigateSection} />

              <div className="rounded-lg border p-4">
                <p className="text-sm font-medium">Next step</p>
                <p className="mt-1 text-sm text-muted-foreground">
                  {primaryLabel
                    ? `When validation passes, you can proceed with: ${primaryLabel.toLowerCase()}.`
                    : wizard.workflowState === "published"
                      ? "This package has already been published."
                      : "No workflow action is available for the current state."}
                </p>

                {primaryAction && primaryLabel && (
                  <div className="mt-4 space-y-2">
                    {primaryBlockers.length > 0 && (
                      <ul className="list-disc space-y-1 pl-5 text-sm text-muted-foreground">
                        {primaryBlockers.map((blocker) => (
                          <li key={blocker}>{blocker}</li>
                        ))}
                      </ul>
                    )}
                    <Button
                      className="w-full sm:w-auto"
                      onClick={() => wizard.requestAction(primaryAction)}
                      disabled={
                        wizard.ensuringWorkflow ||
                        wizard.isExecuting ||
                        primaryBlockers.length > 0 ||
                        !wizard.workflowId
                      }
                    >
                      {ACTION_ICONS[primaryAction]}
                      {primaryLabel}
                    </Button>
                  </div>
                )}
              </div>
            </div>
          </>
        )}

        {wizard.phase === "confirm" && wizard.pendingAction && (
          <PublishConfirmation
            action={wizard.pendingAction}
            actionLabel={wizard.actionLabels[wizard.pendingAction]}
            workflowState={wizard.workflowState}
            blockers={wizard.getActionBlockers(wizard.pendingAction)}
            isExecuting={wizard.isExecuting}
            onConfirm={() => void wizard.confirmAction()}
            onCancel={wizard.cancelConfirm}
          />
        )}

        {wizard.phase === "result" && wizard.result && wizard.pendingAction === null && (
          <PublishResult
            result={wizard.result}
            actionLabel={wizard.actionLabels[wizard.result.action]}
            slug={drugId}
            onClose={wizard.closeResult}
            onDone={() => handleOpenChange(false)}
          />
        )}
      </DialogContent>
    </Dialog>
  );
}
