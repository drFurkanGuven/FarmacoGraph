/**
 * @vitest-environment jsdom
 */
import { describe, expect, it } from "vitest";
import { act, renderHook } from "@testing-library/react";
import { useDrugBrowserState } from "../hooks/use-drug-browser-state";

describe("useDrugBrowserState", () => {
  it("resets page when filters change", () => {
    const { result } = renderHook(() => useDrugBrowserState("cardiovascular"));

    act(() => {
      result.current.setPage(3);
    });
    expect(result.current.page).toBe(3);

    act(() => {
      result.current.updateFilters({ status: "published" });
    });

    expect(result.current.page).toBe(1);
    expect(result.current.filters.status).toBe("published");
  });

  it("toggles sort direction on repeated field selection", () => {
    const { result } = renderHook(() => useDrugBrowserState());

    act(() => {
      result.current.toggleSort("slug");
    });
    expect(result.current.sortField).toBe("slug");
    expect(result.current.sortDirection).toBe("asc");

    act(() => {
      result.current.toggleSort("slug");
    });
    expect(result.current.sortDirection).toBe("desc");
  });
});
