import { describe, expect, it } from "vitest";
import { gatePublishAction, computePublishValidationState, toPackageValidationSnapshot } from "../validation/publish-validation";
import { resolveSectionForField } from "../issue-section-map";

const basePackage = {
  entity_payload: {
    id: "drug-1",
    slug: "ramipril",
    label: "Ramipril",
    provenance: { curator_attestation: true, source: "manual" },
  },
  related_entities: [],
  relationships: [],
};

describe("resolveSectionForField", () => {
  it("maps provenance fields to provenance section", () => {
    expect(resolveSectionForField("entity_payload.provenance.curator_attestation")).toBe("provenance");
  });

  it("maps provenance source fields to provenance section", () => {
    expect(resolveSectionForField("entity_payload.provenance.source")).toBe("provenance");
  });

  it("maps slug fields to identity section", () => {
    expect(resolveSectionForField("entity_payload.slug")).toBe("identity");
  });
});

describe("gatePublishAction", () => {
  it("blocks publish when validation fails", () => {
    const packageValidation = toPackageValidationSnapshot(
      { valid: false, issues: [{ message: "Missing label", severity: "error", level: "schema" }] },
      basePackage,
    );
    const state = computePublishValidationState({
      packageValidation,
      packageInput: basePackage,
      workflowState: "approved",
    });
    const gate = gatePublishAction("publish", state, "approved");
    expect(gate.allowed).toBe(false);
    expect(gate.reason).toBeTruthy();
  });

  it("allows submit in draft when validation passes", () => {
    const packageValidation = toPackageValidationSnapshot({ valid: true, issues: [] }, basePackage);
    const state = computePublishValidationState({
      packageValidation,
      packageInput: basePackage,
      workflowState: "draft",
    });
    const gate = gatePublishAction("submit", state, "draft");
    expect(gate.allowed).toBe(true);
  });

  it("blocks submit when workflow is not draft", () => {
    const packageValidation = toPackageValidationSnapshot({ valid: true, issues: [] }, basePackage);
    const state = computePublishValidationState({
      packageValidation,
      packageInput: basePackage,
      workflowState: "review",
    });
    const gate = gatePublishAction("submit", state, "review");
    expect(gate.allowed).toBe(false);
  });

  it("allows return to draft from approved even when publish validation is blocked", () => {
    const packageValidation = toPackageValidationSnapshot(
      { valid: false, issues: [{ message: "Missing indication", severity: "error", level: "biomedical" }] },
      basePackage,
    );
    const state = computePublishValidationState({
      packageValidation,
      packageInput: basePackage,
      workflowState: "approved",
    });
    const gate = gatePublishAction("returnToDraft", state, "approved");
    expect(gate.allowed).toBe(true);
  });
});

describe("computePublishValidationState", () => {
  it("marks publish ready when valid and attested", () => {
    const packageValidation = toPackageValidationSnapshot({ valid: true, issues: [] }, basePackage);
    const state = computePublishValidationState({
      packageValidation,
      packageInput: basePackage,
      workflowState: "approved",
    });
    expect(state.publishReady).toBe(true);
  });

  it("blocks publish when attestation is missing", () => {
    const unattestedPackage = {
      ...basePackage,
      entity_payload: {
        ...basePackage.entity_payload,
        provenance: { curator_attestation: false },
      },
    };
    const packageValidation = toPackageValidationSnapshot(
      { valid: true, issues: [] },
      unattestedPackage,
    );
    const state = computePublishValidationState({
      packageValidation,
      packageInput: unattestedPackage,
      workflowState: "approved",
    });
    expect(state.canPublish).toBe(false);
    expect(state.status).toBe("blocked");
  });

  it("blocks publish when graph validation jobs are pending", () => {
    const packageValidation = toPackageValidationSnapshot({ valid: true, issues: [] }, basePackage);
    const state = computePublishValidationState({
      packageValidation,
      packageInput: basePackage,
      workflowState: "approved",
      summary: { failed_count: 0, pending_count: 2, recent_failures: [] },
    });
    const gate = gatePublishAction("publish", state, "approved");
    expect(gate.allowed).toBe(false);
    expect(gate.reason).toContain("graph validation");
  });
});

describe("approve gating", () => {
  it("allows approve in review when validation passes", () => {
    const packageValidation = toPackageValidationSnapshot({ valid: true, issues: [] }, basePackage);
    const state = computePublishValidationState({
      packageValidation,
      packageInput: basePackage,
      workflowState: "review",
    });
    const gate = gatePublishAction("approve", state, "review");
    expect(gate.allowed).toBe(true);
  });

  it("blocks approve when workflow is still draft", () => {
    const packageValidation = toPackageValidationSnapshot({ valid: true, issues: [] }, basePackage);
    const state = computePublishValidationState({
      packageValidation,
      packageInput: basePackage,
      workflowState: "draft",
    });
    const gate = gatePublishAction("approve", state, "draft");
    expect(gate.allowed).toBe(false);
  });
});
