import { describe, expect, it } from "vitest";
import type { CurriculumData } from "@/lib/api/types";
import {
  buildDrugRows,
  confidenceLevelFromScore,
  filterDrugRows,
  paginateDrugRows,
  sortDrugRows,
  totalPages,
  validationStatusFromRow,
} from "../utils";
import { DEFAULT_DRUG_BROWSER_FILTERS } from "../types";

describe("confidenceLevelFromScore", () => {
  it("maps API confidence scores to levels", () => {
    expect(confidenceLevelFromScore(0.9)).toBe("high");
    expect(confidenceLevelFromScore(0.65)).toBe("medium");
    expect(confidenceLevelFromScore(0.2)).toBe("low");
    expect(confidenceLevelFromScore(null)).toBeNull();
  });
});

describe("validationStatusFromRow", () => {
  it("marks published graph drugs as valid", () => {
    expect(
      validationStatusFromRow({
        status: "published",
        source: "graph",
      }),
    ).toBe("valid");
  });

  it("marks workflow drugs as pending", () => {
    expect(
      validationStatusFromRow({
        status: "draft",
        workflowState: "review",
        source: "graph",
      }),
    ).toBe("pending");
  });
});

describe("buildDrugRows", () => {
  const curriculum: CurriculumData = {
    curriculum: {
      module: "cardiovascular",
      dataset_version: "2026.1.0",
      target_count: 2,
      categories: [
        {
          slug: "category-a",
          name: "Category A",
          drugs: [
            { slug: "drug-published", status: "published" },
            { slug: "drug-pending", status: "pending" },
          ],
        },
      ],
    },
    stats: {
      total_slugs: 2,
      by_status: { published: 1, pending: 1 },
      published_in_graph: 1,
      completion_pct: 50,
    },
  };

  it("merges published drugs with curriculum and workflow metadata", () => {
    const rows = buildDrugRows({
      drugs: [
        {
          id: "drug-1",
          slug: "drug-published",
          label: "Published drug",
          module: "cardiovascular",
          status: "published",
          confidence_score: 0.92,
        },
      ],
      curriculum,
      drafts: [
        {
          id: "wf-1",
          entity_id: "drug-1",
          entity_type: "Drug",
          state: "draft",
          notes: null,
          entity_slug: "drug-published",
        },
      ],
      reviews: [],
      module: "cardiovascular",
    });

    expect(rows).toHaveLength(2);
    const published = rows.find((row) => row.slug === "drug-published");
    expect(published?.confidenceLevel).toBe("high");
    expect(published?.workflowState).toBe("draft");
    expect(published?.validationStatus).toBe("pending");

    const pending = rows.find((row) => row.slug === "drug-pending");
    expect(pending?.source).toBe("curriculum");
    expect(pending?.validationStatus).toBe("pending");
  });
});

describe("filterDrugRows", () => {
  const rows = buildDrugRows({
    drugs: [{ id: "1", slug: "alpha", label: "Alpha", status: "published", confidence_score: 0.9 }],
    curriculum: null,
    drafts: [],
    reviews: [],
    module: "cardiovascular",
  });

  it("filters by validation status", () => {
    const filtered = filterDrugRows(rows, {
      ...DEFAULT_DRUG_BROWSER_FILTERS,
      validation: "valid",
    });
    expect(filtered).toHaveLength(1);
  });
});

describe("sortDrugRows", () => {
  const rows = buildDrugRows({
    drugs: [
      { id: "1", slug: "beta", label: "Beta", status: "published" },
      { id: "2", slug: "alpha", label: "Alpha", status: "published" },
    ],
    curriculum: null,
    drafts: [],
    reviews: [],
  });

  it("sorts by label ascending", () => {
    const sorted = sortDrugRows(rows, "label", "asc");
    expect(sorted.map((row) => row.slug)).toEqual(["alpha", "beta"]);
  });
});

describe("paginateDrugRows", () => {
  const rows = Array.from({ length: 5 }, (_, index) => ({
    id: String(index),
    slug: `drug-${index}`,
    label: `Drug ${index}`,
    status: "published",
    confidenceScore: null,
    confidenceLevel: null,
    validationStatus: "valid" as const,
    source: "graph" as const,
  }));

  it("returns the requested page slice", () => {
    expect(paginateDrugRows(rows, 2, 2).map((row) => row.slug)).toEqual(["drug-2", "drug-3"]);
  });
});

describe("totalPages", () => {
  it("calculates page count", () => {
    expect(totalPages(0, 25)).toBe(1);
    expect(totalPages(26, 25)).toBe(2);
  });
});
