import { fetchDashboard } from "./dashboard";
import { buildPaginationParams } from "./pagination";
import { createTransport, type TransportRequestOptions } from "./transport";
import type {
  AuditLogItem,
  AuthSession,
  CompareInput,
  CreateWorkflowInput,
  CurriculumData,
  DrugBrowseItem,
  DrugPackage,
  DrugSummary,
  HealthData,
  InfoData,
  JobItem,
  ModuleItem,
  PackageValidation,
  PaginationParams,
  PublishPackageInput,
  StatisticsData,
  ValidationResult,
  WorkflowItem,
} from "./types";

export interface ClientConfig {
  baseUrl: string;
  getSession?: () => AuthSession | null;
  getDatasetVersion?: () => string | null;
  onUnauthorized?: () => void;
  refreshSession?: () => Promise<boolean>;
  defaultRetries?: number;
}

export type RequestOptions = TransportRequestOptions;

export class FarmacoGraphClient {
  private readonly transport;

  constructor(config: ClientConfig) {
    this.transport = createTransport({
      baseUrl: config.baseUrl,
      getSession: config.getSession,
      getDatasetVersion: config.getDatasetVersion,
      onUnauthorized: config.onUnauthorized,
      refreshSession: config.refreshSession,
      defaultRetries: config.defaultRetries,
    });
  }

  get interceptors() {
    return this.transport.interceptorRegistry;
  }

  request<T>(path: string, options: RequestOptions = {}) {
    return this.transport.request<T>(path, options);
  }

  health() {
    return this.request<HealthData>("/health");
  }

  info() {
    return this.request<InfoData>("/info");
  }

  statistics() {
    return this.request<StatisticsData>("/statistics");
  }

  modules() {
    return this.request<ModuleItem[]>("/modules");
  }

  curriculum(moduleSlug: string) {
    return this.request<CurriculumData>(`/modules/${moduleSlug}/curriculum`);
  }

  search(q: string, options?: PaginationParams & { datasetVersion?: string | null }) {
    const { datasetVersion, ...pagination } = options ?? {};
    return this.request<DrugSummary[]>("/search", {
      params: { q, ...buildPaginationParams(pagination) },
      datasetVersion,
    });
  }

  drugs(
    moduleOrOptions?: string | (PaginationParams & { module?: string; datasetVersion?: string | null }),
  ) {
    const options =
      typeof moduleOrOptions === "string" ? { module: moduleOrOptions } : (moduleOrOptions ?? {});
    const { module, datasetVersion, ...pagination } = options;
    return this.request<DrugSummary[]>("/drugs", {
      params: { module, ...buildPaginationParams(pagination) },
      datasetVersion,
    });
  }

  getDrug(drugId: string, datasetVersion?: string | null) {
    const params: Record<string, string | number | boolean | undefined> = {};
    if (datasetVersion) params.dataset_version = datasetVersion;
    return this.request<Record<string, unknown>>(`/drugs/${drugId}`, {
      params,
      datasetVersion,
    });
  }

  getDrugPrerequisites(drugSlug: string) {
    return this.request<Record<string, unknown>>(`/drugs/${drugSlug}/prerequisites`);
  }

  dashboard(module = "cardiovascular") {
    return fetchDashboard(this, module);
  }

  auditLogs(options?: PaginationParams & { resourceType?: string }) {
    const { resourceType, ...pagination } = options ?? {};
    return this.request<AuditLogItem[]>("/audit-logs", {
      params: { resource_type: resourceType, ...buildPaginationParams(pagination) },
    });
  }

  jobs(options?: PaginationParams & { status?: string; jobType?: string }) {
    const { status, jobType, ...pagination } = options ?? {};
    return this.request<JobItem[]>("/jobs", {
      params: { status, job_type: jobType, ...buildPaginationParams(pagination) },
    });
  }

  curatorQueue(state = "review", options?: PaginationParams) {
    return this.request<WorkflowItem[]>("/curator/queue", {
      params: { state, ...buildPaginationParams(options) },
    });
  }

  getWorkflow(workflowId: string) {
    return this.request<WorkflowItem>(`/curator/workflows/${workflowId}`);
  }

  createWorkflow(body: CreateWorkflowInput) {
    return this.request<WorkflowItem>("/curator/workflows", { method: "POST", body });
  }

  submitWorkflow(workflowId: string) {
    return this.request<WorkflowItem>(`/curator/workflows/${workflowId}/submit`, { method: "POST" });
  }

  approveWorkflow(workflowId: string) {
    return this.request<WorkflowItem>(`/curator/workflows/${workflowId}/approve`, { method: "POST" });
  }

  curatorDrugs(options?: {
    module?: string;
    search?: string;
    status?: string;
    workflowState?: string;
    sort?: string;
  } & PaginationParams) {
    const { module, search, status, workflowState, sort, ...pagination } = options ?? {};
    return this.request<DrugBrowseItem[]>("/curator/drugs", {
      params: {
        module,
        search,
        status,
        workflow_state: workflowState,
        sort,
        ...buildPaginationParams(pagination),
      },
    });
  }

  openDrugWorkflow(slug: string) {
    return this.request<{
      workflow: WorkflowItem;
      package: DrugPackage;
      validation: PackageValidation;
    }>(`/curator/drugs/${slug}/workflows`, { method: "POST" });
  }

  getDrugPackage(slug: string) {
    return this.request<DrugPackage>(`/curator/drugs/${slug}/package`);
  }

  saveWorkflowPackage(workflowId: string, body: PublishPackageInput) {
    return this.request<{ workflow: WorkflowItem; validation: PackageValidation }>(
      `/curator/workflows/${workflowId}/package`,
      { method: "PUT", body },
    );
  }

  publishWorkflow(workflowId: string, body: PublishPackageInput) {
    return this.request<WorkflowItem>(`/curator/workflows/${workflowId}/publish`, {
      method: "POST",
      body,
    });
  }

  validatePackage(body: PublishPackageInput) {
    return this.request<ValidationResult>("/curator/validate", { method: "POST", body });
  }

  getCardiovascularStub() {
    return this.request<Record<string, unknown>>("/curator/stubs/cardiovascular");
  }

  explain(params: { drug: string; effect?: string; questionType?: string }) {
    return this.request<Record<string, unknown>>("/explain", {
      params: {
        drug: params.drug,
        effect: params.effect,
        question_type: params.questionType ?? "mechanism",
      },
    });
  }

  compare(body: CompareInput) {
    return this.request<Record<string, unknown>>("/compare", { method: "POST", body });
  }
}

export function createApiClient(config: ClientConfig): FarmacoGraphClient {
  return new FarmacoGraphClient(config);
}
