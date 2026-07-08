import { render, screen } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";
import { ValidationCenterView } from "../validation-center-view";

vi.mock("../validation-hooks", () => ({
  useValidationSummary: () => ({
    data: {
      data: {
        failed_count: 1,
        pending_count: 0,
        recent_failures: [
          {
            source: "job",
            job_id: "job-1",
            entity_id: "drug-1",
            message: "Drug has no outgoing relationships",
            at: new Date().toISOString(),
          },
        ],
      },
    },
    isLoading: false,
    isFetching: false,
    error: null,
    refetch: vi.fn(),
    dataUpdatedAt: Date.now(),
  }),
  useGraphValidationJobs: () => ({
    data: {
      data: [
        {
          id: "job-1",
          job_type: "graph_validation",
          status: "failed",
          created_at: null,
          started_at: null,
          completed_at: new Date().toISOString(),
          error_message: "Drug has no outgoing relationships",
          payload: { entity_id: "drug-1" },
        },
      ],
    },
    isLoading: false,
    isFetching: false,
    error: null,
    refetch: vi.fn(),
  }),
  useQueueValidation: () => ({
    data: {
      data: {
        items: [
          {
            workflowId: "wf-1",
            entityId: "drug-2",
            entityLabel: "Ramipril draft",
            workflowState: "draft",
            valid: false,
            issues: [
              {
                constraint_id: "FG-C018",
                level: "biomedical",
                severity: "error",
                message: "Provenance metadata is required",
                entity_id: "drug-2",
              },
              {
                constraint_id: null,
                level: "ontology",
                severity: "error",
                message: "Forbidden: Drug -[TARGETS]-> Disease",
                relationship_type: "TARGETS",
                entity_id: "drug-2",
              },
            ],
          },
        ],
        skipped: 0,
      },
    },
    isLoading: false,
    isFetching: false,
    error: null,
    refetch: vi.fn(),
  }),
}));

describe("ValidationCenterView", () => {
  it("renders validation center sections with live grouped data", () => {
    render(<ValidationCenterView />);

    expect(screen.getByRole("heading", { name: /validation center/i })).toBeInTheDocument();
    expect(screen.getByText("Errors")).toBeInTheDocument();
    expect(screen.getByText("Warnings")).toBeInTheDocument();
    expect(screen.getByText("Ontology violations")).toBeInTheDocument();
    expect(screen.getByText("Missing evidence")).toBeInTheDocument();
    expect(screen.getByText("Publish readiness")).toBeInTheDocument();
    expect(screen.getAllByText("Provenance metadata is required").length).toBeGreaterThanOrEqual(1);
    expect(screen.getAllByText(/forbidden: drug -\[targets\]-> disease/i).length).toBeGreaterThanOrEqual(1);
    expect(screen.getByText("Ramipril draft")).toBeInTheDocument();
  });
});
