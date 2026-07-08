import type { Page, Route } from "@playwright/test";

export function json(route: Route, body: unknown, status = 200) {
  return route.fulfill({
    status,
    contentType: "application/json",
    body: JSON.stringify(body),
  });
}

const RAMIPRIL_PACKAGE = {
  entity_payload: {
    id: "2c31ee65-5805-5693-bdeb-01bb4829b1b9",
    entity_type: "Drug",
    slug: "ramipril",
    label: "Ramipril",
    generic_name: "Ramipril",
    module: "cardiovascular",
    routes: ["oral"],
    status: "draft",
    dataset_version: "2026.1.0",
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
    relationships: {
      BELONGS_TO: [],
      TREATS: [],
      HAS_MECHANISM_ROOT: [],
    },
  },
};

const RAMIPRIL_WORKFLOW = {
  id: "wf-ramipril",
  entity_id: "2c31ee65-5805-5693-bdeb-01bb4829b1b9",
  entity_type: "Drug",
  state: "draft",
  notes: null,
  entity_slug: "ramipril",
};

/** Minimal public API stubs for drug browser + editor navigation E2E. */
export async function mockDrugBrowserApi(page: Page): Promise<void> {
  await page.route("**/api/v1/**", async (route) => {
    const url = new URL(route.request().url());
    const path = url.pathname.replace(/\/api\/v1\/?/, "");

    if (path === "modules") {
      return json(route, {
        data: [{ slug: "cardiovascular", name: "Cardiovascular" }],
        meta: { count: 1 },
      });
    }

    if (path === "drugs") {
      return json(route, {
        data: [],
        meta: { total: 0, count: 0, limit: 25, offset: 0 },
      });
    }

    if (path === "modules/cardiovascular/curriculum") {
      return json(route, {
        data: {
          curriculum: {
            module: "cardiovascular",
            dataset_version: "2026.1.0",
            target_count: 1,
            categories: [
              {
                slug: "ace-inhibitors",
                name: "ACE inhibitors",
                drugs: [{ slug: "ramipril", status: "pending" }],
              },
            ],
          },
          stats: {
            total_slugs: 1,
            by_status: { pending: 1 },
            published_in_graph: 0,
            completion_pct: 0,
          },
        },
        meta: { module: "cardiovascular" },
      });
    }

    if (path.startsWith("curator/queue")) {
      return json(route, { data: [], meta: { total: 0, count: 0 } });
    }

    if (path === "audit-logs") {
      return json(route, { data: [], meta: { total: 0, count: 0 } });
    }

    if (path.startsWith("explain")) {
      return json(route, { data: {}, meta: {} });
    }

    if (path === "curator/drugs/ramipril/workflows" && route.request().method() === "POST") {
      return json(route, {
        data: {
          workflow: RAMIPRIL_WORKFLOW,
          package: RAMIPRIL_PACKAGE,
          validation: { valid: true, issues: [] },
        },
        meta: {},
      });
    }

    if (path === "curator/validate" && route.request().method() === "POST") {
      return json(route, {
        data: { valid: true, issues: [] },
        meta: {},
      });
    }

    if (path === "curator/drugs/ramipril/workflow-state") {
      return json(route, {
        data: {
          slug: "ramipril",
          entity_id: RAMIPRIL_PACKAGE.entity_payload.id,
          workflow_id: RAMIPRIL_WORKFLOW.id,
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
          package: RAMIPRIL_PACKAGE,
        },
        meta: { api_version: "v1" },
      });
    }

    if (path === "curator/validation-summary") {
      return json(route, {
        data: { failed_count: 0, pending_count: 0, recent_failures: [] },
        meta: { api_version: "v1" },
      });
    }

    return json(route, { data: null, meta: {} });
  });
}

/** Extends drug browser mocks with workflow-state and validation-summary for publish wizard E2E. */
export async function mockPublishWizardApi(page: Page): Promise<void> {
  await page.route("**/api/v1/curator/workflows/wf-ramipril/timeline", async (route) => {
    return json(route, { data: [], meta: { count: 0 } });
  });
}

export async function mockDrugEditorNotFound(page: Page, slug: string): Promise<void> {
  await page.route("**/api/v1/**", async (route) => {
    const url = new URL(route.request().url());
    const path = url.pathname.replace(/\/api\/v1\/?/, "");

    if (path === `curator/drugs/${slug}/workflows` && route.request().method() === "POST") {
      return json(
        route,
        {
          error: { code: "not_found", message: `Drug "${slug}" was not found.` },
        },
        404,
      );
    }

    return json(route, { data: null, meta: {} });
  });
}
