import { describe, expect, it } from "vitest";
import { createEmptyDrugPackage } from "../package";
import {
  addPathwayEdge,
  addPathwayNode,
  isPathwayAcyclic,
  listMechanismRootIds,
  listPathwayEdges,
  listPathwayNodeIds,
  setMechanismRoot,
  syncMechanismRootSelection,
  wouldCreateCycle,
} from "../mechanism-pathway";

const DRUG_ID = "00000000-0000-4000-8000-000000000101";
const ACE = "m1000001-0000-4000-8010-000000000002";
const BETA = "m1000001-0000-4000-8010-000000000001";
const BRADY = "m1000001-0000-4000-8010-000000000003";

describe("mechanism root selection", () => {
  it("writes flat HAS_MECHANISM_ROOT edges and related entities", () => {
    const pkg = createEmptyDrugPackage(DRUG_ID);
    const withRoots = syncMechanismRootSelection(pkg, DRUG_ID, [ACE, BETA], [
      { id: ACE, slug: "ace-inhibition", label: "ACE inhibition" },
      { id: BETA, slug: "beta-adrenergic-blockade", label: "Beta-adrenergic blockade" },
    ]);

    expect(listMechanismRootIds(withRoots)).toEqual([ACE, BETA]);
    expect(withRoots.relationships).toEqual(
      expect.arrayContaining([
        expect.objectContaining({
          relationship_type: "HAS_MECHANISM_ROOT",
          source_id: DRUG_ID,
          target_id: ACE,
        }),
        expect.objectContaining({
          relationship_type: "HAS_MECHANISM_ROOT",
          source_id: DRUG_ID,
          target_id: BETA,
        }),
      ]),
    );
    expect(withRoots.related_entities).toEqual(
      expect.arrayContaining([
        expect.objectContaining({ id: ACE, entity_type: "MechanismFragment" }),
        expect.objectContaining({ id: BETA, entity_type: "MechanismFragment" }),
      ]),
    );
  });

  it("deduplicates and clears roots", () => {
    const pkg = createEmptyDrugPackage(DRUG_ID);
    const withDupes = syncMechanismRootSelection(pkg, DRUG_ID, [ACE, ACE]);
    expect(listMechanismRootIds(withDupes)).toHaveLength(1);
    expect(listMechanismRootIds(syncMechanismRootSelection(withDupes, DRUG_ID, []))).toEqual([]);
  });

  it("toggles a single root via setMechanismRoot", () => {
    const pkg = addPathwayNode(createEmptyDrugPackage(DRUG_ID), {
      id: ACE,
      slug: "ace-inhibition",
      label: "ACE inhibition",
    });
    const rooted = setMechanismRoot(pkg, DRUG_ID, ACE, true, {
      id: ACE,
      slug: "ace-inhibition",
      label: "ACE inhibition",
    });
    expect(listMechanismRootIds(rooted)).toEqual([ACE]);
    expect(listPathwayNodeIds(rooted)).toContain(ACE);

    const cleared = setMechanismRoot(rooted, DRUG_ID, ACE, false);
    expect(listMechanismRootIds(cleared)).toEqual([]);
    expect(listPathwayNodeIds(cleared)).toContain(ACE);
  });
});

describe("mechanism pathway edges", () => {
  it("adds PRECEDES edges between fragments", () => {
    const pkg = syncMechanismRootSelection(createEmptyDrugPackage(DRUG_ID), DRUG_ID, [ACE], [
      { id: ACE, slug: "ace-inhibition", label: "ACE inhibition" },
    ]);
    const next = addPathwayEdge(pkg, {
      sourceId: ACE,
      targetId: BRADY,
      fragments: [{ id: BRADY, slug: "bradykinin-accumulation", label: "Bradykinin accumulation" }],
    });

    expect(listPathwayEdges(next)).toEqual([
      expect.objectContaining({
        relationship_type: "PRECEDES",
        source_id: ACE,
        target_id: BRADY,
      }),
    ]);
    expect(listPathwayNodeIds(next)).toEqual(expect.arrayContaining([ACE, BRADY]));
    expect(isPathwayAcyclic(next)).toBe(true);
  });

  it("rejects cyclic pathway edges", () => {
    let pkg = syncMechanismRootSelection(createEmptyDrugPackage(DRUG_ID), DRUG_ID, [ACE]);
    pkg = addPathwayEdge(pkg, { sourceId: ACE, targetId: BRADY });
    pkg = addPathwayEdge(pkg, { sourceId: BRADY, targetId: BETA });
    expect(wouldCreateCycle(pkg, BETA, ACE)).toBe(true);
    expect(() => addPathwayEdge(pkg, { sourceId: BETA, targetId: ACE })).toThrow(/acyclic/i);
  });

  it("adds a mid-path node without making it a root", () => {
    const pkg = addPathwayNode(createEmptyDrugPackage(DRUG_ID), {
      id: BRADY,
      slug: "bradykinin-accumulation",
      label: "Bradykinin accumulation",
    });
    expect(listMechanismRootIds(pkg)).toEqual([]);
    expect(listPathwayNodeIds(pkg)).toEqual([BRADY]);
  });
});
