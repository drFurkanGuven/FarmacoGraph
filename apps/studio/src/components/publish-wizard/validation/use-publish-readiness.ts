"use client";

import { useCallback, useMemo } from "react";
import type { ApiEnvelope } from "@/lib/api";
import { useApiClient } from "@/lib/hooks/use-api-client";
import { defaultQueryOptions } from "@/lib/api/react-query/config";
import { useApiQuery } from "@/lib/api/react-query/optimistic";
import type { ValidationSummaryData } from "@/components/validation/validation-types";
import {
  computePublishValidationState,
  gatePublishAction,
  toPackageValidationSnapshot,
} from "./publish-validation";
import type {
  PackageValidationSnapshot,
  PublishWizardAction,
  UsePublishReadinessOptions,
  UsePublishReadinessResult,
} from "./types";

const VALIDATION_REFRESH_MS = 30_000;

export const publishValidationQueryKeys = {
  all: () => ["farmacograph", "publish-wizard", "validation"] as const,
  summary: () => [...publishValidationQueryKeys.all(), "summary"] as const,
  package: (workflowId: string) =>
    [...publishValidationQueryKeys.all(), "package", workflowId] as const,
};

export function usePublishReadiness({
  workflowId,
  workflowState,
  package: packageInput,
  entityId,
  enabled = true,
  editorValidation = null,
  skipPackageFetch = false,
}: UsePublishReadinessOptions): UsePublishReadinessResult {
  const client = useApiClient();
  const isEnabled = enabled && Boolean(workflowId && packageInput);
  const useEditorValidation = skipPackageFetch && editorValidation != null;

  const summaryQuery = useApiQuery(
    publishValidationQueryKeys.summary(),
    () => client.request<ValidationSummaryData>("/curator/validation-summary"),
    { ...defaultQueryOptions, refetchInterval: VALIDATION_REFRESH_MS, enabled },
  );

  const packageQuery = useApiQuery(
    publishValidationQueryKeys.package(workflowId ?? "none"),
    async (): Promise<ApiEnvelope<PackageValidationSnapshot>> => {
      const envelope = await client.validatePackage(packageInput!);
      return {
        data: toPackageValidationSnapshot(envelope.data, packageInput!),
        meta: envelope.meta,
      };
    },
    {
      ...defaultQueryOptions,
      enabled: isEnabled && !useEditorValidation,
      staleTime: 5_000,
      refetchInterval: isEnabled && !useEditorValidation ? VALIDATION_REFRESH_MS : false,
    },
  );

  const summary = summaryQuery.data?.data;
  const packageValidation = useMemo(() => {
    if (useEditorValidation && packageInput) {
      return toPackageValidationSnapshot(editorValidation!, packageInput);
    }
    return packageQuery.data?.data ?? null;
  }, [useEditorValidation, editorValidation, packageInput, packageQuery.data?.data]);

  const validation = useMemo(() => {
    if (!packageValidation || !packageInput) {
      return null;
    }

    return computePublishValidationState({
      packageValidation,
      packageInput,
      workflowState,
      summary,
      entityId,
    });
  }, [packageValidation, packageInput, workflowState, summary, entityId]);

  const refetch = useCallback(() => {
    void summaryQuery.refetch();
    if (isEnabled) {
      void packageQuery.refetch();
    }
  }, [summaryQuery, packageQuery, isEnabled]);

  const gateAction = useCallback(
    (action: PublishWizardAction) => gatePublishAction(action, validation, workflowState),
    [validation, workflowState],
  );

  const loading = summaryQuery.isLoading || (isEnabled && !useEditorValidation && packageQuery.isLoading);
  const validating = isEnabled && !useEditorValidation && packageQuery.isFetching && !packageQuery.isLoading;
  const error = (summaryQuery.error ?? packageQuery.error) as Error | null;

  return {
    validation,
    packageValidation,
    summary,
    loading,
    validating,
    error,
    refetch,
    gateAction,
  };
}
