/**
 * @vitest-environment jsdom
 */
import { describe, expect, it, vi } from "vitest";
import { render, screen } from "@testing-library/react";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { EvidenceBrowser } from "../evidence-browser";

vi.mock("@/lib/hooks/use-api-client", () => ({
  useApiClient: () => ({
    request: vi.fn().mockResolvedValue({ data: [], meta: { api_version: "v1" } }),
    statistics: vi.fn().mockResolvedValue({
      data: { evidence_count: 0, entity_count: 0, relationship_count: 0, module_stats: {}, latest_snapshot: null },
      meta: {},
    }),
    validatePackage: vi.fn(),
  }),
}));

vi.mock("@/lib/api/evidence", async (importOriginal) => {
  const actual = await importOriginal<typeof import("@/lib/api/evidence")>();
  return {
    ...actual,
    searchEvidence: vi.fn().mockResolvedValue({ data: [], meta: {} }),
    getEvidence: vi.fn().mockResolvedValue({ data: null, meta: {} }),
  };
});

vi.mock("@/lib/api/react-query/hooks", () => ({
  useStatistics: () => ({
    data: {
      data: { evidence_count: 12, entity_count: 0, relationship_count: 0, module_stats: {}, latest_snapshot: null },
      meta: { dataset_version: "v1" },
    },
    isLoading: false,
    isFetching: false,
    error: null,
  }),
}));

function renderBrowser() {
  const client = new QueryClient({ defaultOptions: { queries: { retry: false } } });
  return render(
    <QueryClientProvider client={client}>
      <EvidenceBrowser />
    </QueryClientProvider>,
  );
}

describe("EvidenceBrowser", () => {
  it("renders manager shell and empty search prompt", () => {
    renderBrowser();
    expect(screen.getByText("Evidence manager")).toBeInTheDocument();
    expect(screen.getByText("Start a search")).toBeInTheDocument();
    expect(screen.getByText(/Dataset contains 12 evidence nodes/)).toBeInTheDocument();
    expect(screen.getByRole("button", { name: /New evidence/i })).toBeInTheDocument();
  });
});
