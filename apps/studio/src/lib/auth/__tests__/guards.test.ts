import { readFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";
import { describe, expect, it } from "vitest";

const guardsPath = join(dirname(fileURLToPath(import.meta.url)), "../guards.tsx");

describe("guards prerender safety", () => {
  it("wraps useSearchParams in Suspense so static pages can prerender", () => {
    const source = readFileSync(guardsPath, "utf8");
    expect(source).toContain("useSearchParams");
    expect(source).toContain("ProtectedRouteContent");
    expect(source).toMatch(/<Suspense fallback=\{<ProtectedRouteSkeleton \/>}/);
  });
});
