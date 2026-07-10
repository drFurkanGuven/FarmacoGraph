import { describe, expect, it } from "vitest";
import { createEmptyDiseasePackage } from "../package";
import { DISEASE_EDITOR_SECTIONS, getSectionById } from "../sections";

describe("disease editor sections", () => {
  it("includes provenance fields required for publish attestation", () => {
    const provenance = getSectionById("provenance");
    expect(provenance.title).toBe("Provenance");
    expect(provenance.fields.map((field) => field.key)).toEqual([
      "source",
      "created_by",
      "curator_attestation",
    ]);
    expect(DISEASE_EDITOR_SECTIONS.map((section) => section.id)).toContain("provenance");
  });

  it("scaffolds empty packages with provenance defaults", () => {
    const pkg = createEmptyDiseasePackage("hypertension");
    expect(pkg.entity_payload.entity_type).toBe("Disease");
    expect(pkg.entity_payload.provenance).toMatchObject({
      source: "manual",
      created_by: "",
      curator_attestation: false,
    });
  });
});
