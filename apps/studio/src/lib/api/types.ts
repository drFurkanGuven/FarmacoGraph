/** FarmacoGraph API response envelopes and domain types. */

export interface ResponseMeta {
  api_version?: string;
  dataset_version?: string | null;
  ontology_version?: string;
  query_time_ms?: number | null;
  content_layers?: string[];
  language?: string;
  count?: number;
  total?: number;
  limit?: number;
  offset?: number;
  module?: string;
  error_count?: number;
}

export interface ApiEnvelope<T> {
  data: T;
  meta: ResponseMeta;
}

export interface PaginatedMeta extends ResponseMeta {
  count?: number;
  total?: number;
  limit?: number;
  offset?: number;
}

export interface PaginatedEnvelope<T> {
  data: T[];
  meta: PaginatedMeta;
}

export interface PaginationParams {
  limit?: number;
  offset?: number;
}

export interface HealthData {
  status: string;
  checks: {
    postgresql: string;
    neo4j: string;
    latest_snapshot: string | null;
  };
  dataset_version: string | null;
}

export interface InfoData {
  name: string;
  api_version: string;
  ontology_version: string;
  dataset_version: string;
  published_drugs?: number;
  neo4j?: string;
  environment: string;
}

export interface StatisticsData {
  entity_count: number;
  relationship_count: number;
  evidence_count: number;
  module_stats: Record<string, { slug: string; status: string; drug_count: number }>;
  latest_snapshot: string | null;
}

export interface ModuleItem {
  slug: string;
  name: string;
  status: string;
  drug_count: number;
  dataset_version?: string;
}

export interface CurriculumDrug {
  slug: string;
  status: string;
}

export interface CurriculumCategory {
  slug: string;
  name: string;
  drugs: CurriculumDrug[];
}

export interface CurriculumData {
  curriculum: {
    module: string;
    dataset_version: string;
    target_count: number;
    categories: CurriculumCategory[];
  };
  stats: {
    total_slugs: number;
    by_status: Record<string, number>;
    published_in_graph?: number;
    completion_pct?: number;
  };
  published_in_graph?: number;
  completion_pct?: number;
}

export interface DrugBrowseItem {
  slug: string;
  label: string;
  entity_id: string;
  module: string;
  category_slug: string | null;
  category_name: string | null;
  curriculum_status: string;
  publication_status: string;
  workflow_id: string | null;
  workflow_state: string | null;
  validation_valid: boolean;
  validation_errors: number;
  confidence_score: number | null;
}

export interface DiseaseBrowseItem {
  slug: string;
  label: string;
  entity_id: string;
  module?: string;
  publication_status?: string;
  workflow_id?: string | null;
  workflow_state?: string | null;
  validation_valid?: boolean;
  validation_errors?: number;
}

export interface MechanismFragmentBrowseItem {
  slug: string;
  label: string;
  entity_id: string;
  module?: string;
  publication_status?: string;
  description?: string | null;
}

export interface DrugPackage {
  entity_payload: Record<string, unknown>;
  related_entities?: Record<string, unknown>[];
  relationships?: Record<string, unknown>[];
  education?: Record<string, unknown>[];
  dataset_version?: string;
  module?: string | null;
  create_snapshot?: boolean;
}

export interface EducationResource {
  id: string;
  entity_type: "EducationResource";
  kind?: string;
  slug?: string;
  label?: string;
  text?: string;
  mnemonic?: string;
  expansion?: string;
  mistake?: string;
  correction?: string;
  why_wrong?: string;
  front?: string;
  back?: string;
  hint?: string;
  content_layer: "education";
  audience?: string[];
  difficulty_level?: string;
  language?: string;
  module?: string | null;
  exam_tags?: string[];
  linked_entity_ids?: string[];
}

export interface StudyPlanStep {
  step: string;
  title: string;
  count?: number;
}

export interface StudyViewData {
  drug: Record<string, unknown>;
  education: EducationResource[];
  flashcards: EducationResource[];
  prerequisites: Record<string, unknown>[];
  study_plan: StudyPlanStep[];
  content_layers: string[];
}

export interface GraphNodeData {
  id: string;
  labels?: string[];
  entity_type?: string;
  label?: string;
  slug?: string | null;
  properties?: Record<string, unknown>;
}

export interface GraphEdgeData {
  id: string;
  relationship_type: string;
  source_id: string;
  target_id: string;
  source_type?: string;
  target_type?: string;
  properties?: Record<string, unknown> | null;
}

export interface GraphProjectionData {
  nodes: GraphNodeData[];
  edges: GraphEdgeData[];
  layout_hint?: string;
  depth?: number;
}

export interface MechanismDAGData {
  drug_id: string;
  root_fragment_id: string | null;
  nodes: GraphNodeData[];
  edges: GraphEdgeData[];
  clinical_outcomes?: string[];
  is_acyclic: boolean;
}

export interface ExplainStepData {
  step: number;
  from_entity: Record<string, unknown>;
  relationship: string;
  to_entity: Record<string, unknown>;
  explanation: string;
  evidence_ids: string[];
}

export interface ExplainData {
  question: string;
  answer_summary: string | null;
  reasoning_chain: ExplainStepData[];
  confidence: number | null;
  evidence_level: string | null;
  content_layers: string[];
}

export interface PackageValidation {
  valid: boolean;
  error_count: number;
  warning_count: number;
  issues: Record<string, unknown>[];
  publish_ready?: boolean;
}

export interface OpenDrugWorkflowData {
  workflow: WorkflowItem & { draft_package_json?: DrugPackage | null };
  package: DrugPackage;
  validation: PackageValidation;
}

export type WorkflowState = "draft" | "review" | "approved" | "published" | "deprecated";

export interface WorkflowActorRef {
  actor_id: string | null;
  at: string | null;
}

export interface WorkflowAutosaveInfo {
  at: string | null;
  by: string | null;
}

export interface WorkflowValidationState {
  at: string | null;
  valid: boolean;
  error_count: number;
  warning_count: number;
  publish_ready: boolean;
  issues: Record<string, unknown>[];
}

export interface WorkflowApprovalState {
  status: string | null;
  approved_by: string | null;
  approved_at: string | null;
}

export interface WorkflowSnapshotRef {
  id: string | null;
  version_tag: string | null;
  status: string | null;
  module: string | null;
  released_at: string | null;
  entity_count: number | null;
  relationship_count: number | null;
}

export interface DrugWorkflowState {
  slug: string;
  entity_id: string;
  workflow_id: string | null;
  status: WorkflowState | null;
  curator: WorkflowActorRef | null;
  reviewer: WorkflowActorRef | null;
  approval: WorkflowApprovalState | null;
  last_autosave: WorkflowAutosaveInfo | null;
  last_validation: WorkflowValidationState;
  publish_ready: boolean;
  allowed_transitions: WorkflowState[];
  snapshot: WorkflowSnapshotRef | null;
  package: DrugPackage | null;
}

export interface WorkflowItem {
  id: string;
  entity_id: string;
  entity_type: string;
  state: WorkflowState;
  notes: string | null;
  entity_label?: string | null;
  entity_slug?: string | null;
  created_at?: string | null;
  updated_at?: string | null;
}

export interface GraphWriteResult {
  available: boolean;
  status: string;
}

export interface PublishValidationSummary {
  valid: boolean;
  publish_ready: boolean;
}

export interface PublishWorkflowResult {
  workflow: WorkflowItem;
  published_slug: string | null;
  dataset_version: string | null;
  published_at: string | null;
  graph_write: GraphWriteResult;
  snapshot: WorkflowSnapshotRef | null;
  validation_summary: PublishValidationSummary;
}

export interface DrugSummary {
  id: string;
  slug: string;
  label: string;
  generic_name?: string;
  module?: string;
}

export interface CreateWorkflowInput {
  entity_id: string;
  entity_type: string;
  notes?: string | null;
}

export interface PublishPackageInput {
  entity_payload: Record<string, unknown>;
  related_entities?: Record<string, unknown>[];
  relationships?: Record<string, unknown>[];
  education?: Record<string, unknown>[];
  dataset_version?: string;
  module?: string | null;
  create_snapshot?: boolean;
}

export interface ValidationResult {
  valid: boolean;
  issues: Record<string, unknown>[];
}

export interface CompareInput {
  drug_ids: string[];
  dimensions?: string[];
  include_education?: boolean;
  response_mode?: "minimal" | "summary" | "full" | "graph";
}

export interface AuditLogItem {
  id: string;
  timestamp: string | null;
  action: string;
  resource_type: string;
  resource_id: string | null;
  actor_id: string | null;
  diff: Record<string, unknown> | null;
}

export type WorkflowTimelineKind =
  | "workflow_created"
  | "autosaved"
  | "validation_run"
  | "submitted"
  | "approved"
  | "returned_to_draft"
  | "published"
  | "publish_failed"
  | "snapshot_created"
  | "unknown";

export interface WorkflowTimelineEvent {
  id: string;
  kind: WorkflowTimelineKind;
  action: string;
  timestamp: string | null;
  actor_id: string | null;
  detail: string | null;
  diff: Record<string, unknown> | null;
}

export interface JobItem {
  id: string;
  job_type: string;
  status: string;
  created_at: string | null;
  started_at: string | null;
  completed_at: string | null;
  error_message: string | null;
  payload: Record<string, unknown> | null;
}

export interface DashboardSnapshot {
  version_tag: string | null;
  status: string | null;
  released_at: string | null;
  entity_count: number;
}

export interface SnapshotItem {
  id: string;
  version_tag: string;
  module: string | null;
  status: string;
  ontology_version: string;
  api_version: string;
  entity_count: number;
  relationship_count: number;
  evidence_count: number;
  manifest: Record<string, unknown>;
  released_at: string | null;
  released_by: string | null;
  created_at: string | null;
  updated_at: string | null;
}

export interface DashboardValidationFailure {
  source: string;
  job_id?: string;
  job_type?: string;
  entity_id?: string | null;
  message?: string | null;
  at?: string | null;
}

export interface DashboardData {
  published_drugs?: number;
  health: HealthData;
  statistics: StatisticsData;
  snapshot: DashboardSnapshot;
  curator: {
    queue_counts: Record<string, number>;
    pending_review: WorkflowItem[];
    drafts: WorkflowItem[];
    recently_published: WorkflowItem[];
  };
  activity: AuditLogItem[];
  jobs: {
    counts: Record<string, number>;
    recent: JobItem[];
  };
  validation: {
    failed_count: number;
    pending_count?: number;
    recent_failures: DashboardValidationFailure[];
  };
  module: string;
  curriculum: {
    stats: CurriculumData["stats"];
    published_in_graph: number;
    completion_pct: number;
  } | null;
  ontology_version?: string | null;
}

export type UserRole = "curator" | "reviewer" | "administrator" | "developer" | "viewer";

/** Permission scopes aligned with backend `farmacograph.auth.models.SCOPES`. */
export type AuthScope =
  | "knowledge:read"
  | "knowledge:search"
  | "knowledge:explain"
  | "education:read"
  | "graph:query"
  | "curator:write"
  | "curator:publish"
  | "admin:org"
  | "admin:api_keys";

export interface AuthSession {
  accessToken: string | null;
  refreshToken: string | null;
  apiKey: string | null;
  roles: UserRole[];
  scopes: AuthScope[];
  displayName: string;
  email: string | null;
  /** Unix ms — derived from JWT `exp` when available. */
  expiresAt: number | null;
}

export interface Workspace {
  id: string;
  name: string;
  slug: string;
}

export type { ApiError, ApiErrorBody } from "./errors";
