"use client";

import { useApiClient } from "@/lib/hooks/use-api-client";
import { fetchDashboard, resolveModuleSlug } from "../dashboard";
import type { CompareInput, CreateWorkflowInput, PublishPackageInput } from "../types";
import { defaultQueryOptions, DASHBOARD_REFRESH_MS } from "./config";
import { apiQueryKeys } from "./keys";
import { useApiQuery } from "./optimistic";

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

export function useDrug(drugId: string) {
  const client = useApiClient();
  return useApiQuery(
    apiQueryKeys.drug(drugId),
    () => client.getDrug(drugId),
    { ...defaultQueryOptions, enabled: Boolean(drugId) },
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

export function useDrugPackage(slug: string) {
  const client = useApiClient();
  return useApiQuery(
    apiQueryKeys.drugPackage(slug),
    () => client.getDrugPackage(slug),
    { ...defaultQueryOptions, enabled: Boolean(slug) },
  );
}

export type { CreateWorkflowInput, PublishPackageInput, CompareInput };
