import { describe, expect, it } from "vitest";
import { getConstraintHint, getDictionary, translate } from "../dictionaries";

describe("studio dictionaries", () => {
  it("keeps tr/en key parity", () => {
    const trKeys = Object.keys(getDictionary("tr")).sort();
    const enKeys = Object.keys(getDictionary("en")).sort();
    expect(trKeys).toEqual(enKeys);
  });

  it("falls back to English, then the key itself", () => {
    expect(translate("wizard.title", "tr")).toBe("Yayın sihirbazı");
    expect(translate("wizard.title", "en")).toBe("Publish wizard");
    expect(translate("missing.key", "tr", "Fallback")).toBe("Fallback");
    expect(translate("missing.key", "tr")).toBe("missing.key");
  });

  it("explains the critical publish constraints in both languages", () => {
    for (const code of ["FG-C012", "FG-C019", "FG-C020"]) {
      expect(getConstraintHint(code, "tr")).toBeTruthy();
      expect(getConstraintHint(code, "en")).toBeTruthy();
    }
    expect(getConstraintHint("FG-C999", "tr")).toBeNull();
    expect(getConstraintHint(null, "tr")).toBeNull();
  });

  it("never translates graph data (spot check)", () => {
    const values = Object.values(getDictionary("tr")).join("\n");
    for (const token of ["ramipril", "hypertension", "C07AB02", "6918"]) {
      expect(values).not.toContain(token);
    }
  });
});
