"use client";

import { useMutation } from "@tanstack/react-query";
import { useApiClient } from "@/lib/hooks/use-api-client";
import { fetchDashboard, resolveModuleSlug } from "../dashboard";
import type { CompareInput, CreateWorkflowInput, PublishPackageInput } from "../types";
import { defaultMutationOptions, defaultQueryOptions, DASHBOARD_REFRESH_MS } from "./config";
import { apiQueryKeys } from "./keys";
import { useApiQuery } from "./optimistic";

const UUID_RE = /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{12}$/i;

function isUuid(value: string): boolean {
  return UUID_RE.test(value);
}

export function useHealth() {
  const client = useApiClient();
  return useApiQuery(apiQueryKeys.health(), () => client.health(), defaultQueryOptions);
}

export function useInfo() {
  const client = useApiClient();
  return useApiQuery(apiQueryKeys.info(), () => client.info(), defaultQueryOptions);
}

export function useStatistics() {
  const client = useApiClient();
  return useApiQuery(apiQueryKeys.statistics(), () => client.statistics(), defaultQueryOptions);
}

export function useModules() {
  const client = useApiClient();
  return useApiQuery(apiQueryKeys.modules(), () => client.modules(), defaultQueryOptions);
}

export function useCurriculum(moduleSlug: string) {
  const client = useApiClient();
  return useApiQuery(
    apiQueryKeys.curriculum(moduleSlug),
    () => client.curriculum(moduleSlug),
    { ...defaultQueryOptions, enabled: Boolean(moduleSlug) },
  );
}

export function useCuratorQueue(state: string) {
  const client = useApiClient();
  return useApiQuery(
    apiQueryKeys.curatorQueue(state),
    () => client.curatorQueue(state),
    defaultQueryOptions,
  );
}

export function usePublishedDrugs(module?: string) {
  const client = useApiClient();
  return useApiQuery(
    apiQueryKeys.drugs(module),
    () => client.drugs({ module }),
    defaultQueryOptions,
  );
}

export function useSearch(q: string, enabled = q.trim().length >= 2) {
  const client = useApiClient();
  return useApiQuery(
    apiQueryKeys.search(q),
    () => client.search(q),
    { ...defaultQueryOptions, enabled },
  );
}

export function useDashboard(workspaceSlug = "cardiovascular") {
  const client = useApiClient();
  const moduleSlug = resolveModuleSlug(workspaceSlug);
  return useApiQuery(
    apiQueryKeys.dashboard(moduleSlug),
    () => fetchDashboard(client, moduleSlug),
    { ...defaultQueryOptions, refetchInterval: DASHBOARD_REFRESH_MS },
  );
}

export function useAuditLogs(options?: { resourceType?: string; limit?: number; offset?: number }) {
  const client = useApiClient();
  return useApiQuery(
    apiQueryKeys.auditLogs(options),
    () => client.auditLogs(options),
    defaultQueryOptions,
  );
}

export function useJobs(options?: {
  status?: string;
  jobType?: string;
  limit?: number;
  offset?: number;
}) {
  const client = useApiClient();
  return useApiQuery(
    apiQueryKeys.jobs(options),
    () => client.jobs(options),
    defaultQueryOptions,
  );
}

export function useWorkflow(workflowId: string) {
  const client = useApiClient();
  return useApiQuery(
    apiQueryKeys.workflow(workflowId),
    () => client.getWorkflow(workflowId),
    { ...defaultQueryOptions, enabled: Boolean(workflowId) },
  );
}

export function useWorkflowTimeline(workflowId: string, options?: { limit?: number; offset?: number }) {
  const client = useApiClient();
  return useApiQuery(
    apiQueryKeys.workflowTimeline(workflowId, options),
    () => client.getWorkflowTimeline(workflowId, options),
    { ...defaultQueryOptions, enabled: Boolean(workflowId) },
  );
}

export function useDrug(drugId: string) {
  const client = useApiClient();
  return useApiQuery(
    apiQueryKeys.drug(drugId),
    () => client.getDrug(drugId),
    { ...defaultQueryOptions, enabled: Boolean(drugId) },
  );
}

export function useDrugEducation(drug: string) {
  const client = useApiClient();
  return useApiQuery(
    apiQueryKeys.drugEducation(drug),
    () => (isUuid(drug) ? client.getDrugEducation(drug) : client.getCuratorDrugEducation(drug)),
    { ...defaultQueryOptions, enabled: Boolean(drug) },
  );
}

export function useDrugFlashcards(drug: string) {
  const client = useApiClient();
  return useApiQuery(
    apiQueryKeys.drugFlashcards(drug),
    () => (isUuid(drug) ? client.getDrugFlashcards(drug) : client.getCuratorDrugFlashcards(drug)),
    { ...defaultQueryOptions, enabled: Boolean(drug) },
  );
}

export function useDrugStudyView(drug: string) {
  const client = useApiClient();
  return useApiQuery(
    apiQueryKeys.drugStudyView(drug),
    () => client.getDrugStudyView(drug),
    { ...defaultQueryOptions, enabled: Boolean(drug) },
  );
}

export function useDrugGraph(drug: string, depth = 2) {
  const client = useApiClient();
  return useApiQuery(
    apiQueryKeys.drugGraph(drug, depth),
    () => client.getDrugGraph(drug, { depth }),
    { ...defaultQueryOptions, enabled: Boolean(drug) && isUuid(drug) },
  );
}

export function useDrugMechanism(drug: string) {
  const client = useApiClient();
  return useApiQuery(
    apiQueryKeys.drugMechanism(drug),
    () => client.getDrugMechanism(drug),
    { ...defaultQueryOptions, enabled: Boolean(drug) && isUuid(drug) },
  );
}

export function useExplain(drug: string, effect?: string) {
  const client = useApiClient();
  return useApiQuery(
    apiQueryKeys.explain(drug, effect),
    () => client.explain({ drug, effect }),
    { ...defaultQueryOptions, enabled: Boolean(drug) },
  );
}

export function useCuratorDrugs(options?: {
  module?: string;
  search?: string;
  status?: string;
  workflowState?: string;
  sort?: string;
  limit?: number;
  offset?: number;
}) {
  const client = useApiClient();
  const filters = options ?? {};
  return useApiQuery(
    apiQueryKeys.curatorDrugs(filters),
    () => client.curatorDrugs(options),
    defaultQueryOptions,
  );
}

export function useCuratorDiseases(options?: {
  search?: string;
  status?: string;
  workflowState?: string;
  sort?: string;
  limit?: number;
  offset?: number;
}) {
  const client = useApiClient();
  const filters = options ?? {};
  return useApiQuery(
    apiQueryKeys.curatorDiseases(filters),
    () => client.curatorDiseases(options),
    defaultQueryOptions,
  );
}

export function useDrugPackage(slug: string) {
  const client = useApiClient();
  return useApiQuery(
    apiQueryKeys.drugPackage(slug),
    () => client.getDrugPackage(slug),
    { ...defaultQueryOptions, enabled: Boolean(slug) },
  );
}

export function useDrugWorkflowState(slug: string) {
  const client = useApiClient();
  return useApiQuery(
    apiQueryKeys.drugWorkflowState(slug),
    () => client.getDrugWorkflowState(slug),
    { ...defaultQueryOptions, enabled: Boolean(slug) },
  );
}

export function useDiseaseWorkflowState(slug: string) {
  const client = useApiClient();
  return useApiQuery(
    apiQueryKeys.diseaseWorkflowState(slug),
    () => client.getDiseaseWorkflowState(slug),
    { ...defaultQueryOptions, enabled: Boolean(slug) },
  );
}

export function useOpenDrugWorkflow() {
  const client = useApiClient();
  return useMutation({
    mutationFn: (slug: string) => client.openDrugWorkflow(slug),
    ...defaultMutationOptions,
  });
}

export function useSaveWorkflowPackage() {
  const client = useApiClient();
  return useMutation({
    mutationFn: (input: { workflowId: string; body: PublishPackageInput }) =>
      client.saveWorkflowPackage(input.workflowId, input.body),
    ...defaultMutationOptions,
  });
}

export type { CreateWorkflowInput, PublishPackageInput, CompareInput };
