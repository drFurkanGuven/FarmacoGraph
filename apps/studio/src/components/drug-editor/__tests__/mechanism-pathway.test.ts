import { describe, expect, it } from "vitest";
import { createEmptyDrugPackage } from "../package";
import {
  addPathwayEdge,
  listPathwayEdges,
  updatePathwayEdgeProperties,
} from "../mechanism-pathway";

function packageWithEdge() {
  let pkg = createEmptyDrugPackage("drug-1");
  pkg = addPathwayEdge(pkg, { sourceId: "frag-a", targetId: "frag-b" });
  return pkg;
}

describe("updatePathwayEdgeProperties", () => {
  it("patches explanation, confidence and evidence level on the matched edge", () => {
    const pkg = packageWithEdge();
    const next = updatePathwayEdgeProperties(pkg, "frag-a", "frag-b", {
      explanation: "Curator rationale",
      confidence_score: 0.9,
      evidence_level: "A",
    });
    const edge = listPathwayEdges(next).find(
      (row) => row.source_id === "frag-a" && row.target_id === "frag-b"
    );
    expect(edge?.properties.explanation).toBe("Curator rationale");
    expect(edge?.properties.confidence_score).toBe(0.9);
    expect(edge?.properties.evidence_level).toBe("A");
  });

  it("returns the original package when no edge matches", () => {
    const pkg = packageWithEdge();
    expect(updatePathwayEdgeProperties(pkg, "nope", "missing", {})).toBe(pkg);
  });
});
