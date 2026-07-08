import { describe, expect, it } from "vitest";
import {
  buildPaginationParams,
  clampPageLimit,
  getNextOffset,
  hasMorePages,
  infiniteQueryGetNextPageParam,
} from "../pagination";

describe("clampPageLimit", () => {
  it("defaults to 50", () => {
    expect(clampPageLimit()).toBe(50);
  });

  it("clamps to max 200", () => {
    expect(clampPageLimit(500)).toBe(200);
  });

  it("enforces minimum of 1", () => {
    expect(clampPageLimit(0)).toBe(1);
  });
});

describe("buildPaginationParams", () => {
  it("omits undefined values", () => {
    expect(buildPaginationParams({ limit: 25, offset: 0 })).toEqual({ limit: 25, offset: 0 });
    expect(buildPaginationParams()).toEqual({});
  });
});

describe("getNextOffset", () => {
  it("adds page size to current offset", () => {
    expect(getNextOffset({ offset: 50 }, 50)).toBe(100);
    expect(getNextOffset({}, 25)).toBe(25);
  });
});

describe("hasMorePages", () => {
  it("uses total when available", () => {
    expect(hasMorePages({ total: 100, offset: 0 }, 50, 50)).toBe(true);
    expect(hasMorePages({ total: 100, offset: 50 }, 50, 50)).toBe(false);
  });

  it("uses full page size as heuristic without total", () => {
    expect(hasMorePages({}, 50, 50)).toBe(true);
    expect(hasMorePages({}, 10, 50)).toBe(false);
  });
});

describe("infiniteQueryGetNextPageParam", () => {
  it("returns next offset when more pages exist", () => {
    const lastPage = { data: Array.from({ length: 50 }), meta: { offset: 0, total: 120 } };
    expect(infiniteQueryGetNextPageParam(lastPage, [lastPage], 50)).toBe(50);
  });

  it("returns undefined on last page", () => {
    const lastPage = { data: Array.from({ length: 20 }), meta: { offset: 100, total: 120 } };
    expect(infiniteQueryGetNextPageParam(lastPage, [lastPage], 50)).toBeUndefined();
  });
});
