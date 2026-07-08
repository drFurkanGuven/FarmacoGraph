import { describe, expect, it } from "vitest";
import type { WorkflowTimelineEvent } from "@/lib/api";
import { sortTimelineEvents, timelineLabel, toTimelinePresentation } from "../timeline-utils";

function event(
  overrides: Partial<WorkflowTimelineEvent> & Pick<WorkflowTimelineEvent, "id" | "kind">,
): WorkflowTimelineEvent {
  return {
    action: overrides.action ?? `curator.${overrides.kind}`,
    timestamp: overrides.timestamp ?? "2026-07-08T10:00:00.000Z",
    actor_id: overrides.actor_id ?? null,
    detail: overrides.detail ?? null,
    diff: overrides.diff ?? null,
    ...overrides,
  };
}

describe("timeline-utils", () => {
  it("maps known kinds to curator-facing labels", () => {
    expect(timelineLabel("workflow_created")).toBe("Workflow created");
    expect(timelineLabel("publish_failed")).toBe("Publish failed");
  });

  it("prefers API detail text for descriptions", () => {
    const presentation = toTimelinePresentation(
      event({
        id: "1",
        kind: "validation_run",
        detail: "Validation failed (2 errors)",
      }),
    );
    expect(presentation.title).toBe("Validation run");
    expect(presentation.description).toBe("Validation failed (2 errors)");
  });

  it("sorts events chronologically", () => {
    const sorted = sortTimelineEvents([
      event({ id: "2", kind: "submitted", timestamp: "2026-07-08T11:00:00.000Z" }),
      event({ id: "1", kind: "workflow_created", timestamp: "2026-07-08T10:00:00.000Z" }),
    ]);
    expect(sorted.map((entry) => entry.id)).toEqual(["1", "2"]);
  });
});
