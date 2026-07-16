"use client";

import Link from "next/link";
import { Database, Network, Rocket, TriangleAlert } from "lucide-react";
import { Button } from "@/components/ui/button";
import { ApiError } from "@/lib/api";
import type { GraphProjectionData, WorkflowState } from "@/lib/api/types";

export type GraphEmptyReason =
  | "invalid_identity"
  | "neo4j_unavailable"
  | "draft"
  | "approved"
  | "not_in_graph"
  | "no_relationships"
  | "load_error"
  | "generic";

export function resolveGraphEmptyReason(input: {
  identityResolved: boolean;
  workflowStatus: WorkflowState | null | undefined;
  graph: GraphProjectionData | undefined;
  graphError: unknown;
  nodeCount: number;
  edgeCount: number;
}): GraphEmptyReason | null {
  const { identityResolved, workflowStatus, graph, graphError, nodeCount, edgeCount } = input;

  if (graphError instanceof ApiError && (graphError.status === 422 || graphError.status === 404)) {
    return "invalid_identity";
  }
  if (graphError) return "load_error";
  if (!identityResolved) return "invalid_identity";
  if (graph?.neo4j_available === false) return "neo4j_unavailable";

  if (nodeCount > 0 && edgeCount === 0) return "no_relationships";
  if (nodeCount > 0) return null;

  if (workflowStatus === "draft" || workflowStatus === "review") return "draft";
  if (workflowStatus === "approved") return "approved";
  if (graph?.drug_in_graph === false || workflowStatus === "published" || workflowStatus === "deprecated") {
    return "not_in_graph";
  }
  return "generic";
}

const COPY: Record<
  GraphEmptyReason,
  { title: string; body: string; cta?: "publish" | "editor"; ctaLabel?: string }
> = {
  invalid_identity: {
    title: "Invalid graph identity",
    body: "This drug slug or UUID could not be resolved to a curator entity. Open the drug browser and pick a known drug.",
    cta: "editor",
    ctaLabel: "Open drug browser",
  },
  neo4j_unavailable: {
    title: "Neo4j unavailable",
    body: "The live graph projection needs a connected Neo4j instance. Postgres drafts still work; publish and neighborhood reads will stay empty until Neo4j is up.",
  },
  draft: {
    title: "Draft only — not in live graph",
    body: "This package exists in Studio but has not been published to Neo4j. Open the Publish Wizard to validate, approve, and project relationships.",
    cta: "publish",
    ctaLabel: "Open Publish Wizard",
  },
  approved: {
    title: "Approved — ready to publish",
    body: "Workflow is approved, but the Drug node is not in the Neo4j projection yet. Publish to graph to materialize nodes and relationships.",
    cta: "publish",
    ctaLabel: "Publish to graph",
  },
  not_in_graph: {
    title: "Not in Neo4j projection",
    body: "Studio knows this drug, but no matching Drug node was found in Neo4j. Republish the package (with relationships) to populate the live graph.",
    cta: "publish",
    ctaLabel: "Open Publish Wizard",
  },
  no_relationships: {
    title: "Graph node exists, but no relationships found",
    body: "The Drug is published in Neo4j, yet this neighborhood has no edges at the selected depth. Add BELONGS_TO / TREATS / mechanism links and republish.",
    cta: "editor",
    ctaLabel: "Open editor",
  },
  load_error: {
    title: "Unable to load graph projection",
    body: "The graph API request failed. Retry after confirming API auth and Neo4j connectivity.",
    cta: "editor",
    ctaLabel: "Open editor",
  },
  generic: {
    title: "Empty neighborhood",
    body: "No published nodes were returned for this drug. Publish to Neo4j with relationships to see the live projection.",
    cta: "publish",
    ctaLabel: "Open Publish Wizard",
  },
};

export function GraphNeighborhoodEmptyState({
  reason,
  editorHref,
  publishHref,
}: {
  reason: GraphEmptyReason;
  editorHref: string;
  publishHref: string;
}) {
  const copy = COPY[reason];
  const href =
    copy.cta === "publish" ? publishHref : copy.cta === "editor" ? editorHref : null;
  const Icon =
    reason === "neo4j_unavailable"
      ? Database
      : reason === "invalid_identity" || reason === "load_error"
        ? TriangleAlert
        : reason === "no_relationships"
          ? Network
          : Rocket;

  return (
    <div className="space-y-3 rounded-md border bg-muted/30 p-4">
      <div className="flex items-start gap-3">
        <Icon className="mt-0.5 h-4 w-4 shrink-0 text-muted-foreground" />
        <div className="space-y-1">
          <p className="text-sm font-medium">{copy.title}</p>
          <p className="text-sm text-muted-foreground">{copy.body}</p>
        </div>
      </div>
      {href && copy.ctaLabel ? (
        <Button asChild size="sm" variant={copy.cta === "publish" ? "default" : "outline"}>
          <Link href={href}>{copy.ctaLabel}</Link>
        </Button>
      ) : null}
    </div>
  );
}
