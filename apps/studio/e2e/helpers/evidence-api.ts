import type { Page, Route } from "@playwright/test";
import { json } from "./drugs-api";

const RAMIPRIL_ENTITY_ID = "2c31ee65-5805-5693-bdeb-01bb4829b1b9";
const RAMIPRIL_WORKFLOW_ID = "wf-ramipril";

interface MockEvidenceRecord {
  id: string;
  title: string;
  evidence_type: string;
  quality_score: number;
  year: number | null;
  status: string;
  extract: string | null;
}

function createRamiprilPackage(curatorAttestation: boolean) {
  return {
    entity_payload: {
      id: RAMIPRIL_ENTITY_ID,
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
        curator_attestation: curatorAttestation,
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
    related_entities: [],
    relationships: [],
    dataset_version: "2026.1.0",
    module: "cardiovascular",
    create_snapshot: false,
  };
}

const RAMIPRIL_WORKFLOW = {
  id: RAMIPRIL_WORKFLOW_ID,
  entity_id: RAMIPRIL_ENTITY_ID,
  entity_type: "Drug",
  state: "draft",
  notes: null,
  entity_slug: "ramipril",
};

const CATALOG_EVIDENCE: MockEvidenceRecord = {
  id: "a1000000-0000-4000-8000-000000000001",
  title: "E2E catalog citation stub",
  evidence_type: "review_article",
  quality_score: 0.75,
  year: 2026,
  status: "draft",
  extract: null,
};

function readAttestation(body: unknown): boolean | null {
  if (!body || typeof body !== "object" || Array.isArray(body)) return null;
  const entityPayload = (body as { entity_payload?: unknown }).entity_payload;
  if (!entityPayload || typeof entityPayload !== "object" || Array.isArray(entityPayload)) {
    return null;
  }
  const provenance = (entityPayload as { provenance?: unknown }).provenance;
  if (!provenance || typeof provenance !== "object" || Array.isArray(provenance)) {
    return null;
  }
  const attestation = (provenance as { curator_attestation?: unknown }).curator_attestation;
  return attestation === true;
}

function attachmentPayload(record: MockEvidenceRecord) {
  return {
    evidence_id: record.id,
    evidence: record,
    attached_at: "2026-07-08T10:00:00+00:00",
    relationship_type: "SUPPORTED_BY",
    target_id: RAMIPRIL_ENTITY_ID,
  };
}

/**
 * Playwright mocks for Drug Editor evidence workflow on ramipril.
 * Implements the Studio client contract (`/curator/drugs/{slug}/evidence`, `/evidence`).
 */
export async function mockEvidenceWorkflowApi(page: Page): Promise<void> {
  let curatorAttestation = false;
  let currentPackage = createRamiprilPackage(false);
  const attachments: MockEvidenceRecord[] = [];
  const catalog = new Map<string, MockEvidenceRecord>([[CATALOG_EVIDENCE.id, CATALOG_EVIDENCE]]);
  let nextEvidenceId = 2;

  await page.route("**/api/v1/**", async (route) => {
    const url = new URL(route.request().url());
    const path = url.pathname.replace(/\/api\/v1\/?/, "");
    const method = route.request().method();

    if (path === "modules") {
      return json(route, {
        data: [{ slug: "cardiovascular", name: "Cardiovascular" }],
        meta: { count: 1 },
      });
    }

    if (path === "curator/queue" || path.startsWith("curator/queue")) {
      return json(route, { data: [], meta: { total: 0, count: 0 } });
    }

    if (path === "audit-logs") {
      return json(route, { data: [], meta: { total: 0, count: 0 } });
    }

    if (path.startsWith("explain")) {
      return json(route, { data: {}, meta: {} });
    }

    if (path === `curator/workflows/${RAMIPRIL_WORKFLOW_ID}/timeline`) {
      return json(route, { data: [], meta: { count: 0 } });
    }

    if (path === "curator/drugs/ramipril/workflows" && method === "POST") {
      return json(route, {
        data: {
          workflow: RAMIPRIL_WORKFLOW,
          package: currentPackage,
          validation: { valid: true, issues: [] },
        },
        meta: {},
      });
    }

    if (path === `curator/workflows/${RAMIPRIL_WORKFLOW_ID}/package` && method === "PUT") {
      const body = route.request().postDataJSON();
      const attested = readAttestation(body);
      if (attested !== null) {
        curatorAttestation = attested;
        currentPackage = createRamiprilPackage(curatorAttestation);
      }

      return json(route, {
        data: {
          workflow: RAMIPRIL_WORKFLOW,
          validation: { valid: true, issues: [] },
        },
        meta: {},
      });
    }

    if (path === "curator/validate" && method === "POST") {
      const body = route.request().postDataJSON();
      const attested = readAttestation(body);
      if (attested !== null) {
        curatorAttestation = attested;
        currentPackage = createRamiprilPackage(curatorAttestation);
      }

      return json(route, {
        data: { valid: true, issues: [] },
        meta: {},
      });
    }

    if (path === "curator/drugs/ramipril/workflow-state") {
      return json(route, {
        data: {
          slug: "ramipril",
          entity_id: RAMIPRIL_ENTITY_ID,
          workflow_id: RAMIPRIL_WORKFLOW_ID,
          status: "draft",
          publish_ready: curatorAttestation,
          allowed_transitions: ["review"],
          last_validation: {
            valid: true,
            error_count: 0,
            warning_count: 0,
            publish_ready: curatorAttestation,
            issues: [],
          },
          package: currentPackage,
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

    if (path === "curator/drugs/ramipril/evidence" && method === "GET") {
      return json(route, {
        data: attachments.map((record) => attachmentPayload(record)),
        meta: { count: attachments.length, total: attachments.length },
      });
    }

    if (path === "curator/drugs/ramipril/evidence" && method === "POST") {
      const body = route.request().postDataJSON() as { evidence_id?: string };
      const record = body.evidence_id ? catalog.get(body.evidence_id) : undefined;
      if (!record) {
        return json(route, { error: { code: "not_found", message: "Evidence not found." } }, 404);
      }
      if (!attachments.some((entry) => entry.id === record.id)) {
        attachments.push(record);
      }
      return json(route, { data: attachmentPayload(record), meta: {} }, 201);
    }

    if (path.startsWith("curator/drugs/ramipril/evidence/") && method === "DELETE") {
      const evidenceId = path.split("/").pop()!;
      const index = attachments.findIndex((entry) => entry.id === evidenceId);
      if (index >= 0) {
        attachments.splice(index, 1);
      }
      return json(route, { data: { detached: true }, meta: {} });
    }

    if (path === "evidence" && method === "GET") {
      const query = url.searchParams.get("q") ?? url.searchParams.get("search") ?? "";
      const results = [...catalog.values()].filter((entry) =>
        query ? entry.title.toLowerCase().includes(query.toLowerCase()) : true,
      );
      return json(route, {
        data: results,
        meta: { count: results.length, total: results.length, limit: 20, offset: 0 },
      });
    }

    if (path === "evidence" && method === "POST") {
      const body = route.request().postDataJSON() as {
        title?: string;
        evidence_type?: string;
        quality_score?: number;
        year?: number | null;
        extract?: string | null;
      };
      const id = `a1000000-0000-4000-8000-${String(nextEvidenceId++).padStart(12, "0")}`;
      const record: MockEvidenceRecord = {
        id,
        title: body.title ?? "Untitled evidence",
        evidence_type: body.evidence_type ?? "review_article",
        quality_score: typeof body.quality_score === "number" ? body.quality_score : 0.5,
        year: typeof body.year === "number" ? body.year : null,
        status: "draft",
        extract: body.extract ?? null,
      };
      catalog.set(id, record);
      return json(route, { data: record, meta: {} }, 201);
    }

    return json(route, { data: null, meta: {} });
  });
}
