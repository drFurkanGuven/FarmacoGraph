"use client";

import { useMutation, useQueryClient } from "@tanstack/react-query";
import { ApiError, type PublishPackageInput, type PublishWorkflowResult } from "@/lib/api";
import { apiQueryKeys } from "@/lib/api/react-query/keys";
import { useApiClient } from "@/lib/hooks/use-api-client";
import { defaultMutationOptions } from "@/lib/api/react-query/config";

export type WorkflowAction = "submit" | "approve" | "publish";

export interface WorkflowActionState {
  action: WorkflowAction | null;
  error: string | null;
  lastResult: PublishWorkflowResult | null;
}

async function invalidateWorkflowCaches(
  queryClient: ReturnType<typeof useQueryClient>,
  workflowId: string,
  slug: string,
) {
  await Promise.all([
    queryClient.invalidateQueries({ queryKey: apiQueryKeys.workflow(workflowId) }),
    queryClient.invalidateQueries({ queryKey: apiQueryKeys.drugWorkflowState(slug) }),
    queryClient.invalidateQueries({ queryKey: apiQueryKeys.workflowTimeline(workflowId) }),
    queryClient.invalidateQueries({ queryKey: apiQueryKeys.drugPackage(slug) }),
    queryClient.invalidateQueries({ queryKey: apiQueryKeys.curatorDrugs({}) }),
    queryClient.invalidateQueries({ queryKey: apiQueryKeys.curatorQueue("draft") }),
    queryClient.invalidateQueries({ queryKey: apiQueryKeys.curatorQueue("review") }),
    queryClient.invalidateQueries({ queryKey: apiQueryKeys.auditLogs({}) }),
    queryClient.invalidateQueries({ queryKey: apiQueryKeys.dashboard("cardiovascular") }),
  ]);
}

function normalizeActionError(error: unknown): string {
  if (error instanceof ApiError) return error.message;
  if (error instanceof Error) return error.message;
  return "Workflow action failed";
}

export function useWorkflowActions(workflowId: string | null, slug: string) {
  const client = useApiClient();
  const queryClient = useQueryClient();

  const onSettled = async () => {
    if (workflowId) {
      await invalidateWorkflowCaches(queryClient, workflowId, slug);
    }
  };

  const submitMutation = useMutation({
    mutationFn: async () => {
      if (!workflowId) throw new ApiError("No workflow is open for this drug.", 400, null);
      const envelope = await client.submitWorkflow(workflowId);
      return envelope.data;
    },
    ...defaultMutationOptions,
    onSettled,
  });

  const approveMutation = useMutation({
    mutationFn: async () => {
      if (!workflowId) throw new ApiError("No workflow is open for this drug.", 400, null);
      const envelope = await client.approveWorkflow(workflowId);
      return envelope.data;
    },
    ...defaultMutationOptions,
    onSettled,
  });

  const publishMutation = useMutation({
    mutationFn: async (body: PublishPackageInput) => {
      if (!workflowId) throw new ApiError("No workflow is open for this drug.", 400, null);
      const envelope = await client.publishWorkflow(workflowId, body);
      return envelope.data;
    },
    ...defaultMutationOptions,
    onSettled,
  });

  const isPending =
    submitMutation.isPending || approveMutation.isPending || publishMutation.isPending;

  const activeAction: WorkflowAction | null = submitMutation.isPending
    ? "submit"
    : approveMutation.isPending
      ? "approve"
      : publishMutation.isPending
        ? "publish"
        : null;

  const error =
    (submitMutation.error && normalizeActionError(submitMutation.error)) ||
    (approveMutation.error && normalizeActionError(approveMutation.error)) ||
    (publishMutation.error && normalizeActionError(publishMutation.error)) ||
    null;

  return {
    submit: submitMutation.mutateAsync,
    approve: approveMutation.mutateAsync,
    publish: publishMutation.mutateAsync,
    isPending,
    activeAction,
    error,
    publishResult: publishMutation.data ?? null,
    resetErrors: () => {
      submitMutation.reset();
      approveMutation.reset();
      publishMutation.reset();
    },
  };
}
