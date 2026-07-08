import { describe, expect, it } from "vitest";
import {
  buildRelationshipsFromDrug,
  categorizeIssues,
  computePublishReadiness,
  isMissingEvidenceIssue,
  parseValidationIssue,
  parseValidationIssues,
} from "../validation-utils";
import type { QueueValidationItem, ValidationIssue, ValidationSummaryData } from "../validation-types";

const baseIssue = (overrides: Partial<ValidationIssue> = {}): ValidationIssue => ({
  constraint_id: null,
  level: "biomedical",
  severity: "error",
  message: "Test issue",
  ...overrides,
});

describe("parseValidationIssue", () => {
  it("parses valid API issues", () => {
    const issue = parseValidationIssue({
      constraint_id: "FG-C008",
      level: "biomedical",
      severity: "error",
      message: "Published drug must belong to at least one DrugClass",
      entity_id: "drug-1",
    });

    expect(issue).toEqual({
      constraint_id: "FG-C008",
      level: "biomedical",
      severity: "error",
      message: "Published drug must belong to at least one DrugClass",
      field: null,
      entity_id: "drug-1",
      relationship_type: null,
    });
  });

  it("rejects malformed issues", () => {
    expect(parseValidationIssue({ level: "invalid", message: "x" })).toBeNull();
    expect(parseValidationIssue({ level: "schema", severity: "error" })).toBeNull();
  });
});

describe("parseValidationIssues", () => {
  it("filters invalid entries", () => {
    const issues = parseValidationIssues([
      { level: "ontology", severity: "error", message: "Forbidden edge" },
      { level: "bad", message: "skip me" },
    ]);

    expect(issues).toHaveLength(1);
    expect(issues[0]?.level).toBe("ontology");
  });
});

describe("isMissingEvidenceIssue", () => {
  it("detects provenance constraint ids", () => {
    expect(isMissingEvidenceIssue(baseIssue({ constraint_id: "FG-C018" }))).toBe(true);
    expect(isMissingEvidenceIssue(baseIssue({ constraint_id: "FG-C008" }))).toBe(false);
  });

  it("detects evidence keywords in messages", () => {
    expect(isMissingEvidenceIssue(baseIssue({ message: "Provenance metadata is required" }))).toBe(true);
    expect(isMissingEvidenceIssue(baseIssue({ message: "Missing drug class" }))).toBe(false);
  });
});

describe("categorizeIssues", () => {
  it("groups issues into validation center sections", () => {
    const issues: ValidationIssue[] = [
      baseIssue({ severity: "error", level: "biomedical" }),
      baseIssue({ severity: "warning", level: "schema", message: "Optional field missing" }),
      baseIssue({
        severity: "error",
        level: "ontology",
        message: "Forbidden: Drug -[TARGETS]-> Disease",
        relationship_type: "TARGETS",
      }),
      baseIssue({
        severity: "error",
        level: "biomedical",
        constraint_id: "FG-C018",
        message: "Provenance metadata is required",
      }),
    ];

    const grouped = categorizeIssues(issues);

    expect(grouped.errors).toHaveLength(3);
    expect(grouped.warnings).toHaveLength(1);
    expect(grouped.ontologyViolations).toHaveLength(1);
    expect(grouped.missingEvidence).toHaveLength(1);
  });
});

describe("buildRelationshipsFromDrug", () => {
  it("expands nested relationship maps for ontology validation", () => {
    const edges = buildRelationshipsFromDrug({
      id: "drug-1",
      entity_type: "Drug",
      relationships: {
        BELONGS_TO: ["class-1"],
        TREATS: ["disease-1"],
      },
    });

    expect(edges).toEqual([
      {
        relationship_type: "BELONGS_TO",
        source_type: "Drug",
        target_type: "DrugClass",
        source_id: "drug-1",
        target_id: "class-1",
      },
      {
        relationship_type: "TREATS",
        source_type: "Drug",
        target_type: "Disease",
        source_id: "drug-1",
        target_id: "disease-1",
      },
    ]);
  });

  it("returns empty list when relationships are absent", () => {
    expect(buildRelationshipsFromDrug({ id: "drug-1" })).toEqual([]);
  });
});

describe("computePublishReadiness", () => {
  const summary: ValidationSummaryData = {
    failed_count: 0,
    pending_count: 0,
    recent_failures: [],
  };

  const validQueueItem = (state: string): QueueValidationItem => ({
    workflowId: "wf-1",
    entityId: "drug-1",
    entityLabel: "Test Drug",
    workflowState: state,
    valid: true,
    issues: [],
  });

  it("marks ready when queue packages validate cleanly", () => {
    const readiness = computePublishReadiness(
      summary,
      [validQueueItem("draft"), validQueueItem("review")],
      categorizeIssues([]),
    );

    expect(readiness.status).toBe("ready");
    expect(readiness.draftCount).toBe(1);
    expect(readiness.reviewCount).toBe(1);
  });

  it("marks blocked when publish errors or graph failures exist", () => {
    const readiness = computePublishReadiness(
      { ...summary, failed_count: 2 },
      [],
      categorizeIssues([baseIssue()]),
    );

    expect(readiness.status).toBe("blocked");
    expect(readiness.blockingErrors).toBeGreaterThan(0);
    expect(readiness.message).toContain("Blocked");
  });

  it("marks pending when graph validation jobs are running", () => {
    const readiness = computePublishReadiness(
      { ...summary, pending_count: 3 },
      [],
      categorizeIssues([]),
    );

    expect(readiness.status).toBe("pending");
    expect(readiness.graphPending).toBe(3);
  });
});
