import { describe, expect, it } from "vitest";
import { defaultTreatsIndicationProperties } from "../treats-relationships";
import { evaluateTreatsIndicationReadiness } from "../treats-indication-status";

describe("evaluateTreatsIndicationReadiness", () => {
  it("marks expert consensus + attestation as ready when explanation is present", () => {
    const result = evaluateTreatsIndicationReadiness(
      {
        ...defaultTreatsIndicationProperties(),
        explanation: "Clinically indicated for hypertension.",
      },
      true,
    );
    expect(result.status).toBe("ready");
    expect(result.missing).toEqual([]);
  });

  it("requires attestation or evidence for expert consensus", () => {
    const result = evaluateTreatsIndicationReadiness(
      {
        ...defaultTreatsIndicationProperties(),
        explanation: "Clinically indicated for hypertension.",
      },
      false,
    );
    expect(result.missing).toContain("curator_attestation");
  });

  it("accepts linked evidence instead of attestation", () => {
    const result = evaluateTreatsIndicationReadiness(
      {
        ...defaultTreatsIndicationProperties(),
        explanation: "Supported by trial evidence.",
        evidence_ids: ["e1000001-0000-4000-8010-000000000001"],
      },
      false,
    );
    expect(result.status).toBe("ready");
  });

  it("requires evidence for non-expert levels", () => {
    const result = evaluateTreatsIndicationReadiness(
      {
        ...defaultTreatsIndicationProperties(),
        explanation: "Level A indication.",
        evidence_level: "A",
      },
      true,
    );
    expect(result.missing).toContain("evidence");
  });
});
