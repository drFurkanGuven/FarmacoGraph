import { describe, expect, it } from "vitest";
import {
  applyFieldChange,
  createEmptyDrugPackage,
  drugRecordToPackage,
  formatUuidList,
  parseUuidList,
  relationshipCounts,
  sectionFieldValues,
} from "../package";
import { DRUG_EDITOR_SECTIONS } from "../sections";

describe("drugRecordToPackage", () => {
  it("maps published drug records into an editor package", () => {
    const pkg = drugRecordToPackage("drug-1", {
      id: "drug-1",
      slug: "ramipril",
      label: "Ramipril",
      generic_name: "Ramipril",
      module: "cardiovascular",
      relationships: {
        BELONGS_TO: ["class-1"],
        TREATS: ["disease-1"],
        HAS_MECHANISM_ROOT: [],
      },
    });

    expect(pkg.entity_payload.slug).toBe("ramipril");
    const relationships = pkg.entity_payload.relationships as {
      BELONGS_TO?: string[];
    };
    expect(relationships.BELONGS_TO).toEqual(["class-1"]);
    expect(pkg.module).toBe("cardiovascular");
  });

  it("creates an empty draft package when no record exists", () => {
    const pkg = createEmptyDrugPackage("new-drug");
    expect(pkg.entity_payload.id).toBe("new-drug");
    expect(pkg.entity_payload.status).toBe("draft");
  });
});

describe("applyFieldChange", () => {
  it("updates nested relationship lists from textarea input", () => {
    const base = createEmptyDrugPackage("drug-1");
    const section = DRUG_EDITOR_SECTIONS.find((entry) => entry.id === "classification")!;
    const field = section.fields[0]!;

    const next = applyFieldChange(base, field.path, "class-1\nclass-2", field.type);

    const relationships = next.entity_payload.relationships as {
      BELONGS_TO?: string[];
    };
    expect(relationships.BELONGS_TO).toEqual(["class-1", "class-2"]);
  });

  it("exposes section values for the property editor", () => {
    const pkg = drugRecordToPackage("drug-1", {
      id: "drug-1",
      slug: "ramipril",
      label: "Ramipril",
      generic_name: "Ramipril",
      module: "cardiovascular",
    });
    const section = DRUG_EDITOR_SECTIONS.find((entry) => entry.id === "identity")!;
    const values = sectionFieldValues(pkg, section);

    expect(values.slug).toBe("ramipril");
    expect(values.id).toBe("drug-1");
  });
});

describe("uuid list helpers", () => {
  it("parses and formats uuid lists", () => {
    expect(parseUuidList("a\nb, c")).toEqual(["a", "b", "c"]);
    expect(formatUuidList(["a", "b"])).toBe("a\nb");
  });
});

describe("relationshipCounts", () => {
  it("summarizes relationship cardinalities for the context panel", () => {
    const pkg = drugRecordToPackage("drug-1", {
      id: "drug-1",
      slug: "ramipril",
      relationships: {
        BELONGS_TO: ["c1"],
        TREATS: ["d1", "d2"],
        HAS_MECHANISM_ROOT: [],
      },
    });

    expect(relationshipCounts(pkg)).toEqual({
      classes: 1,
      indications: 2,
      mechanisms: 0,
    });
  });
});
