import { describe, expect, it } from "vitest";
import { createEmptyDrugPackage } from "../package";
import { listBelongsToClassIds, syncBelongsToSelection } from "../belongs-to-relationships";

const ANTIARRHYTHMICS_ID = "b1000001-0000-4000-8010-000000000006";
const ACE_ID = "b1000001-0000-4000-8010-000000000002";

describe("syncBelongsToSelection", () => {
  it("writes BELONGS_TO map, edge rows, and related DrugClass entities", () => {
    const drugId = "b5009004-4195-57fb-b17f-79cf08b30cdf";
    const pkg = createEmptyDrugPackage(drugId);
    pkg.entity_payload.slug = "adenosine";
    pkg.entity_payload.label = "Adenosine";

    const next = syncBelongsToSelection(pkg, drugId, [ANTIARRHYTHMICS_ID], [
      { id: ANTIARRHYTHMICS_ID, slug: "antiarrhythmics", label: "Antiarrhythmics" },
    ]);

    expect(listBelongsToClassIds(next)).toEqual([ANTIARRHYTHMICS_ID]);
    expect(next.relationships).toEqual(
      expect.arrayContaining([
        expect.objectContaining({
          relationship_type: "BELONGS_TO",
          source_id: drugId,
          target_id: ANTIARRHYTHMICS_ID,
          target_type: "DrugClass",
        }),
      ]),
    );
    expect(next.related_entities).toEqual(
      expect.arrayContaining([
        expect.objectContaining({
          id: ANTIARRHYTHMICS_ID,
          entity_type: "DrugClass",
          slug: "antiarrhythmics",
        }),
      ]),
    );
  });

  it("removes stale BELONGS_TO edges and related entities", () => {
    const drugId = "drug-1";
    const pkg = createEmptyDrugPackage(drugId);
    const withBoth = syncBelongsToSelection(pkg, drugId, [ANTIARRHYTHMICS_ID, ACE_ID], [
      { id: ANTIARRHYTHMICS_ID, slug: "antiarrhythmics", label: "Antiarrhythmics" },
      { id: ACE_ID, slug: "ace-inhibitors", label: "ACE inhibitors" },
    ]);

    const next = syncBelongsToSelection(withBoth, drugId, [ANTIARRHYTHMICS_ID], [
      { id: ANTIARRHYTHMICS_ID, slug: "antiarrhythmics", label: "Antiarrhythmics" },
      { id: ACE_ID, slug: "ace-inhibitors", label: "ACE inhibitors" },
    ]);

    expect(listBelongsToClassIds(next)).toEqual([ANTIARRHYTHMICS_ID]);
    expect(
      (next.relationships ?? []).filter((row) => row.relationship_type === "BELONGS_TO"),
    ).toHaveLength(1);
    expect(
      (next.related_entities ?? []).filter((row) => row.entity_type === "DrugClass"),
    ).toHaveLength(1);
  });
});
