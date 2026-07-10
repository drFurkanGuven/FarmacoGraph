/**
 * @vitest-environment jsdom
 */
import type { ReactNode } from "react";
import { act, renderHook, waitFor } from "@testing-library/react";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { beforeEach, describe, expect, it, vi } from "vitest";
import { usePublishWizard } from "../use-publish-wizard";

const saveWorkflowPackage = vi.fn();
const publishWorkflow = vi.fn();
const request = vi.fn();

vi.mock("@/lib/hooks/use-api-client", () => ({
  useApiClient: () => ({
    saveWorkflowPackage,
    publishWorkflow,
    request,
  }),
}));

vi.mock("@/lib/auth/hooks", () => ({
  usePermissions: () => ({
    hasPermission: () => true,
  }),
}));

function createWrapper() {
  const queryClient = new QueryClient({
    defaultOptions: {
      queries: { retry: false },
      mutations: { retry: false },
    },
  });

  return function Wrapper({ children }: { children: ReactNode }) {
    return <QueryClientProvider client={queryClient}>{children}</QueryClientProvider>;
  };
}

const packageInput = {
  entity_payload: {
    id: "drug-1",
    slug: "ramipril",
    label: "Ramipril",
    provenance: { curator_attestation: true },
  },
  related_entities: [],
  relationships: [],
};

describe("usePublishWizard", () => {
  beforeEach(() => {
    saveWorkflowPackage.mockReset();
    publishWorkflow.mockReset();
    request.mockReset();
    request.mockResolvedValue({
      data: { failed_count: 0, pending_count: 0, recent_failures: [] },
      meta: { api_version: "v1" },
    });
    publishWorkflow.mockResolvedValue({
      data: {
        workflow: {
          id: "wf-1",
          entity_id: "drug-1",
          entity_type: "Drug",
          state: "published",
          notes: null,
        },
        published_slug: "ramipril",
        graph_write: { status: "skipped" },
        validation_summary: { valid: true, publish_ready: true },
      },
      meta: { api_version: "v1" },
    });
  });

  it("publishes an approved package without trying to edit the locked draft", async () => {
    const onWorkflowUpdated = vi.fn();
    const { result } = renderHook(
      () =>
        usePublishWizard({
          drugId: "ramipril",
          workflow: {
            id: "wf-1",
            entity_id: "drug-1",
            entity_type: "Drug",
            state: "approved",
            notes: null,
          },
          package: packageInput,
          saveStatus: "saved",
          dirtySections: [],
          editorValidation: { valid: true, issues: [] },
          validationPending: false,
          onWorkflowUpdated,
          enabled: true,
        }),
      { wrapper: createWrapper() },
    );

    act(() => {
      result.current.requestAction("publish");
    });

    await act(async () => {
      await result.current.confirmAction();
    });

    await waitFor(() => expect(publishWorkflow).toHaveBeenCalledWith("wf-1", packageInput));
    expect(saveWorkflowPackage).not.toHaveBeenCalled();
    expect(onWorkflowUpdated).toHaveBeenCalledWith(
      expect.objectContaining({ id: "wf-1", state: "published" }),
    );
  });
});
