import { ApiError } from "./errors";
import { FarmacoGraphClient } from "./client";
import type {
  ApiEnvelope,
  CurriculumData,
  DashboardData,
  DrugSummary,
  HealthData,
  InfoData,
  JobItem,
  StatisticsData,
  WorkflowItem,
} from "./types";

export function resolveModuleSlug(workspaceSlug: string): string {
  return workspaceSlug === "default" ? "cardiovascular" : workspaceSlug;
}

function settle<T>(result: PromiseSettledResult<T>, fallback: T): T {
  return result.status === "fulfilled" ? result.value : fallback;
}

function workflowsFromItems(items: WorkflowItem[]): DashboardData["curator"]["pending_review"] {
  return items.map((item) => ({
    id: item.id,
    entity_id: item.entity_id,
    entity_type: item.entity_type,
    state: item.state,
    notes: item.notes,
    entity_label: item.entity_label,
    entity_slug: item.entity_slug,
    created_at: item.created_at,
    updated_at: item.updated_at,
  }));
}

function publishedFromDrugs(drugs: DrugSummary[]): DashboardData["curator"]["recently_published"] {
  return drugs.slice(0, 10).map((drug) => ({
    id: drug.id,
    entity_id: drug.id,
    entity_type: "Drug",
    state: "published",
    entity_label: drug.label,
    entity_slug: drug.slug,
    notes: null,
  }));
}

function validationFromJobs(jobs: JobItem[]): DashboardData["validation"] {
  const failed = jobs.filter((job) => job.status === "failed");
  return {
    failed_count: failed.length,
    pending_count: jobs.filter((job) => job.status === "pending").length,
    recent_failures: failed.slice(0, 10).map((job) => ({
      source: "job",
      job_id: job.id,
      job_type: job.job_type,
      entity_id: (job.payload?.entity_id as string | undefined) ?? null,
      message: job.error_message,
      at: job.completed_at,
    })),
  };
}

export async function composeDashboardFallback(
  client: FarmacoGraphClient,
  module: string,
): Promise<ApiEnvelope<DashboardData>> {
  const [
    healthResult,
    infoResult,
    statsResult,
    curriculumResult,
    reviewResult,
    draftResult,
    drugsResult,
    auditResult,
    jobsResult,
  ] = await Promise.allSettled([
    client.health(),
    client.info(),
    client.statistics(),
    client.curriculum(module),
    client.curatorQueue("review"),
    client.curatorQueue("draft"),
    client.drugs({ module }),
    client.auditLogs({ limit: 15 }),
    client.jobs({ limit: 10 }),
  ]);

  const healthEnvelope = settle(healthResult, null);
  const infoEnvelope = settle(infoResult, null);
  const statsEnvelope = settle(statsResult, null);
  const curriculumEnvelope = settle(curriculumResult, null);
  const reviewEnvelope = settle(reviewResult, null);
  const draftEnvelope = settle(draftResult, null);
  const drugsEnvelope = settle(drugsResult, null);
  const auditEnvelope = settle(auditResult, null);
  const jobsEnvelope = settle(jobsResult, null);

  const health: HealthData = healthEnvelope?.data ?? {
    status: "unknown",
    checks: { postgresql: "—", neo4j: "—", latest_snapshot: null },
    dataset_version: null,
  };
  const info: InfoData | null = infoEnvelope?.data ?? null;
  const statistics: StatisticsData = statsEnvelope?.data ?? {
    entity_count: 0,
    relationship_count: 0,
    evidence_count: 0,
    module_stats: {},
    latest_snapshot: null,
  };
  const curriculum: CurriculumData | null = curriculumEnvelope?.data ?? null;

  const pendingReview = reviewEnvelope ? workflowsFromItems(reviewEnvelope.data) : [];
  const drafts = draftEnvelope ? workflowsFromItems(draftEnvelope.data) : [];
  const recentlyPublished = drugsEnvelope ? publishedFromDrugs(drugsEnvelope.data) : [];

  const queueCounts: Record<string, number> = {
    review: pendingReview.length,
    draft: drafts.length,
    published: recentlyPublished.length,
  };

  const activity = auditEnvelope?.data ?? [];
  const recentJobs = jobsEnvelope?.data ?? [];
  const jobCounts =
    recentJobs.length > 0
      ? recentJobs.reduce<Record<string, number>>((acc, job) => {
          acc[job.status] = (acc[job.status] ?? 0) + 1;
          return acc;
        }, {})
      : {};

  const snapshotVersion =
    health.checks.latest_snapshot ?? statistics.latest_snapshot ?? info?.dataset_version ?? null;

  const data: DashboardData = {
    health,
    statistics,
    snapshot: {
      version_tag: snapshotVersion,
      status: snapshotVersion ? "published" : null,
      released_at: null,
      entity_count: statistics.entity_count,
    },
    curator: {
      queue_counts: queueCounts,
      pending_review: pendingReview,
      drafts,
      recently_published: recentlyPublished,
    },
    activity,
    jobs: {
      counts: jobCounts,
      recent: recentJobs,
    },
    validation: validationFromJobs(recentJobs),
    module,
    curriculum: curriculum
      ? {
          stats: curriculum.stats,
          published_in_graph: curriculum.published_in_graph ?? curriculum.stats.published_in_graph ?? 0,
          completion_pct: curriculum.completion_pct ?? 0,
        }
      : null,
    published_drugs: info?.published_drugs,
    ontology_version: info?.ontology_version ?? statsEnvelope?.meta?.ontology_version ?? null,
  };

  return {
    data,
    meta: statsEnvelope?.meta ?? infoEnvelope?.meta ?? { api_version: "v1" },
  };
}

export async function fetchDashboard(
  client: FarmacoGraphClient,
  module: string,
): Promise<ApiEnvelope<DashboardData>> {
  try {
    return await client.request<DashboardData>("/dashboard", { params: { module } });
  } catch (error) {
    if (error instanceof ApiError && (error.status === 404 || error.status === 405)) {
      return composeDashboardFallback(client, module);
    }
    throw error;
  }
}
