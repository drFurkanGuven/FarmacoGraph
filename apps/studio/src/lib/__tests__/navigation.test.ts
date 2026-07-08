import { describe, expect, it } from "vitest";
import { commandItems, navigation } from "../navigation";

describe("navigation", () => {
  it("includes dashboard as the first item", () => {
    expect(navigation[0]?.items[0]?.href).toBe("/");
    expect(navigation[0]?.items[0]?.title).toBe("Dashboard");
  });

  it("exposes drugs and validation routes", () => {
    const hrefs = commandItems.map((item) => item.href);
    expect(hrefs).toContain("/knowledge/drugs");
    expect(hrefs).toContain("/validation");
  });

  it("marks future modules with phase badges", () => {
    const drugs = commandItems.find((item) => item.href === "/knowledge/drugs");
    const validation = commandItems.find((item) => item.href === "/validation");
    expect(drugs?.badge).toBe("4.2");
    expect(validation?.badge).toBe("4.3");
  });
});
