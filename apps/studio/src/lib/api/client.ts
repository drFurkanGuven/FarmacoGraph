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
  DiseaseBrowseItem,
  MechanismFragmentBrowseItem,
  DrugPackage,
  EducationResource,
  ExplainData,
  GraphProjectionData,
  MechanismDAGData,
  DrugSummary,
  DrugWorkflowState,
  HealthData,
  InfoData,
  JobItem,
  ModuleItem,
  PackageValidation,
  PaginationParams,
  PublishPackageInput,
  PublishWorkflowResult,
  StatisticsData,
  StudyViewData,
  SnapshotItem,
  ValidationResult,
  WorkflowItem,
  WorkflowTimelineEvent,
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

  getDrugEducation(drugId: string, datasetVersion?: string | null) {
    const params: Record<string, string | number | boolean | undefined> = {};
    if (datasetVersion) params.dataset_version = datasetVersion;
    return this.request<EducationResource[]>(`/drugs/${drugId}/education`, {
      params,
      datasetVersion,
    });
  }

  getDrugFlashcards(drugId: string, datasetVersion?: string | null) {
    const params: Record<string, string | number | boolean | undefined> = {};
    if (datasetVersion) params.dataset_version = datasetVersion;
    return this.request<EducationResource[]>(`/drugs/${drugId}/education/flashcards`, {
      params,
      datasetVersion,
    });
  }

  getDrugPrerequisites(drugSlug: string) {
    return this.request<Record<string, unknown>>(`/drugs/${drugSlug}/prerequisites`);
  }

  getDrugStudyView(drugRef: string) {
    return this.request<StudyViewData>(`/drugs/${drugRef}/study`);
  }

  getDrugGraph(
    drugId: string,
    options?: { depth?: number; datasetVersion?: string | null },
  ) {
    const { depth, datasetVersion } = options ?? {};
    const params: Record<string, string | number | boolean | undefined> = {};
    if (depth) params.depth = depth;
    if (datasetVersion) params.dataset_version = datasetVersion;
    return this.request<GraphProjectionData>(`/drugs/${drugId}/graph`, {
      params,
      datasetVersion,
    });
  }

  getDrugMechanism(drugId: string, datasetVersion?: string | null) {
    const params: Record<string, string | number | boolean | undefined> = {};
    if (datasetVersion) params.dataset_version = datasetVersion;
    return this.request<MechanismDAGData>(`/drugs/${drugId}/mechanism`, {
      params,
      datasetVersion,
    });
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

  getWorkflowTimeline(workflowId: string, options?: PaginationParams) {
    return this.request<WorkflowTimelineEvent[]>(`/curator/workflows/${workflowId}/timeline`, {
      params: buildPaginationParams(options),
    });
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

  returnWorkflowToDraft(workflowId: string) {
    return this.request<WorkflowItem>(`/curator/workflows/${workflowId}/return-to-draft`, { method: "POST" });
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

  diseases(options?: PaginationParams & { search?: string }) {
    const { search, ...pagination } = options ?? {};
    return this.request<Record<string, unknown>[]>("/diseases", {
      params: { search, ...buildPaginationParams(pagination) },
    });
  }

  curatorDiseases(options?: {
    search?: string;
    status?: string;
    workflowState?: string;
    sort?: string;
  } & PaginationParams) {
    const { search, status, workflowState, sort, ...pagination } = options ?? {};
    return this.request<DiseaseBrowseItem[]>("/curator/diseases", {
      params: {
        search,
        status,
        workflow_state: workflowState,
        sort,
        ...buildPaginationParams(pagination),
      },
    });
  }

  createDisease(input: {
    slug: string;
    label: string;
    description?: string;
    icd10?: string;
    mesh?: string;
  }) {
    return this.request<{
      entity: {
        id: string;
        slug: string;
        label: string;
        entity_type: string;
        description?: string | null;
        icd10?: string | null;
        mesh?: string | null;
        status?: string;
      };
      workflow: WorkflowItem;
      package: DrugPackage;
      validation: PackageValidation;
    }>("/curator/diseases", { method: "POST", body: input });
  }

  curatorMechanismFragments(options?: { search?: string; sort?: string } & PaginationParams) {
    const { search, sort, ...pagination } = options ?? {};
    return this.request<MechanismFragmentBrowseItem[]>("/curator/mechanism-fragments", {
      params: {
        search,
        sort,
        ...buildPaginationParams(pagination),
      },
    });
  }

  openDiseaseWorkflow(slug: string) {
    return this.request<{
      workflow: WorkflowItem;
      package: DrugPackage;
      validation: PackageValidation;
    }>(`/curator/diseases/${slug}/workflows`, { method: "POST" });
  }

  getDiseasePackage(slug: string) {
    return this.request<DrugPackage>(`/curator/diseases/${slug}/package`);
  }

  getDiseaseWorkflowState(slug: string) {
    return this.request<DrugWorkflowState>(`/curator/diseases/${slug}/workflow-state`);
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

  getDrugWorkflowState(slug: string) {
    return this.request<DrugWorkflowState>(`/curator/drugs/${slug}/workflow-state`);
  }

  getCuratorDrugEducation(slug: string) {
    return this.request<EducationResource[]>(`/curator/drugs/${slug}/education`);
  }

  getCuratorDrugFlashcards(slug: string) {
    return this.request<EducationResource[]>(`/curator/drugs/${slug}/education/flashcards`);
  }

  saveWorkflowPackage(workflowId: string, body: PublishPackageInput) {
    return this.request<{ workflow: WorkflowItem; validation: PackageValidation }>(
      `/curator/workflows/${workflowId}/package`,
      { method: "PUT", body },
    );
  }

  publishWorkflow(workflowId: string, body: PublishPackageInput) {
    return this.request<PublishWorkflowResult>(`/curator/workflows/${workflowId}/publish`, {
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

  snapshots(options?: PaginationParams & { module?: string }) {
    const { module, ...pagination } = options ?? {};
    return this.request<SnapshotItem[]>("/snapshots", {
      params: { module, ...buildPaginationParams(pagination) },
    });
  }

  snapshot(versionTag: string) {
    return this.request<SnapshotItem>(`/snapshots/${encodeURIComponent(versionTag)}`);
  }

  explain(params: { drug: string; effect?: string; questionType?: string }) {
    return this.request<ExplainData>("/explain", {
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
