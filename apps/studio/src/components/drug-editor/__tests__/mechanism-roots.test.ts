import { describe, expect, it } from "vitest";
import { createEmptyDrugPackage } from "../package";
import { listMechanismRootIds, syncMechanismRootSelection } from "../mechanism-roots";

describe("mechanism root selection", () => {
  it("reads string UUID roots from the package", () => {
    const pkg = createEmptyDrugPackage("ramipril");
    const withRoots = syncMechanismRootSelection(pkg, [
      "m1000001-0000-4000-8010-000000000002",
      "m1000001-0000-4000-8010-000000000001",
    ]);
    expect(listMechanismRootIds(withRoots)).toEqual([
      "m1000001-0000-4000-8010-000000000002",
      "m1000001-0000-4000-8010-000000000001",
    ]);
  });

  it("deduplicates and clears roots", () => {
    const pkg = createEmptyDrugPackage("ramipril");
    const withDupes = syncMechanismRootSelection(pkg, [
      "m1000001-0000-4000-8010-000000000002",
      "m1000001-0000-4000-8010-000000000002",
    ]);
    expect(listMechanismRootIds(withDupes)).toHaveLength(1);
    expect(listMechanismRootIds(syncMechanismRootSelection(withDupes, []))).toEqual([]);
  });
});
