/**
 * @vitest-environment jsdom
 */
import React from "react";
import { describe, expect, it } from "vitest";
import { renderToStaticMarkup } from "react-dom/server";
import { Badge } from "../badge";
import { ValidationBadge } from "../validation-badge";
import { ConfidenceBadge } from "../confidence-badge";
import { EvidenceBadge } from "../evidence-badge";
import { StatusBadge } from "../status-badge";
import { EmptyState } from "../empty-state";
import { ErrorState } from "../error-state";

describe("Badge components", () => {
  it("renders base Badge", () => {
    const html = renderToStaticMarkup(<Badge>Label</Badge>);
    expect(html).toContain("Label");
  });

  it("renders ValidationBadge with status label", () => {
    const html = renderToStaticMarkup(<ValidationBadge status="valid" />);
    expect(html).toContain("Valid");
  });

  it("renders ConfidenceBadge with level", () => {
    const html = renderToStaticMarkup(<ConfidenceBadge level="high" score={90} />);
    expect(html).toContain("High");
    expect(html).toContain("90");
  });

  it("renders EvidenceBadge with type label", () => {
    const html = renderToStaticMarkup(<EvidenceBadge type="primary" />);
    expect(html).toContain("Primary");
  });

  it("renders StatusBadge with status label", () => {
    const html = renderToStaticMarkup(<StatusBadge status="active" />);
    expect(html).toContain("Active");
  });
});

describe("Feedback components", () => {
  it("renders EmptyState with title", () => {
    const html = renderToStaticMarkup(<EmptyState title="No items" description="Add one to get started." />);
    expect(html).toContain("No items");
    expect(html).toContain("Add one to get started.");
  });

  it("renders ErrorState with message", () => {
    const html = renderToStaticMarkup(<ErrorState message="Request failed." />);
    expect(html).toContain("Request failed.");
  });
});
