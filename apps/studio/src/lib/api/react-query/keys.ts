/** Centralized React Query key factory for FarmacoGraph Studio. */

export const apiQueryKeys = {
  all: ["farmacograph"] as const,
  health: () => [...apiQueryKeys.all, "health"] as const,
  info: () => [...apiQueryKeys.all, "info"] as const,
  statistics: () => [...apiQueryKeys.all, "statistics"] as const,
  modules: () => [...apiQueryKeys.all, "modules"] as const,
  curriculum: (moduleSlug: string) => [...apiQueryKeys.all, "curriculum", moduleSlug] as const,
  search: (q: string) => [...apiQueryKeys.all, "search", q] as const,
  drugs: (module?: string, pagination?: { limit?: number; offset?: number }) =>
    [...apiQueryKeys.all, "drugs", module ?? "all", pagination ?? {}] as const,
  drug: (drugId: string) => [...apiQueryKeys.all, "drug", drugId] as const,
  dashboard: (module: string) => [...apiQueryKeys.all, "dashboard", module] as const,
  auditLogs: (filters?: { resourceType?: string; offset?: number }) =>
    [...apiQueryKeys.all, "audit-logs", filters ?? {}] as const,
  jobs: (filters?: { status?: string; jobType?: string; offset?: number }) =>
    [...apiQueryKeys.all, "jobs", filters ?? {}] as const,
  curatorQueue: (state: string) => [...apiQueryKeys.all, "curator-queue", state] as const,
  curatorDrugs: (filters: Record<string, unknown>) =>
    [...apiQueryKeys.all, "curator-drugs", filters] as const,
  curatorDiseases: (filters: Record<string, unknown>) =>
    [...apiQueryKeys.all, "curator-diseases", filters] as const,
  curatorMechanismFragments: (filters: Record<string, unknown>) =>
    [...apiQueryKeys.all, "curator-mechanism-fragments", filters] as const,
  diseases: (filters?: Record<string, unknown>) =>
    [...apiQueryKeys.all, "diseases", filters ?? {}] as const,
  diseasePackage: (slug: string) => [...apiQueryKeys.all, "disease-package", slug] as const,
  diseaseWorkflowState: (slug: string) =>
    [...apiQueryKeys.all, "disease-workflow-state", slug] as const,
  drugPackage: (slug: string) => [...apiQueryKeys.all, "drug-package", slug] as const,
  drugWorkflowState: (slug: string) => [...apiQueryKeys.all, "drug-workflow-state", slug] as const,
  drugEducation: (drug: string) => [...apiQueryKeys.all, "drug-education", drug] as const,
  drugFlashcards: (drug: string) => [...apiQueryKeys.all, "drug-flashcards", drug] as const,
  drugStudyView: (drug: string) => [...apiQueryKeys.all, "drug-study-view", drug] as const,
  drugGraph: (drug: string, depth?: number) =>
    [...apiQueryKeys.all, "drug-graph", drug, depth ?? 2] as const,
  drugMechanism: (drug: string) => [...apiQueryKeys.all, "drug-mechanism", drug] as const,
  workflow: (workflowId: string) => [...apiQueryKeys.all, "workflow", workflowId] as const,
  workflowTimeline: (workflowId: string, pagination?: { limit?: number; offset?: number }) =>
    [...apiQueryKeys.all, "workflow-timeline", workflowId, pagination ?? {}] as const,
  explain: (drug: string, effect?: string) =>
    [...apiQueryKeys.all, "explain", drug, effect ?? ""] as const,
  evidenceSearch: (q: string, limit?: number) =>
    [...apiQueryKeys.all, "evidence-search", q, limit ?? 100] as const,
  evidence: (id: string) => [...apiQueryKeys.all, "evidence", id] as const,
  snapshots: (filters?: Record<string, unknown>) =>
    [...apiQueryKeys.all, "snapshots", filters ?? {}] as const,
  snapshot: (versionTag: string) => [...apiQueryKeys.all, "snapshot", versionTag] as const,
};
