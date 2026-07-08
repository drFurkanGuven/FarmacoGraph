import { describe, expect, it } from "vitest";
import { apiQueryKeys } from "../keys";

describe("apiQueryKeys", () => {
  it("builds stable root keys", () => {
    expect(apiQueryKeys.all).toEqual(["farmacograph"]);
    expect(apiQueryKeys.health()).toEqual(["farmacograph", "health"]);
  });

  it("scopes drug list keys by module and pagination", () => {
    expect(apiQueryKeys.drugs()).toEqual(["farmacograph", "drugs", "all", {}]);
    expect(apiQueryKeys.drugs("cardiovascular", { limit: 50 })).toEqual([
      "farmacograph",
      "drugs",
      "cardiovascular",
      { limit: 50 },
    ]);
  });

  it("scopes curator queue by state", () => {
    expect(apiQueryKeys.curatorQueue("review")).toEqual([
      "farmacograph",
      "curator-queue",
      "review",
    ]);
  });
});
