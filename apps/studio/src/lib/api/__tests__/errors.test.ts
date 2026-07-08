import { describe, expect, it } from "vitest";
import { ApiError, createApiError, normalizeErrorMessage, parseErrorBody } from "../errors";

describe("parseErrorBody", () => {
  it("parses JSON error payloads", () => {
    const body = parseErrorBody('{"error":{"code":"ENTITY_NOT_FOUND","message":"Not found"}}');
    expect(body?.error?.code).toBe("ENTITY_NOT_FOUND");
  });

  it("returns message wrapper for non-JSON text", () => {
    expect(parseErrorBody("upstream timeout")).toEqual({ message: "upstream timeout" });
  });

  it("returns null for empty body", () => {
    expect(parseErrorBody("")).toBeNull();
  });
});

describe("normalizeErrorMessage", () => {
  it("prefers structured error.message", () => {
    expect(
      normalizeErrorMessage({ error: { code: "X", message: "Structured failure" } }, 400),
    ).toBe("Structured failure");
  });

  it("joins FastAPI validation detail arrays", () => {
    expect(
      normalizeErrorMessage({ detail: [{ msg: "field required" }, { msg: "invalid uuid" }] }, 422),
    ).toBe("field required; invalid uuid");
  });

  it("falls back to status code", () => {
    expect(normalizeErrorMessage(null, 503)).toBe("Request failed (503)");
  });
});

describe("createApiError", () => {
  it("creates ApiError with trace id and code", () => {
    const error = createApiError(
      404,
      { error: { code: "ENTITY_NOT_FOUND", message: "Drug missing" } },
      "trace-123",
    );
    expect(error).toBeInstanceOf(ApiError);
    expect(error.status).toBe(404);
    expect(error.code).toBe("ENTITY_NOT_FOUND");
    expect(error.traceId).toBe("trace-123");
    expect(error.message).toBe("Drug missing");
  });
});
