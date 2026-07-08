/**
 * @vitest-environment jsdom
 */
import { render, screen, fireEvent } from "@testing-library/react";
import { describe, expect, it, vi, beforeEach } from "vitest";
import { Dialog, DialogContent } from "@/components/ui/dialog";
import { PublishWizard } from "../publish-wizard";
import { PublishConfirmation, PublishResult } from "../publish-phases";

const requestActionMock = vi.fn();

vi.mock("../use-publish-wizard", () => ({
  usePublishWizard: () => ({
    phase: "overview",
    pendingAction: null,
    result: null,
    workflowId: "wf-1",
    workflowState: "draft",
    ensuringWorkflow: false,
    ensureError: null,
    readiness: {
      validation: {
        status: "ready",
        message: "Package passed validation and is ready to publish.",
        blockingErrorCount: 0,
        graphFailures: 0,
        graphPending: 0,
        publishReady: true,
        canPublish: false,
        grouped: {
          schema: [],
          ontology: [],
          biomedical: [],
          educational: [],
          evidence: [],
          workflow: [],
        },
        evidence: {
          categorized: {
            blockers: [],
            warnings: [],
            missing: [],
            lowConfidence: [],
          },
          blockerCount: 0,
          warningCount: 0,
          missingCount: 0,
          lowConfidenceCount: 0,
          hasEvidenceBlockers: false,
          publishBlockedByEvidence: false,
        },
      },
      loading: false,
      validating: false,
      error: null,
      refetch: vi.fn(),
      gateAction: () => ({ allowed: true, reason: null }),
    },
    availableAction: "submit",
    hasUnsavedChanges: false,
    isExecuting: false,
    actionLabels: {
      submit: "Submit for review",
      approve: "Approve",
      publish: "Publish to graph",
    },
    getActionBlockers: () => [],
    requestAction: requestActionMock,
    confirmAction: vi.fn(),
    cancelConfirm: vi.fn(),
    closeResult: vi.fn(),
    reset: vi.fn(),
    ensureWorkflow: vi.fn().mockResolvedValue("wf-1"),
  }),
}));

vi.mock("@/lib/api/react-query/hooks", () => ({
  useDrugWorkflowState: () => ({
    data: {
      data: {
        workflow_id: "wf-1",
        status: "draft",
        publish_ready: true,
      },
    },
    isLoading: false,
  }),
}));

const baseProps = {
  open: true,
  onOpenChange: vi.fn(),
  drugId: "ramipril",
  workflow: {
    id: "wf-1",
    entity_id: "entity-1",
    entity_type: "Drug",
    state: "draft",
    notes: null,
  },
  package: {
    entity_payload: { slug: "ramipril", label: "Ramipril" },
    related_entities: [],
    relationships: [],
  },
  saveStatus: "saved" as const,
  dirtySections: [] as string[],
  editorValidation: { valid: true, issues: [] },
  validationPending: false,
  onWorkflowUpdated: vi.fn(),
  onNavigateSection: vi.fn(),
};

describe("PublishWizard UI", () => {
  beforeEach(() => {
    requestActionMock.mockClear();
  });

  it("renders workflow and validation panels in overview phase", () => {
    render(<PublishWizard {...baseProps} />);

    expect(screen.getByRole("heading", { name: "Publish wizard" })).toBeInTheDocument();
    expect(screen.getByText("Workflow state")).toBeInTheDocument();
    expect(screen.getByText("Validation readiness")).toBeInTheDocument();
    expect(screen.getByText("Missing requirements")).toBeInTheDocument();
    expect(screen.getByRole("button", { name: "Submit for review" })).toBeInTheDocument();
  });

  it("requests submit action when primary button is clicked", () => {
    render(<PublishWizard {...baseProps} />);

    fireEvent.click(screen.getByRole("button", { name: "Submit for review" }));
    expect(requestActionMock).toHaveBeenCalledWith("submit");
  });
});

describe("PublishConfirmation", () => {
  it("lists blockers and disables confirm until resolved", () => {
    const onConfirm = vi.fn();
    render(
      <Dialog open>
        <DialogContent>
          <PublishConfirmation
            action="publish"
            actionLabel="Publish to graph"
            workflowState="approved"
            blockers={["2 blocking validation issues must be resolved."]}
            isExecuting={false}
            onConfirm={onConfirm}
            onCancel={vi.fn()}
          />
        </DialogContent>
      </Dialog>,
    );

    expect(screen.getByText("Cannot proceed yet")).toBeInTheDocument();
    expect(screen.getByRole("button", { name: "Publish to graph" })).toBeDisabled();
    fireEvent.click(screen.getByRole("button", { name: "Publish to graph" }));
    expect(onConfirm).not.toHaveBeenCalled();
  });
});

describe("PublishResult error handling", () => {
  it("shows failure message and back action", () => {
    const onClose = vi.fn();
    render(
      <Dialog open>
        <DialogContent>
          <PublishResult
            result={{
              status: "error",
              action: "publish",
              message: "Cannot publish from state: review",
              workflow: { id: "wf-1", entity_id: "e1", entity_type: "Drug", state: "review", notes: null },
            }}
            actionLabel="Publish to graph"
            slug="ramipril"
            onClose={onClose}
            onDone={vi.fn()}
          />
        </DialogContent>
      </Dialog>,
    );

    expect(screen.getByText("Publish to graph failed")).toBeInTheDocument();
    expect(screen.getByText("Cannot publish from state: review")).toBeInTheDocument();
    fireEvent.click(screen.getByRole("button", { name: "Back to wizard" }));
    expect(onClose).toHaveBeenCalledOnce();
  });
});
