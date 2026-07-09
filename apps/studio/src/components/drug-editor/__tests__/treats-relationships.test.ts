import { describe, expect, it } from "vitest";
import { createEmptyDrugPackage } from "../package";
import {
  ensureTreatsRelationshipEdges,
  listTreatsDiseaseIds,
  readTreatsIndication,
  setTreatsEvidenceIds,
  syncTreatsSelection,
  updateTreatsIndication,
} from "../treats-relationships";

const DRUG_ID = "b5009004-4195-57fb-b17f-79cf08b30cdf";
const HYPERTENSION_ID = "d1000001-0000-4000-8010-000000000001";
const EVIDENCE_ID = "e1000001-0000-4000-8010-000000000001";

describe("treats relationships", () => {
  it("syncTreatsSelection writes TREATS ids and relationship rows", () => {
    const base = createEmptyDrugPackage(DRUG_ID);
    const next = syncTreatsSelection(base, DRUG_ID, [HYPERTENSION_ID]);

    expect(listTreatsDiseaseIds(next)).toEqual([HYPERTENSION_ID]);
    expect(next.relationships).toHaveLength(1);
    expect(next.relationships?.[0]).toMatchObject({
      relationship_type: "TREATS",
      source_id: DRUG_ID,
      target_id: HYPERTENSION_ID,
      source_type: "Drug",
      target_type: "Disease",
    });
  });

  it("updateTreatsIndication patches edge properties", () => {
    const base = syncTreatsSelection(createEmptyDrugPackage(DRUG_ID), DRUG_ID, [HYPERTENSION_ID]);
    const next = updateTreatsIndication(base, DRUG_ID, HYPERTENSION_ID, {
      explanation: "ACE inhibition lowers blood pressure.",
      confidence_score: 0.9,
      evidence_level: "expert_consensus",
    });

    const props = readTreatsIndication(next, DRUG_ID, HYPERTENSION_ID);
    expect(props.explanation).toBe("ACE inhibition lowers blood pressure.");
    expect(props.confidence_score).toBe(0.9);
    expect(props.evidence_level).toBe("expert_consensus");
  });

  it("setTreatsEvidenceIds writes evidence_ids and SUPPORTED_BY rows", () => {
    const base = syncTreatsSelection(createEmptyDrugPackage(DRUG_ID), DRUG_ID, [HYPERTENSION_ID]);
    const next = setTreatsEvidenceIds(base, DRUG_ID, HYPERTENSION_ID, [EVIDENCE_ID]);

    const props = readTreatsIndication(next, DRUG_ID, HYPERTENSION_ID);
    expect(props.evidence_ids).toEqual([EVIDENCE_ID]);

    const supportedBy = (next.relationships ?? []).filter(
      (row) => (row as { relationship_type?: string }).relationship_type === "SUPPORTED_BY",
    );
    expect(supportedBy).toHaveLength(1);
    expect(supportedBy[0]).toMatchObject({
      relationship_type: "SUPPORTED_BY",
      source_id: DRUG_ID,
      target_id: EVIDENCE_ID,
      source_type: "Drug",
      target_type: "Evidence",
      properties: {
        assertion_relationship: "TREATS",
        assertion_target_id: HYPERTENSION_ID,
        assertion_target_type: "Disease",
      },
    });
  });

  it("removes SUPPORTED_BY rows when disease is deselected", () => {
    const withEvidence = setTreatsEvidenceIds(
      syncTreatsSelection(createEmptyDrugPackage(DRUG_ID), DRUG_ID, [HYPERTENSION_ID]),
      DRUG_ID,
      HYPERTENSION_ID,
      [EVIDENCE_ID],
    );
    const next = syncTreatsSelection(withEvidence, DRUG_ID, []);

    expect(listTreatsDiseaseIds(next)).toEqual([]);
    expect(
      (next.relationships ?? []).filter(
        (row) => (row as { relationship_type?: string }).relationship_type === "SUPPORTED_BY",
      ),
    ).toHaveLength(0);
  });

  it("ensureTreatsRelationshipEdges backfills rows for legacy packages", () => {
    const legacy = createEmptyDrugPackage(DRUG_ID);
    legacy.entity_payload.relationships = {
      BELONGS_TO: [],
      TREATS: [HYPERTENSION_ID],
      HAS_MECHANISM_ROOT: [],
    };
    legacy.relationships = [];

    const next = ensureTreatsRelationshipEdges(legacy);
    expect(next.relationships).toHaveLength(1);
    expect(readTreatsIndication(next, DRUG_ID, HYPERTENSION_ID).evidence_level).toBe("expert_consensus");
  });

  it("removes relationship rows when disease is deselected", () => {
    const withTwo = syncTreatsSelection(createEmptyDrugPackage(DRUG_ID), DRUG_ID, [
      HYPERTENSION_ID,
      "d1000001-0000-4000-8010-000000000002",
    ]);
    const next = syncTreatsSelection(withTwo, DRUG_ID, [HYPERTENSION_ID]);
    expect(listTreatsDiseaseIds(next)).toEqual([HYPERTENSION_ID]);
    expect(next.relationships).toHaveLength(1);
  });
});
