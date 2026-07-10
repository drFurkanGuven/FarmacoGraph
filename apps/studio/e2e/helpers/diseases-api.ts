import type { Page, Route } from "@playwright/test";
import { json } from "./drugs-api";

const HYPERTENSION_PACKAGE = {
  entity_payload: {
    id: "a1b2c3d4-5805-5693-bdeb-01bb4829b1b9",
    entity_type: "Disease",
    slug: "hypertension",
    label: "Hypertension",
    description: "Elevated blood pressure.",
    prevalence_note: "",
    external_ids: { icd10: "I10", mesh: "" },
    provenance: {
      created_at: "2026-07-08T00:00:00+00:00",
      updated_at: "2026-07-08T00:00:00+00:00",
      created_by: "curator@farmacograph.local",
      source: "manual",
      curator_attestation: true,
    },
    versioning: {
      dataset_version: "2026.1.0",
      ontology_version: "1.0.0",
      valid_from: "2026-07-08",
      status: "draft",
    },
  },
  related_entities: [],
  relationships: [],
  module: "cardiovascular",
  dataset_version: "2026.1.0",
};

const HYPERTENSION_WORKFLOW = {
  id: "wf-hypertension",
  entity_id: "a1b2c3d4-5805-5693-bdeb-01bb4829b1b9",
  entity_type: "Disease",
  state: "draft",
  notes: null,
  entity_slug: "hypertension",
  entity_label: "Hypertension",
};

/** Minimal API stubs for Disease Editor + publish wizard E2E. */
export async function mockDiseaseEditorApi(page: Page): Promise<void> {
  await page.route("**/api/v1/**", async (route: Route) => {
    const url = new URL(route.request().url());
    const path = url.pathname.replace(/\/api\/v1\/?/, "");
    const method = route.request().method();

    if (path === "curator/diseases/hypertension/workflows" && method === "POST") {
      return json(route, {
        data: {
          workflow: HYPERTENSION_WORKFLOW,
          package: HYPERTENSION_PACKAGE,
          validation: { valid: true, issues: [] },
        },
        meta: {},
      });
    }

    if (path === "curator/diseases/hypertension/workflow-state") {
      return json(route, {
        data: {
          slug: "hypertension",
          entity_id: HYPERTENSION_PACKAGE.entity_payload.id,
          workflow_id: HYPERTENSION_WORKFLOW.id,
          status: "draft",
          publish_ready: true,
          allowed_transitions: ["review"],
          last_validation: {
            valid: true,
            error_count: 0,
            warning_count: 0,
            publish_ready: true,
            issues: [],
          },
          package: HYPERTENSION_PACKAGE,
        },
        meta: { api_version: "v1" },
      });
    }

    if (path === `curator/workflows/${HYPERTENSION_WORKFLOW.id}/package` && method === "PUT") {
      return json(route, {
        data: {
          workflow: HYPERTENSION_WORKFLOW,
          validation: { valid: true, issues: [] },
        },
        meta: {},
      });
    }

    if (path === `curator/workflows/${HYPERTENSION_WORKFLOW.id}/timeline`) {
      return json(route, { data: [], meta: { count: 0 } });
    }

    if (path === "curator/validate" && method === "POST") {
      return json(route, {
        data: { valid: true, issues: [] },
        meta: {},
      });
    }

    if (path === "curator/validation-summary") {
      return json(route, {
        data: { failed_count: 0, pending_count: 0, recent_failures: [] },
        meta: { api_version: "v1" },
      });
    }

    if (path === "audit-logs") {
      return json(route, { data: [], meta: { total: 0, count: 0 } });
    }

    return json(route, { data: null, meta: {} });
  });
}
