import { describe, expect, it, vi } from "vitest";
import { ApiError } from "../errors";
import { getRetryDelay, isRetryableError, withRetry } from "../retry";

describe("isRetryableError", () => {
  it("retries 5xx ApiError", () => {
    expect(isRetryableError(new ApiError("fail", 503))).toBe(true);
  });

  it("retries 429 ApiError", () => {
    expect(isRetryableError(new ApiError("rate limited", 429))).toBe(true);
  });

  it("does not retry 401/403/404", () => {
    expect(isRetryableError(new ApiError("unauthorized", 401))).toBe(false);
    expect(isRetryableError(new ApiError("forbidden", 403))).toBe(false);
    expect(isRetryableError(new ApiError("missing", 404))).toBe(false);
  });

  it("retries network TypeError", () => {
    expect(isRetryableError(new TypeError("Failed to fetch"))).toBe(true);
  });
});

describe("getRetryDelay", () => {
  it("increases linearly with attempt", () => {
    expect(getRetryDelay(0, 100)).toBe(100);
    expect(getRetryDelay(2, 100)).toBe(300);
  });
});

describe("withRetry", () => {
  it("retries until success", async () => {
    const fn = vi
      .fn()
      .mockRejectedValueOnce(new ApiError("temporary", 503))
      .mockResolvedValueOnce("ok");

    const result = await withRetry(() => fn(), { retries: 2, baseDelayMs: 1 });
    expect(result).toBe("ok");
    expect(fn).toHaveBeenCalledTimes(2);
  });

  it("stops retrying non-retryable errors", async () => {
    const fn = vi.fn().mockRejectedValue(new ApiError("bad request", 400));
    await expect(withRetry(() => fn(), { retries: 3, baseDelayMs: 1 })).rejects.toThrow("bad request");
    expect(fn).toHaveBeenCalledTimes(1);
  });
});
