import { describe, expect, it } from "vitest";
import {
  evidenceTypeLabel,
  formatQualityScore,
  isEvidenceAlreadyAttached,
  missingRequirementsFromValidation,
  parseDrugEvidenceAttachments,
  parseEvidenceItem,
  qualityLevelFromScore,
  summarizeDrugEvidence,
} from "../evidence-helpers";

describe("parseEvidenceItem", () => {
  it("parses valid evidence records", () => {
    const item = parseEvidenceItem({
      id: "evidence-1",
      title: "Source title",
      evidence_type: "pubmed_article",
      quality_score: 0.82,
      year: 2024,
    });

    expect(item).toEqual({
      id: "evidence-1",
      title: "Source title",
      evidence_type: "pubmed_article",
      quality_score: 0.82,
      year: 2024,
      status: null,
      extract: null,
    });
  });

  it("rejects incomplete evidence records", () => {
    expect(parseEvidenceItem({ id: "evidence-1" })).toBeNull();
  });
});

describe("parseDrugEvidenceAttachments", () => {
  it("parses nested and flat attachment payloads", () => {
    const attachments = parseDrugEvidenceAttachments([
      {
        evidence_id: "evidence-1",
        evidence: {
          id: "evidence-1",
          title: "Nested",
          evidence_type: "fda_label",
          quality_score: 0.95,
        },
      },
      {
        id: "evidence-2",
        title: "Flat",
        evidence_type: "review_article",
        quality_score: 0.6,
      },
    ]);

    expect(attachments).toHaveLength(2);
    expect(attachments[0]?.evidence.title).toBe("Nested");
    expect(attachments[1]?.evidence_id).toBe("evidence-2");
  });
});

describe("quality helpers", () => {
  it("maps quality scores to levels", () => {
    expect(qualityLevelFromScore(0.9)).toBe("high");
    expect(qualityLevelFromScore(0.65)).toBe("medium");
    expect(qualityLevelFromScore(0.3)).toBe("low");
    expect(qualityLevelFromScore(null)).toBe("none");
  });

  it("formats quality scores for display", () => {
    expect(formatQualityScore(0.825)).toBe("83%");
    expect(formatQualityScore(null)).toBe("—");
  });
});

describe("summarizeDrugEvidence", () => {
  it("summarizes attached evidence and missing requirements", () => {
    const summary = summarizeDrugEvidence(
      parseDrugEvidenceAttachments([
        {
          evidence_id: "evidence-1",
          evidence: {
            id: "evidence-1",
            title: "High quality",
            evidence_type: "fda_label",
            quality_score: 0.9,
          },
        },
        {
          evidence_id: "evidence-2",
          evidence: {
            id: "evidence-2",
            title: "Low quality",
            evidence_type: "review_article",
            quality_score: 0.4,
          },
        },
      ]),
      [{ id: "missing-1", message: "Missing evidence on TREATS edge" }],
    );

    expect(summary).toEqual({
      attachedCount: 2,
      missingCount: 1,
      averageQuality: 0.65,
      qualityLevel: "medium",
      lowQualityCount: 1,
    });
  });

  it("returns none quality when no attachments exist", () => {
    expect(
      summarizeDrugEvidence([], [{ id: "missing-1", message: "No evidence attached" }]),
    ).toEqual({
      attachedCount: 0,
      missingCount: 1,
      averageQuality: null,
      qualityLevel: "none",
      lowQualityCount: 0,
    });
  });
});

describe("missingRequirementsFromValidation", () => {
  it("extracts missing evidence issues from validation results", () => {
    const missing = missingRequirementsFromValidation({
      valid: false,
      issues: [
        {
          level: "ontology",
          severity: "error",
          message: "Published edge requires evidence",
          constraint_id: "FG-C018",
          field: "relationships.TREATS",
        },
        {
          level: "schema",
          severity: "error",
          message: "Slug is required",
          field: "entity_payload.slug",
        },
      ],
    });

    expect(missing).toHaveLength(1);
    expect(missing[0]?.constraint_id).toBe("FG-C018");
  });
});

describe("evidence utility helpers", () => {
  it("labels evidence types and detects duplicates", () => {
    expect(evidenceTypeLabel("fda_label")).toBe("FDA label");
    expect(
      isEvidenceAlreadyAttached(
        parseDrugEvidenceAttachments([
          {
            evidence_id: "evidence-1",
            evidence: {
              id: "evidence-1",
              title: "Attached",
              evidence_type: "fda_label",
              quality_score: 0.9,
            },
          },
        ]),
        "evidence-1",
      ),
    ).toBe(true);
  });
});
