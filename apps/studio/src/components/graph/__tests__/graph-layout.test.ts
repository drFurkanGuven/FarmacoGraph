import { describe, expect, it } from "vitest";
import { buildLayeredLayout, buildSmartLayout, fragmentLevel, nodeTone } from "../graph-canvas";
import type { GraphNodeData } from "@/lib/api";

function node(partial: Partial<GraphNodeData> & { id: string }): GraphNodeData {
  return { ...partial };
}

const DRUG = node({ id: "d1", entity_type: "Drug", label: "Metoprolol" });
const MOL = node({
  id: "m1",
  entity_type: "MechanismFragment",
  label: "Blockade",
  properties: { fragment_type: "molecular" },
});
const CELL = node({
  id: "m2",
  entity_type: "MechanismFragment",
  label: "cAMP drop",
  properties: { fragment_type: "cellular" },
});
const CLIN = node({
  id: "m3",
  entity_type: "MechanismFragment",
  label: "Lower pressure",
  properties: { fragment_type: "clinical" },
});
const UNTYPED = node({ id: "m4", entity_type: "MechanismFragment", label: "Mystery" });

describe("fragmentLevel", () => {
  it("reads known levels and rejects unknown values", () => {
    expect(fragmentLevel(MOL)).toBe("molecular");
    expect(fragmentLevel(UNTYPED)).toBeNull();
    expect(fragmentLevel(DRUG)).toBeNull();
    expect(fragmentLevel(node({ id: "x", properties: { fragment_type: "subatomic" } }))).toBeNull();
  });
});

describe("nodeTone", () => {
  it("colors fragments by level, others by entity type", () => {
    expect(nodeTone(MOL)).toContain("indigo");
    expect(nodeTone(CELL)).toContain("cyan");
    expect(nodeTone(CLIN)).toContain("emerald");
    expect(nodeTone(UNTYPED)).toContain("sky");
    expect(nodeTone(DRUG)).toContain("emerald");
  });
});

describe("buildLayeredLayout", () => {
  it("orders columns molecular -> cellular -> clinical after the lead column", () => {
    const positioned = buildLayeredLayout([CLIN, DRUG, CELL, MOL]);
    const byId = new Map(positioned.map((entry) => [entry.id, entry]));
    expect(byId.get("d1")!.x).toBeLessThan(byId.get("m1")!.x);
    expect(byId.get("m1")!.x).toBeLessThan(byId.get("m2")!.x);
    expect(byId.get("m2")!.x).toBeLessThan(byId.get("m3")!.x);
  });

  it("puts unleveled fragments in a trailing column", () => {
    const positioned = buildLayeredLayout([MOL, UNTYPED]);
    const byId = new Map(positioned.map((entry) => [entry.id, entry]));
    expect(byId.get("m4")!.x).toBeGreaterThan(byId.get("m1")!.x);
  });
});

describe("buildSmartLayout", () => {
  it("uses layered layout when levels exist, radial otherwise", () => {
    const layered = buildSmartLayout([DRUG, MOL, CELL]);
    const byId = new Map(layered.map((entry) => [entry.id, entry]));
    expect(byId.get("m1")!.x).toBeLessThan(byId.get("m2")!.x);

    const radial = buildSmartLayout([DRUG, UNTYPED]);
    expect(radial).toHaveLength(2);
    // Radial centers the first node.
    expect(radial[0]).toMatchObject({ x: 360, y: 190 });
  });
});
