"use client";

import { useCallback, useMemo } from "react";
import type { DrugWorkflowState } from "@/lib/api";
import { useDrugWorkflowState } from "@/lib/api/react-query/hooks";
import { useApiClient } from "@/lib/hooks/use-api-client";
import { defaultQueryOptions } from "@/lib/api/react-query/config";
import { useApiQuery } from "@/lib/api/react-query/optimistic";
import type { ValidationSummaryData } from "@/components/validation/validation-types";
import type { DrugEditorSnapshot } from "@/components/drug-editor/types";
import { isDrugSlug } from "@/components/drug-editor/api";
import {
  computePublishValidationState,
  gatePublishAction,
  toPackageValidationSnapshot,
} from "./validation/publish-validation";
import type { PublishValidationState, PublishWizardAction } from "./validation/types";
import { publishValidationQueryKeys } from "./validation/use-publish-readiness";

export function usePublishWizardState(snapshot: DrugEditorSnapshot) {
  const client = useApiClient();
  const slug = isDrugSlug(snapshot.drugId)
    ? snapshot.drugId
    : String(snapshot.package.entity_payload.slug ?? snapshot.drugId);
  const stateQuery = useDrugWorkflowState(slug);
  const workflowState = stateQuery.data?.data;

  const workflowId = snapshot.workflow?.id ?? workflowState?.workflow_id ?? null;
  const workflowStatus = snapshot.workflow?.state ?? workflowState?.status ?? null;

  const summaryQuery = useApiQuery(
    publishValidationQueryKeys.summary(),
    () => client.request<ValidationSummaryData>("/curator/validation-summary"),
    { ...defaultQueryOptions, enabled: Boolean(workflowId) },
  );

  const packageValidation = useMemo(() => {
    if (!snapshot.validation) return null;
    return toPackageValidationSnapshot(snapshot.validation, snapshot.package);
  }, [snapshot.validation, snapshot.package]);

  const validation: PublishValidationState | null = useMemo(() => {
    if (!packageValidation) return null;
    return computePublishValidationState({
      packageValidation,
      packageInput: snapshot.package,
      workflowState: workflowStatus,
      summary: summaryQuery.data?.data,
      entityId: snapshot.workflow?.entity_id,
    });
  }, [
    packageValidation,
    snapshot.package,
    workflowStatus,
    summaryQuery.data?.data,
    snapshot.workflow?.entity_id,
  ]);

  const gateAction = useCallback(
    (action: PublishWizardAction) => gatePublishAction(action, validation, workflowStatus),
    [validation, workflowStatus],
  );

  const refetch = useCallback(() => {
    void summaryQuery.refetch();
    void stateQuery.refetch();
  }, [summaryQuery, stateQuery]);

  return {
    slug,
    workflowId,
    workflowStatus,
    workflowState: workflowState as DrugWorkflowState | undefined,
    validation,
    validationPending: snapshot.validationPending,
    gateAction,
    refetch,
    summaryLoading: summaryQuery.isLoading,
    stateLoading: stateQuery.isLoading,
  };
}
