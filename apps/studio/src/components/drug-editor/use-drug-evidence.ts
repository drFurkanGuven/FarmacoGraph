"use client";

import { useCallback, useMemo } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { ApiError } from "@/lib/api";
import { useApiClient } from "@/lib/hooks/use-api-client";
import {
  attachEvidenceToDrug,
  createEvidenceRecord,
  detachEvidenceFromDrug,
  fetchDrugEvidence,
  searchEvidence,
} from "./evidence-client";
import {
  missingRequirementsFromValidation,
  summarizeDrugEvidence,
} from "./evidence-helpers";
import type { CreateEvidenceInput, DrugEvidenceContext } from "./evidence-types";

export const drugEvidenceQueryKey = ({ drugId, entityId, slug }: DrugEvidenceContext) =>
  ["drug-editor", "evidence", slug ?? entityId ?? drugId] as const;

export function useDrugEvidence(context: DrugEvidenceContext) {
  const client = useApiClient();
  const queryClient = useQueryClient();
  const { drugId, entityId, slug, validation } = context;
  const canResolveIdentity = Boolean(slug || entityId || drugId);
  const queryKey = drugEvidenceQueryKey(context);

  const evidenceQuery = useQuery({
    queryKey,
    queryFn: () => fetchDrugEvidence(client, context),
    enabled: canResolveIdentity,
    staleTime: 30_000,
  });

  const missingRequirements = useMemo(
    () => missingRequirementsFromValidation(validation),
    [validation],
  );

  const summary = useMemo(
    () => summarizeDrugEvidence(evidenceQuery.data ?? [], missingRequirements),
    [evidenceQuery.data, missingRequirements],
  );

  const invalidate = useCallback(async () => {
    await queryClient.invalidateQueries({ queryKey });
  }, [queryClient, queryKey]);

  const attachMutation = useMutation({
    mutationFn: (evidenceId: string) => attachEvidenceToDrug(client, context, evidenceId),
    onSuccess: invalidate,
  });

  const detachMutation = useMutation({
    mutationFn: (evidenceId: string) => detachEvidenceFromDrug(client, context, evidenceId),
    onSuccess: invalidate,
  });

  const createMutation = useMutation({
    mutationFn: (input: CreateEvidenceInput) => createEvidenceRecord(client, input),
    onSuccess: async (created) => {
      await attachEvidenceToDrug(client, context, created.id);
      await invalidate();
    },
  });

  const searchMutation = useMutation({
    mutationFn: (query: string) => searchEvidence(client, { q: query, limit: 20 }),
  });

  const actionError = useMemo(() => {
    const error =
      attachMutation.error ?? detachMutation.error ?? createMutation.error ?? searchMutation.error;
    if (!error) return null;
    if (error instanceof ApiError) return error.message;
    if (error instanceof Error) return error.message;
    return "Evidence action failed.";
  }, [attachMutation.error, createMutation.error, detachMutation.error, searchMutation.error]);

  const isMutating =
    attachMutation.isPending || detachMutation.isPending || createMutation.isPending;

  return {
    drugKey: slug ?? entityId ?? drugId,
    attachments: evidenceQuery.data ?? [],
    missingRequirements,
    summary,
    loading: evidenceQuery.isLoading,
    error: evidenceQuery.error
      ? evidenceQuery.error instanceof ApiError
        ? evidenceQuery.error.message
        : "Unable to load evidence for this drug."
      : null,
    actionError,
    isMutating,
    refetch: evidenceQuery.refetch,
    attachEvidence: attachMutation.mutateAsync,
    detachEvidence: detachMutation.mutateAsync,
    createAndAttachEvidence: createMutation.mutateAsync,
    searchEvidence: searchMutation.mutateAsync,
    searchResults: searchMutation.data ?? [],
    searchPending: searchMutation.isPending,
  };
}

export type UseDrugEvidenceResult = ReturnType<typeof useDrugEvidence>;
