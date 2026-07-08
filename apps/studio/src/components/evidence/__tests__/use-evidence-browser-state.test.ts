/**
 * @vitest-environment jsdom
 */
import { describe, expect, it } from "vitest";
import { act, renderHook } from "@testing-library/react";
import { useEvidenceBrowserState } from "../hooks/use-evidence-browser-state";

describe("useEvidenceBrowserState", () => {
  it("resets page when filters change", () => {
    const { result } = renderHook(() => useEvidenceBrowserState());

    act(() => {
      result.current.setPage(3);
    });
    expect(result.current.page).toBe(3);

    act(() => {
      result.current.updateFilters({ evidenceType: "rct" });
    });

    expect(result.current.page).toBe(1);
    expect(result.current.filters.evidenceType).toBe("rct");
  });

  it("opens detail and form flows", () => {
    const { result } = renderHook(() => useEvidenceBrowserState());

    act(() => {
      result.current.openDetail("evidence:abc");
    });
    expect(result.current.selectedId).toBe("evidence:abc");

    act(() => {
      result.current.openEditForm("evidence:abc");
    });
    expect(result.current.formOpen).toBe(true);
    expect(result.current.formMode).toBe("edit");
  });
});
