import { describe, expect, it } from "vitest";
import {
  applyFieldChange,
  createEmptyDrugPackage,
  drugRecordToPackage,
  formatFieldValue,
  formatUuidList,
  parseFieldValue,
  parseUuidList,
  relationshipCounts,
  sectionFieldValues,
} from "../package";
import { DRUG_EDITOR_SECTIONS } from "../sections";
import { updateEducationItem } from "../education";

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
    const provenance = pkg.entity_payload.provenance as { curator_attestation?: boolean };
    expect(provenance.curator_attestation).toBe(false);
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

  it("parses curator attestation booleans from provenance text fields", () => {
    const base = createEmptyDrugPackage("drug-1");
    const section = DRUG_EDITOR_SECTIONS.find((entry) => entry.id === "provenance")!;
    const field = section.fields.find((entry) => entry.key === "curator_attestation")!;

    const unattested = applyFieldChange(base, field.path, "false", field.type);
    const provenance = unattested.entity_payload.provenance as { curator_attestation?: boolean };
    expect(provenance.curator_attestation).toBe(false);

    const attested = applyFieldChange(unattested, field.path, "true", field.type);
    const attestedProvenance = attested.entity_payload.provenance as {
      curator_attestation?: boolean;
    };
    expect(attestedProvenance.curator_attestation).toBe(true);
    expect(sectionFieldValues(attested, section).curator_attestation).toBe("true");
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

describe("education package helpers", () => {
  it("stores education nodes and HAS_EDUCATION edges outside biomedical fields", () => {
    const pkg = createEmptyDrugPackage("drug-1");

    const next = updateEducationItem(pkg, "drug-1", "FiveSecondSummary", {
      text: "Rapid recall summary.",
    });

    expect(next.education).toHaveLength(1);
    expect(next.education?.[0]).toMatchObject({
      entity_type: "EducationResource",
      kind: "FiveSecondSummary",
      content_layer: "education",
      text: "Rapid recall summary.",
      linked_entity_ids: ["drug-1"],
    });
    expect(next.related_entities).toContainEqual(
      expect.objectContaining({
        entity_type: "EducationResource",
        content_layer: "education",
      })
    );
    expect(next.relationships).toContainEqual(
      expect.objectContaining({
        relationship_type: "HAS_EDUCATION",
        source_type: "Drug",
        target_type: "EducationResource",
        source_id: "drug-1",
      })
    );
  });

  it("stores flashcards and common mistakes as education resources", () => {
    const pkg = createEmptyDrugPackage("drug-1");
    const withFlashcard = updateEducationItem(pkg, "drug-1", "Flashcard", {
      front: "Which suffix suggests an ACE inhibitor?",
      back: "-pril",
      hint: "Ramipril",
    });
    const withMistake = updateEducationItem(withFlashcard, "drug-1", "CommonMistake", {
      mistake: "Treating education mnemonics as clinical evidence.",
      correction: "Use them only as learning aids.",
    });

    expect(withMistake.education).toHaveLength(2);
    expect(withMistake.education).toContainEqual(
      expect.objectContaining({
        kind: "Flashcard",
        front: "Which suffix suggests an ACE inhibitor?",
        back: "-pril",
      })
    );
    expect(withMistake.education).toContainEqual(
      expect.objectContaining({
        kind: "CommonMistake",
        mistake: "Treating education mnemonics as clinical evidence.",
      })
    );
    expect(
      withMistake.relationships?.filter((row) => row.relationship_type === "HAS_EDUCATION")
    ).toHaveLength(2);
  });
});

describe("boolean fields (curator attestation, safety flags)", () => {
  it("formats booleans as checkbox strings", () => {
    expect(formatFieldValue(true, "boolean")).toBe("true");
    expect(formatFieldValue(false, "boolean")).toBe("false");
    expect(formatFieldValue(undefined, "boolean")).toBe("");
  });

  it("parses checkbox strings back to booleans", () => {
    expect(parseFieldValue("true", "boolean")).toBe(true);
    expect(parseFieldValue("false", "boolean")).toBe(false);
  });

  it("stores attestation as a real boolean in the package", () => {
    const pkg = createEmptyDrugPackage("drug-1");
    const next = applyFieldChange(
      pkg,
      "entity_payload.provenance.curator_attestation",
      "true",
      "boolean"
    );
    const provenance = next.entity_payload.provenance as Record<string, unknown>;
    expect(provenance.curator_attestation).toBe(true);
  });

  it("preserves pharmacokinetics and safety scalars on load", () => {
    const pkg = drugRecordToPackage("drug-1", {
      id: "drug-1",
      slug: "metoprolol",
      label: "Metoprolol",
      half_life: "3–7 hours",
      bioavailability: "~50%",
      protein_binding: "~12%",
      onset: "1–2 hours",
      duration: "24 hours",
      has_black_box_warning: true,
      black_box_text: "Do not stop abruptly.",
      is_high_alert: false,
    });
    const payload = pkg.entity_payload as Record<string, unknown>;
    expect(payload.half_life).toBe("3–7 hours");
    expect(payload.bioavailability).toBe("~50%");
    expect(payload.has_black_box_warning).toBe(true);
    expect(payload.black_box_text).toBe("Do not stop abruptly.");
    expect(payload.is_high_alert).toBe(false);
  });
});
