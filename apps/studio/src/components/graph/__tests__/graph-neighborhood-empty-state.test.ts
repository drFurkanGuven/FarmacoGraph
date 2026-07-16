import { describe, expect, it } from "vitest";
import { ApiError } from "@/lib/api";
import { resolveGraphEmptyReason } from "../graph-neighborhood-empty-state";

describe("resolveGraphEmptyReason", () => {
  it("flags invalid UUID API errors", () => {
    expect(
      resolveGraphEmptyReason({
        identityResolved: true,
        workflowStatus: "draft",
        graph: undefined,
        graphError: new ApiError("bad", 422),
        nodeCount: 0,
        edgeCount: 0,
      }),
    ).toBe("invalid_identity");
  });

  it("flags Neo4j unavailable from projection meta", () => {
    expect(
      resolveGraphEmptyReason({
        identityResolved: true,
        workflowStatus: "draft",
        graph: { nodes: [], edges: [], neo4j_available: false, drug_in_graph: false },
        graphError: null,
        nodeCount: 0,
        edgeCount: 0,
      }),
    ).toBe("neo4j_unavailable");
  });

  it("uses workflow status for draft vs approved", () => {
    expect(
      resolveGraphEmptyReason({
        identityResolved: true,
        workflowStatus: "draft",
        graph: { nodes: [], edges: [], neo4j_available: true, drug_in_graph: false },
        graphError: null,
        nodeCount: 0,
        edgeCount: 0,
      }),
    ).toBe("draft");

    expect(
      resolveGraphEmptyReason({
        identityResolved: true,
        workflowStatus: "approved",
        graph: { nodes: [], edges: [], neo4j_available: true, drug_in_graph: false },
        graphError: null,
        nodeCount: 0,
        edgeCount: 0,
      }),
    ).toBe("approved");
  });

  it("detects published node without relationships", () => {
    expect(
      resolveGraphEmptyReason({
        identityResolved: true,
        workflowStatus: "published",
        graph: {
          nodes: [{ id: "1", label: "Adenosine" }],
          edges: [],
          neo4j_available: true,
          drug_in_graph: true,
        },
        graphError: null,
        nodeCount: 1,
        edgeCount: 0,
      }),
    ).toBe("no_relationships");
  });

  it("returns null when neighborhood has edges", () => {
    expect(
      resolveGraphEmptyReason({
        identityResolved: true,
        workflowStatus: "published",
        graph: {
          nodes: [{ id: "1", label: "Adenosine" }],
          edges: [{ id: "e1", relationship_type: "BELONGS_TO", source_id: "1", target_id: "2" }],
          neo4j_available: true,
          drug_in_graph: true,
        },
        graphError: null,
        nodeCount: 1,
        edgeCount: 1,
      }),
    ).toBeNull();
  });
});
