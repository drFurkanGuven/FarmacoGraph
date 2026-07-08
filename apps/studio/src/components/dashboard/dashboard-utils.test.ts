import { describe, expect, it } from "vitest";
import {
  describeAuditEntry,
  formatRelativeTime,
  jobStatusLabel,
  resolveModuleSlug,
} from "./dashboard-utils";
import type { AuditLogItem } from "@/lib/api/types";

describe("resolveModuleSlug", () => {
  it("maps default workspace to cardiovascular module", () => {
    expect(resolveModuleSlug("default")).toBe("cardiovascular");
  });

  it("passes through named workspace slugs", () => {
    expect(resolveModuleSlug("cardiovascular")).toBe("cardiovascular");
    expect(resolveModuleSlug("oncology")).toBe("oncology");
  });
});

describe("formatRelativeTime", () => {
  it("returns em dash for missing values", () => {
    expect(formatRelativeTime(null)).toBe("—");
    expect(formatRelativeTime(undefined)).toBe("—");
  });

  it("formats recent timestamps", () => {
    const recent = new Date(Date.now() - 5 * 60_000).toISOString();
    expect(formatRelativeTime(recent)).toBe("5m ago");
  });
});

describe("describeAuditEntry", () => {
  it("describes publish actions", () => {
    const entry: AuditLogItem = {
      id: "1",
      timestamp: null,
      action: "publish",
      resource_type: "Drug",
      resource_id: "drug-1",
      actor_id: null,
      diff: null,
    };
    expect(describeAuditEntry(entry)).toBe("Published drug drug-1");
  });
});

describe("jobStatusLabel", () => {
  it("replaces underscores with spaces", () => {
    expect(jobStatusLabel("in_progress")).toBe("in progress");
  });
});
