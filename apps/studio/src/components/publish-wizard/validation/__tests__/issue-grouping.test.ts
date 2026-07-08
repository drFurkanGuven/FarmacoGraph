import { describe, expect, it } from "vitest";
import type { ValidationIssue } from "@/components/validation/validation-types";
import {
  buildAttestationIssue,
  buildWorkflowIssues,
  countBlockingIssues,
  getNonemptyIssueGroups,
  groupValidationIssues,
  hasBlockingIssues,
} from "../issue-grouping";
import {
  computePublishReady,
  computePublishValidationState,
  gatePublishAction,
  isPublishBlocked,
  toPackageValidationSnapshot,
} from "../publish-validation";
import type { PackageValidationSnapshot } from "../types";

const baseIssue = (overrides: Partial<ValidationIssue> = {}): ValidationIssue => ({
  constraint_id: null,
  level: "biomedical",
  severity: "error",
  message: "Test issue",
  field: null,
  entity_id: null,
  relationship_type: null,
  ...overrides,
});

const samplePackage = {
  entity_payload: {
    id: "drug-1",
    entity_type: "Drug",
    provenance: { curator_attestation: false },
  },
  relationships: [],
};

describe("groupValidationIssues", () => {
  it("assigns issues to level-based groups", () => {
    const issues: ValidationIssue[] = [
      baseIssue({ level: "schema", severity: "warning", message: "Missing optional field" }),
      baseIssue({ level: "ontology", message: "Forbidden edge" }),
      baseIssue({ level: "biomedical" }),
      baseIssue({ level: "educational", severity: "warning", message: "Learning objective gap" }),
    ];

    const grouped = groupValidationIssues(issues);

    expect(grouped.schema).toHaveLength(1);
    expect(grouped.ontology).toHaveLength(1);
    expect(grouped.biomedical).toHaveLength(1);
    expect(grouped.educational).toHaveLength(1);
    expect(grouped.evidence).toHaveLength(0);
    expect(grouped.workflow).toHaveLength(0);
  });

  it("routes provenance issues into the evidence group", () => {
    const issues: ValidationIssue[] = [
      baseIssue({
        constraint_id: "FG-C018",
        level: "biomedical",
        message: "Provenance metadata is required",
      }),
      baseIssue({
        level: "schema",
        severity: "warning",
        message: "Evidence source URL is recommended",
      }),
    ];

    const grouped = groupValidationIssues(issues);

    expect(grouped.evidence).toHaveLength(2);
    expect(grouped.biomedical).toHaveLength(1);
    expect(grouped.schema).toHaveLength(1);
  });

  it("adds workflow issues from validation summary context", () => {
    const grouped = groupValidationIssues([], {
      workflowState: "draft",
      entityId: "drug-1",
      summary: {
        failed_count: 1,
        pending_count: 2,
        recent_failures: [
          { source: "graph", entity_id: "drug-1", message: "Integrity check failed" },
        ],
      },
    });

    expect(grouped.workflow).toHaveLength(2);
    expect(grouped.workflow.some((issue) => issue.message.includes("still running"))).toBe(true);
    expect(grouped.workflow.some((issue) => issue.message.includes("Integrity check failed"))).toBe(
      true,
    );
  });

  it("scopes graph failures to the workflow entity when provided", () => {
    const grouped = groupValidationIssues([], {
      workflowState: "approved",
      entityId: "drug-1",
      summary: {
        failed_count: 2,
        pending_count: 0,
        recent_failures: [
          { source: "graph", entity_id: "drug-2", message: "Other drug failed" },
        ],
      },
    });

    expect(grouped.workflow).toHaveLength(0);
  });
});

describe("countBlockingIssues", () => {
  it("counts error-severity issues across all groups", () => {
    const grouped = groupValidationIssues(
      [
        baseIssue({ severity: "error" }),
        baseIssue({ severity: "warning", level: "schema" }),
        baseIssue({ constraint_id: "FG-C018", message: "Missing provenance" }),
      ],
      {
        workflowState: "approved",
        summary: { failed_count: 0, pending_count: 1, recent_failures: [] },
      },
    );

    expect(countBlockingIssues(grouped)).toBe(3);
    expect(hasBlockingIssues(grouped)).toBe(true);
  });
});

describe("getNonemptyIssueGroups", () => {
  it("returns only groups that contain issues in display order", () => {
    const grouped = groupValidationIssues([
      baseIssue({ level: "educational", severity: "warning" }),
      baseIssue({ level: "ontology" }),
    ]);

    const sections = getNonemptyIssueGroups(grouped);

    expect(sections.map((section) => section.id)).toEqual(["ontology", "educational"]);
  });
});

describe("computePublishReady", () => {
  it("requires both valid package and curator attestation", () => {
    expect(
      computePublishReady(true, {
        entity_payload: { provenance: { curator_attestation: true } },
      }),
    ).toBe(true);

    expect(
      computePublishReady(true, {
        entity_payload: { provenance: { curator_attestation: false } },
      }),
    ).toBe(false);

    expect(computePublishReady(false, samplePackage)).toBe(false);
  });
});

describe("computePublishValidationState", () => {
  const validSnapshot: PackageValidationSnapshot = {
    valid: true,
    issues: [],
    publish_ready: false,
    error_count: 0,
    warning_count: 0,
  };

  it("blocks publish when attestation is missing", () => {
    const state = computePublishValidationState({
      packageValidation: { ...validSnapshot, publish_ready: false },
      packageInput: samplePackage,
      workflowState: "approved",
      summary: { failed_count: 0, pending_count: 0, recent_failures: [] },
      entityId: "drug-1",
    });

    expect(state.publishReady).toBe(false);
    expect(state.canPublish).toBe(false);
    expect(state.status).toBe("blocked");
    expect(isPublishBlocked(state)).toBe(true);
    expect(state.grouped.evidence.some((issue) => issue.field?.includes("curator_attestation"))).toBe(
      true,
    );
  });

  it("allows publish when validation, attestation, and workflow state align", () => {
    const attestedPackage = {
      ...samplePackage,
      entity_payload: {
        ...samplePackage.entity_payload,
        provenance: { curator_attestation: true },
      },
    };

    const state = computePublishValidationState({
      packageValidation: toPackageValidationSnapshot({ valid: true, issues: [] }, attestedPackage),
      packageInput: attestedPackage,
      workflowState: "approved",
      summary: { failed_count: 0, pending_count: 0, recent_failures: [] },
    });

    expect(state.canPublish).toBe(true);
    expect(state.status).toBe("ready");
    expect(isPublishBlocked(state)).toBe(false);
  });
});

describe("gatePublishAction", () => {
  const readyState = computePublishValidationState({
    packageValidation: toPackageValidationSnapshot({ valid: true, issues: [] }, {
      entity_payload: { provenance: { curator_attestation: true } },
    }),
    packageInput: { entity_payload: { provenance: { curator_attestation: true } } },
    workflowState: "approved",
    summary: { failed_count: 0, pending_count: 0, recent_failures: [] },
  });

  it("blocks publish when workflow is not approved", () => {
    const gate = gatePublishAction("publish", readyState, "review");
    expect(gate.allowed).toBe(false);
    expect(gate.reason).toContain("approved");
  });

  it("allows publish when backend validation is publish-ready", () => {
    const gate = gatePublishAction("publish", readyState, "approved");
    expect(gate.allowed).toBe(true);
    expect(gate.reason).toBeNull();
  });

  it("blocks submit when blocking validation errors exist", () => {
    const attestedPackage = {
      ...samplePackage,
      entity_payload: {
        ...samplePackage.entity_payload,
        provenance: { curator_attestation: true, source: "manual", created_by: "curator" },
      },
    };

    const blockedState = computePublishValidationState({
      packageValidation: toPackageValidationSnapshot(
        {
          valid: false,
          issues: [{ level: "schema", severity: "error", message: "Required field missing" }],
        },
        attestedPackage,
      ),
      packageInput: attestedPackage,
      workflowState: "draft",
      summary: { failed_count: 0, pending_count: 0, recent_failures: [] },
    });

    const gate = gatePublishAction("submit", blockedState, "draft");
    expect(gate.allowed).toBe(false);
    expect(gate.reason).toMatch(/evidence blocker|blocking validation issue/i);
  });
});

describe("buildAttestationIssue", () => {
  it("creates a biomedical error targeting the attestation field", () => {
    const issue = buildAttestationIssue();
    expect(issue.level).toBe("biomedical");
    expect(issue.severity).toBe("error");
    expect(issue.field).toContain("curator_attestation");
  });
});
