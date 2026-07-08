import { describe, expect, it } from "vitest";
import type { ValidationIssue } from "@/components/validation/validation-types";
import {
  categorizeEvidenceIssues,
  computeEvidenceGating,
  getNonemptyEvidenceCategories,
  groupValidationIssues,
  isEvidenceIssue,
  isLowConfidenceEvidenceIssue,
  LOW_CONFIDENCE_SCORE_THRESHOLD,
} from "../issue-grouping";
import {
  computePublishValidationState,
  gatePublishAction,
  getEvidenceGatingBlockers,
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

const attestedPackage = {
  entity_payload: {
    id: "drug-1",
    provenance: { curator_attestation: true, source: "manual", created_by: "curator" },
  },
  relationships: [],
};

const samplePackage = {
  entity_payload: {
    id: "drug-1",
    provenance: { curator_attestation: false },
  },
  relationships: [],
};

describe("isEvidenceIssue", () => {
  it("detects provenance and evidence constraint issues", () => {
    expect(isEvidenceIssue(baseIssue({ constraint_id: "FG-C018", message: "Provenance required" }))).toBe(
      true,
    );
    expect(isEvidenceIssue(baseIssue({ constraint_id: "FG-C028", message: "AI draft attestation" }))).toBe(
      true,
    );
    expect(isEvidenceIssue(baseIssue({ constraint_id: "FG-C026", severity: "warning" }))).toBe(true);
    expect(isEvidenceIssue(baseIssue({ message: "Missing drug class" }))).toBe(false);
  });
});

describe("isLowConfidenceEvidenceIssue", () => {
  it("detects low confidence score messages and warning fields", () => {
    expect(
      isLowConfidenceEvidenceIssue(
        baseIssue({
          severity: "warning",
          message: "Relationship confidence score is 0.32",
        }),
      ),
    ).toBe(true);

    expect(
      isLowConfidenceEvidenceIssue(
        baseIssue({
          severity: "warning",
          field: "relationships.TREATS.metadata.confidence_score",
          message: "Low confidence for clinical assertion",
        }),
      ),
    ).toBe(true);

    expect(
      isLowConfidenceEvidenceIssue(
        baseIssue({
          constraint_id: "FG-C018",
          message: "Provenance metadata is required",
        }),
      ),
    ).toBe(false);
  });

  it(`uses threshold ${LOW_CONFIDENCE_SCORE_THRESHOLD}`, () => {
    expect(
      isLowConfidenceEvidenceIssue(
        baseIssue({
          severity: "warning",
          message: `Confidence score: ${LOW_CONFIDENCE_SCORE_THRESHOLD - 0.1}`,
        }),
      ),
    ).toBe(true);
  });
});

describe("categorizeEvidenceIssues", () => {
  it("splits evidence issues into blockers, warnings, missing, and low-confidence buckets", () => {
    const issues = [
      baseIssue({
        constraint_id: "FG-C018",
        message: "Provenance metadata is required",
      }),
      baseIssue({
        constraint_id: "FG-C028",
        message: "AI-assisted drafts require curator attestation before publish",
      }),
      baseIssue({
        constraint_id: "FG-C026",
        severity: "warning",
        message: "FIRST_LINE_FOR should have RECOMMENDED_BY Guideline or SUPPORTED_BY Evidence",
      }),
      baseIssue({
        severity: "warning",
        message: "Relationship confidence score is 0.25 — low confidence evidence",
      }),
    ];

    const categorized = categorizeEvidenceIssues(issues);

    expect(categorized.blockers).toHaveLength(2);
    expect(categorized.missing.length).toBeGreaterThanOrEqual(2);
    expect(categorized.warnings).toHaveLength(2);
    expect(categorized.lowConfidence).toHaveLength(1);
  });
});

describe("computeEvidenceGating", () => {
  it("marks publish as blocked when evidence blockers exist", () => {
    const grouped = groupValidationIssues([
      baseIssue({ constraint_id: "FG-C018", message: "Provenance metadata is required" }),
    ]);

    const gating = computeEvidenceGating(grouped.evidence);

    expect(gating.blockerCount).toBe(1);
    expect(gating.missingCount).toBe(1);
    expect(gating.hasEvidenceBlockers).toBe(true);
    expect(gating.publishBlockedByEvidence).toBe(true);
  });

  it("does not block publish for warnings-only evidence issues", () => {
    const grouped = groupValidationIssues([
      baseIssue({
        constraint_id: "FG-C026",
        severity: "warning",
        message: "FIRST_LINE_FOR should have guideline support",
      }),
    ]);

    const gating = computeEvidenceGating(grouped.evidence);

    expect(gating.warningCount).toBe(1);
    expect(gating.publishBlockedByEvidence).toBe(false);
  });
});

describe("getNonemptyEvidenceCategories", () => {
  it("returns only populated evidence categories in display order", () => {
    const categorized = categorizeEvidenceIssues([
      baseIssue({ constraint_id: "FG-C018", message: "Missing provenance" }),
      baseIssue({
        severity: "warning",
        message: "Confidence score is 0.2",
      }),
    ]);

    const sections = getNonemptyEvidenceCategories(categorized);

    expect(sections.map((section) => section.id)).toEqual(["blockers", "missing", "lowConfidence", "warnings"]);
  });
});

describe("computePublishValidationState evidence integration", () => {
  const validSnapshot: PackageValidationSnapshot = {
    valid: false,
    issues: [],
    publish_ready: false,
    error_count: 1,
    warning_count: 0,
  };

  it("includes evidence gating state with attestation missing", () => {
    const state = computePublishValidationState({
      packageValidation: validSnapshot,
      packageInput: samplePackage,
      workflowState: "approved",
      summary: { failed_count: 0, pending_count: 0, recent_failures: [] },
    });

    expect(state.evidence.blockerCount).toBeGreaterThanOrEqual(1);
    expect(state.evidence.missingCount).toBeGreaterThanOrEqual(1);
    expect(state.message).toContain("evidence blocker");
  });

  it("surfaces low-confidence and warning evidence without blocking when only warnings exist", () => {
    const packageValidation = toPackageValidationSnapshot(
      {
        valid: true,
        issues: [
          {
            constraint_id: "FG-C026",
            level: "biomedical",
            severity: "warning",
            message: "FIRST_LINE_FOR should have RECOMMENDED_BY Guideline or SUPPORTED_BY Evidence",
          },
          {
            level: "biomedical",
            severity: "warning",
            message: "Confidence score is 0.3 for TREATS edge",
          },
        ],
      },
      attestedPackage,
    );

    const state = computePublishValidationState({
      packageValidation,
      packageInput: attestedPackage,
      workflowState: "approved",
      summary: { failed_count: 0, pending_count: 0, recent_failures: [] },
    });

    expect(state.evidence.warningCount).toBe(2);
    expect(state.evidence.lowConfidenceCount).toBe(1);
    expect(state.evidence.publishBlockedByEvidence).toBe(false);
    expect(state.canPublish).toBe(true);
    expect(getEvidenceGatingBlockers(state)).toEqual([
      "1 low-confidence evidence item flagged",
      "2 evidence warnings should be reviewed",
    ]);
  });
});

describe("gatePublishAction evidence gating", () => {
  it("blocks publish when evidence blockers are present", () => {
    const state = computePublishValidationState({
      packageValidation: toPackageValidationSnapshot(
        {
          valid: false,
          issues: [
            {
              constraint_id: "FG-C018",
              level: "biomedical",
              severity: "error",
              message: "Provenance metadata is required",
            },
          ],
        },
        attestedPackage,
      ),
      packageInput: attestedPackage,
      workflowState: "approved",
      summary: { failed_count: 0, pending_count: 0, recent_failures: [] },
    });

    const gate = gatePublishAction("publish", state, "approved");

    expect(gate.allowed).toBe(false);
    expect(gate.reason).toContain("evidence blocker");
  });

  it("blocks submit when evidence blockers are present", () => {
    const state = computePublishValidationState({
      packageValidation: toPackageValidationSnapshot(
        {
          valid: false,
          issues: [
            {
              constraint_id: "FG-C028",
              level: "biomedical",
              severity: "error",
              message: "AI-assisted drafts require curator attestation before publish",
            },
          ],
        },
        samplePackage,
      ),
      packageInput: samplePackage,
      workflowState: "draft",
      summary: { failed_count: 0, pending_count: 0, recent_failures: [] },
    });

    const gate = gatePublishAction("submit", state, "draft");

    expect(gate.allowed).toBe(false);
    expect(gate.reason).toContain("evidence blocker");
  });

  it("allows publish when only evidence warnings exist", () => {
    const state = computePublishValidationState({
      packageValidation: toPackageValidationSnapshot(
        {
          valid: true,
          issues: [
            {
              constraint_id: "FG-C026",
              level: "biomedical",
              severity: "warning",
              message: "FIRST_LINE_FOR should have RECOMMENDED_BY Guideline or SUPPORTED_BY Evidence",
            },
          ],
        },
        attestedPackage,
      ),
      packageInput: attestedPackage,
      workflowState: "approved",
      summary: { failed_count: 0, pending_count: 0, recent_failures: [] },
    });

    const gate = gatePublishAction("publish", state, "approved");

    expect(gate.allowed).toBe(true);
    expect(state.evidence.warningCount).toBe(1);
  });
});
