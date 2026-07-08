"use client";

import { useCallback, useMemo, useState } from "react";
import { useMutation, useQueryClient } from "@tanstack/react-query";
import {
  ApiError,
  type PublishPackageInput,
  type PublishWorkflowResult,
  type WorkflowItem,
} from "@/lib/api";
import { apiQueryKeys } from "@/lib/api/react-query/keys";
import { defaultMutationOptions } from "@/lib/api/react-query/config";
import { useApiClient } from "@/lib/hooks/use-api-client";
import { usePermissions } from "@/lib/auth/hooks";
import type { ValidationResult } from "@/lib/api";
import type { SaveStatus } from "@/components/drug-editor/types";
import {
  type PublishWizardAction,
  usePublishReadiness,
} from "./validation";
import type { PublishWizardPhase, PublishWizardResult } from "./types";

const ACTION_LABELS: Record<PublishWizardAction, string> = {
  submit: "Submit for review",
  approve: "Approve",
  publish: "Publish to graph",
};

const ACTION_VERBS: Record<PublishWizardAction, string> = {
  submit: "submitted",
  approve: "approved",
  publish: "published",
};

interface WorkflowMutationResult {
  workflow: WorkflowItem;
  publishOutcome?: PublishWorkflowResult;
}

interface UsePublishWizardOptions {
  drugId: string;
  entityType?: "Drug" | "Disease";
  workflow: WorkflowItem | null;
  package: PublishPackageInput;
  saveStatus: SaveStatus;
  dirtySections: string[];
  editorValidation: ValidationResult | null;
  validationPending: boolean;
  onWorkflowUpdated: (workflow: WorkflowItem) => void;
  enabled: boolean;
}

export function usePublishWizard({
  drugId,
  entityType = "Drug",
  workflow,
  package: packageInput,
  saveStatus,
  dirtySections,
  editorValidation,
  validationPending,
  onWorkflowUpdated,
  enabled,
}: UsePublishWizardOptions) {
  const client = useApiClient();
  const queryClient = useQueryClient();
  const { hasPermission } = usePermissions();

  const [phase, setPhase] = useState<PublishWizardPhase>("overview");
  const [pendingAction, setPendingAction] = useState<PublishWizardAction | null>(null);
  const [result, setResult] = useState<PublishWizardResult | null>(null);
  const [workflowId, setWorkflowId] = useState<string | null>(workflow?.id ?? null);
  const [workflowState, setWorkflowState] = useState<string | null>(workflow?.state ?? null);
  const [ensuringWorkflow, setEnsuringWorkflow] = useState(false);
  const [ensureError, setEnsureError] = useState<string | null>(null);

  const readiness = usePublishReadiness({
    workflowId,
    workflowState,
    package: packageInput,
    entityId: workflow?.entity_id ?? null,
    enabled: enabled && Boolean(workflowId),
    editorValidation,
    skipPackageFetch: Boolean(editorValidation) && !validationPending,
  });

  const hasUnsavedChanges =
    dirtySections.length > 0 || saveStatus === "pending" || saveStatus === "saving";

  const ensureEntityWorkflow = useCallback(async () => {
    if (workflowId) return workflowId;
    const envelope =
      entityType === "Disease"
        ? await client.openDiseaseWorkflow(drugId)
        : await client.openDrugWorkflow(drugId);
    const openedWorkflow = envelope.data.workflow;
    setWorkflowId(openedWorkflow.id);
    setWorkflowState(openedWorkflow.state);
    onWorkflowUpdated(openedWorkflow);
    return openedWorkflow.id;
  }, [client, drugId, entityType, onWorkflowUpdated, workflowId]);

  const invalidateWorkflowQueries = useCallback(
    async (id: string) => {
      await queryClient.invalidateQueries({ queryKey: apiQueryKeys.workflow(id) });
      await queryClient.invalidateQueries({ queryKey: apiQueryKeys.workflowTimeline(id) });
      await queryClient.invalidateQueries({ queryKey: apiQueryKeys.curatorQueue("draft") });
      await queryClient.invalidateQueries({ queryKey: apiQueryKeys.curatorQueue("review") });
      await queryClient.invalidateQueries({ queryKey: apiQueryKeys.curatorQueue("approved") });
      if (entityType === "Disease") {
        await queryClient.invalidateQueries({ queryKey: apiQueryKeys.curatorDiseases({}) });
        await queryClient.invalidateQueries({ queryKey: apiQueryKeys.diseasePackage(drugId) });
        await queryClient.invalidateQueries({ queryKey: apiQueryKeys.diseaseWorkflowState(drugId) });
      } else {
        await queryClient.invalidateQueries({ queryKey: apiQueryKeys.drug(drugId) });
        await queryClient.invalidateQueries({ queryKey: apiQueryKeys.drugPackage(drugId) });
        await queryClient.invalidateQueries({ queryKey: apiQueryKeys.drugWorkflowState(drugId) });
      }
      readiness.refetch();
    },
    [drugId, entityType, queryClient, readiness],
  );

  const workflowMutation = useMutation({
    mutationFn: async (action: PublishWizardAction) => {
      let id = workflowId;
      if (!id) {
        id = await ensureEntityWorkflow();
      }

      if (hasUnsavedChanges) {
        throw new ApiError("Save pending changes before continuing.", 400, {
          message: "Unsaved editor changes must be saved first.",
        });
      }

      if (action === "submit") {
        const envelope = await client.submitWorkflow(id);
        return { workflow: envelope.data, publishOutcome: null };
      }

      if (action === "approve") {
        const envelope = await client.approveWorkflow(id);
        return { workflow: envelope.data, publishOutcome: null };
      }

      await client.saveWorkflowPackage(id, packageInput);
      const envelope = await client.publishWorkflow(id, packageInput);
      return { workflow: envelope.data.workflow, publishOutcome: envelope.data };
    },
    ...defaultMutationOptions,
    onSuccess: async (outcome, action) => {
      const updatedWorkflow = outcome.workflow;
      setWorkflowId(updatedWorkflow.id);
      setWorkflowState(updatedWorkflow.state);
      onWorkflowUpdated(updatedWorkflow);
      await invalidateWorkflowQueries(updatedWorkflow.id);
      setResult({
        status: "success",
        action,
        message: `Package ${ACTION_VERBS[action]} successfully.`,
        workflow: updatedWorkflow,
        publishOutcome: outcome.publishOutcome,
      });
      setPhase("result");
      setPendingAction(null);
    },
    onError: (error, action) => {
      const message =
        error instanceof ApiError ? error.message : `Failed to ${ACTION_LABELS[action].toLowerCase()}.`;
      setResult({
        status: "error",
        action,
        message,
        workflow: workflow,
      });
      setPhase("result");
      setPendingAction(null);
    },
  });

  const ensureWorkflow = useCallback(async () => {
    if (workflowId || ensuringWorkflow) return workflowId;

    setEnsuringWorkflow(true);
    setEnsureError(null);

    try {
      const id = await ensureEntityWorkflow();
      const workflowEnvelope = await client.getWorkflow(id);
      setWorkflowId(id);
      setWorkflowState(workflowEnvelope.data.state);
      onWorkflowUpdated(workflowEnvelope.data);
      return id;
    } catch (error) {
      const message = error instanceof ApiError ? error.message : "Could not open curator workflow.";
      setEnsureError(message);
      return null;
    } finally {
      setEnsuringWorkflow(false);
    }
  }, [client, ensureEntityWorkflow, ensuringWorkflow, onWorkflowUpdated, workflowId]);

  const reset = useCallback(() => {
    setPhase("overview");
    setPendingAction(null);
    setResult(null);
    setWorkflowId(workflow?.id ?? null);
    setWorkflowState(workflow?.state ?? null);
    setEnsureError(null);
  }, [workflow]);

  const availableAction = useMemo((): PublishWizardAction | null => {
    switch (workflowState) {
      case "draft":
        return "submit";
      case "review":
        return "approve";
      case "approved":
        return "publish";
      default:
        return null;
    }
  }, [workflowState]);

  const getActionBlockers = useCallback(
    (action: PublishWizardAction): string[] => {
      const blockers: string[] = [];

      if (!workflowId) {
        blockers.push("A curator workflow is required. Save the draft or wait while one is created.");
      }

      if (hasUnsavedChanges) {
        blockers.push("Unsaved editor changes must finish saving first.");
      }

      if (action === "approve" || action === "publish") {
        if (!hasPermission("curator:publish")) {
          blockers.push("Reviewer permission (curator:publish) is required.");
        }
      }

      const gate = readiness.gateAction(action);
      if (!gate.allowed && gate.reason) {
        blockers.push(gate.reason);
      }

      return blockers;
    },
    [hasPermission, hasUnsavedChanges, readiness, workflowId],
  );

  const requestAction = useCallback(
    (action: PublishWizardAction) => {
      setPendingAction(action);
      setPhase("confirm");
    },
    [],
  );

  const confirmAction = useCallback(async () => {
    if (!pendingAction) return;

    if (!workflowId) {
      const id = await ensureWorkflow();
      if (!id) return;
    }

    workflowMutation.mutate(pendingAction);
  }, [ensureWorkflow, pendingAction, workflowId, workflowMutation]);

  const cancelConfirm = useCallback(() => {
    setPendingAction(null);
    setPhase("overview");
  }, []);

  const closeResult = useCallback(() => {
    if (result?.status === "success") {
      reset();
    } else {
      setPhase("overview");
      setResult(null);
    }
  }, [reset, result?.status]);

  return {
    phase,
    pendingAction,
    result,
    workflowId,
    workflowState,
    ensuringWorkflow,
    ensureError,
    readiness,
    availableAction,
    hasUnsavedChanges,
    isExecuting: workflowMutation.isPending,
    actionLabels: ACTION_LABELS,
    getActionBlockers,
    requestAction,
    confirmAction,
    cancelConfirm,
    closeResult,
    reset,
    ensureWorkflow,
  };
}
