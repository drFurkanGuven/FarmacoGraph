import { describe, expect, it } from "vitest";
import { readFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";

const shellPath = join(dirname(fileURLToPath(import.meta.url)), "../entity-editor-shell.tsx");

describe("entity editor abstraction", () => {
  it("exports a reusable shell layout for entity editors", () => {
    const source = readFileSync(shellPath, "utf8");
    expect(source).toContain("EntityEditorShell");
    expect(source).toContain("sectionNav");
    expect(source).toContain("contextPanel");
  });
});
