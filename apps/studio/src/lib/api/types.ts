/** FarmacoGraph API response envelopes */

export interface ResponseMeta {
  api_version?: string;
  dataset_version?: string | null;
  ontology_version?: string;
  query_time_ms?: number | null;
  content_layers?: string[];
  language?: string;
}

export interface ApiEnvelope<T> {
  data: T;
  meta: ResponseMeta;
}

export interface ApiErrorBody {
  detail?: string | { msg: string }[];
  message?: string;
}

export class ApiError extends Error {
  readonly status: number;
  readonly body: ApiErrorBody | null;
  readonly traceId: string | null;

  constructor(
    message: string,
    status: number,
    body: ApiErrorBody | null = null,
    traceId: string | null = null,
  ) {
    super(message);
    this.name = "ApiError";
    this.status = status;
    this.body = body;
    this.traceId = traceId;
  }
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

export interface WorkflowItem {
  id: string;
  entity_id: string;
  entity_type: string;
  state: string;
  notes: string | null;
}

export interface DrugSummary {
  id: string;
  slug: string;
  label: string;
  generic_name?: string;
  module?: string;
}

export type UserRole = "curator" | "reviewer" | "administrator" | "developer" | "viewer";

export interface AuthSession {
  accessToken: string | null;
  refreshToken: string | null;
  apiKey: string | null;
  roles: UserRole[];
  displayName: string;
  email: string | null;
}

export interface Workspace {
  id: string;
  name: string;
  slug: string;
}
