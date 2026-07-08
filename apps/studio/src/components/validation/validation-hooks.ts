"use client";

import { useApiClient } from "@/lib/hooks/use-api-client";
import { defaultQueryOptions } from "@/lib/api/react-query/config";
import { useApiQuery } from "@/lib/api/react-query/optimistic";
import type { ApiEnvelope, WorkflowItem } from "@/lib/api/types";
import {
  buildRelationshipsFromDrug,
  parseValidationIssues,
} from "./validation-utils";
import type { QueueValidationItem, ValidationSummaryData } from "./validation-types";

const VALIDATION_REFRESH_MS = 30_000;

export const validationQueryKeys = {
  summary: () => ["farmacograph", "validation", "summary"] as const,
  graphJobs: () => ["farmacograph", "validation", "graph-jobs"] as const,
  queuePackages: () => ["farmacograph", "validation", "queue-packages"] as const,
};

const MAX_QUEUE_VALIDATIONS = 15;

async function validateWorkflowDrug(
  client: ReturnType<typeof useApiClient>,
  workflow: WorkflowItem,
): Promise<QueueValidationItem | null> {
  if (workflow.entity_type !== "Drug") {
    return null;
  }

  const drugEnvelope = await client.getDrug(workflow.entity_id);
  const drug = drugEnvelope.data;
  const relationships = buildRelationshipsFromDrug(drug);
  const validationEnvelope = await client.validatePackage({
    entity_payload: drug,
    relationships,
  });

  return {
    workflowId: workflow.id,
    entityId: workflow.entity_id,
    entityLabel:
      workflow.entity_label ??
      (typeof drug.label === "string" ? drug.label : null) ??
      workflow.entity_slug ??
      workflow.entity_id,
    workflowState: workflow.state,
    valid: validationEnvelope.data.valid,
    issues: parseValidationIssues(validationEnvelope.data.issues),
  };
}

export function useValidationSummary() {
  const client = useApiClient();
  return useApiQuery(
    validationQueryKeys.summary(),
    () => client.request<ValidationSummaryData>("/curator/validation-summary"),
    { ...defaultQueryOptions, refetchInterval: VALIDATION_REFRESH_MS },
  );
}

export function useGraphValidationJobs() {
  const client = useApiClient();
  return useApiQuery(
    validationQueryKeys.graphJobs(),
    () => client.jobs({ jobType: "graph_validation", limit: 20 }),
    { ...defaultQueryOptions, refetchInterval: VALIDATION_REFRESH_MS },
  );
}

export function useQueueValidation() {
  const client = useApiClient();

  return useApiQuery(
    validationQueryKeys.queuePackages(),
    async (): Promise<ApiEnvelope<{ items: QueueValidationItem[]; skipped: number }>> => {
      const [draftEnvelope, reviewEnvelope] = await Promise.all([
        client.curatorQueue("draft", { limit: 20 }),
        client.curatorQueue("review", { limit: 20 }),
      ]);

      const workflows = [...draftEnvelope.data, ...reviewEnvelope.data].filter(
        (workflow) => workflow.entity_type === "Drug",
      );
      const candidates = workflows.slice(0, MAX_QUEUE_VALIDATIONS);

      const settled = await Promise.allSettled(
        candidates.map((workflow) => validateWorkflowDrug(client, workflow)),
      );

      const items = settled
        .filter((result): result is PromiseFulfilledResult<QueueValidationItem | null> => result.status === "fulfilled")
        .map((result) => result.value)
        .filter((item): item is QueueValidationItem => item !== null);

      return {
        data: {
          items,
          skipped: Math.max(workflows.length - candidates.length, 0),
        },
        meta: {
          api_version: "v1",
          count: items.length,
        },
      };
    },
    { ...defaultQueryOptions, refetchInterval: VALIDATION_REFRESH_MS, staleTime: 60_000 },
  );
}
