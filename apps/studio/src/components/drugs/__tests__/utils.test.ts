import { describe, expect, it } from "vitest";
import type { CurriculumData, DrugBrowseItem } from "@/lib/api/types";
import {
  browseItemToRow,
  buildDrugRows,
  confidenceLevelFromScore,
  drugEditorHref,
  filterDrugRows,
  paginateDrugRows,
  sortDrugRows,
  totalPages,
  validationStatusFromRow,
} from "../utils";
import { DEFAULT_DRUG_BROWSER_FILTERS } from "../types";

describe("drugEditorHref", () => {
  it("builds the studio editor route from a slug", () => {
    expect(drugEditorHref("ramipril")).toBe("/knowledge/drugs/ramipril");
    expect(drugEditorHref("ace inhibitor")).toBe("/knowledge/drugs/ace%20inhibitor");
  });
});

describe("confidenceLevelFromScore", () => {
  it("maps API confidence scores to levels", () => {
    expect(confidenceLevelFromScore(0.9)).toBe("high");
    expect(confidenceLevelFromScore(0.65)).toBe("medium");
    expect(confidenceLevelFromScore(0.2)).toBe("low");
    expect(confidenceLevelFromScore(null)).toBeNull();
  });
});

describe("validationStatusFromRow", () => {
  it("marks packages that passed validation as valid", () => {
    expect(
      validationStatusFromRow({
        status: "draft",
        validation_valid: true,
        validation_errors: 0,
      }),
    ).toBe("valid");
  });

  it("marks packages with validation errors as invalid", () => {
    expect(
      validationStatusFromRow({
        status: "draft",
        validation_valid: false,
        validation_errors: 3,
      }),
    ).toBe("invalid");
  });

  it("marks unpublished drugs without validation results as pending", () => {
    expect(
      validationStatusFromRow({
        status: "pending",
        curriculumStatus: "pending",
        validation_valid: false,
        validation_errors: 0,
      }),
    ).toBe("pending");
  });

  it("marks published drugs without an open draft as valid", () => {
    expect(
      validationStatusFromRow({
        status: "published",
        validation_valid: false,
        validation_errors: 0,
      }),
    ).toBe("valid");
  });
});

describe("browseItemToRow", () => {
  it("maps curator browse items including real validation", () => {
    const item: DrugBrowseItem = {
      slug: "ramipril",
      label: "Ramipril",
      entity_id: "drug-1",
      module: "cardiovascular",
      category_slug: "acei",
      category_name: "ACE inhibitors",
      curriculum_status: "pending",
      publication_status: "pending",
      workflow_id: "wf-1",
      workflow_state: "draft",
      validation_valid: true,
      validation_errors: 0,
      confidence_score: 0.9,
    };

    const row = browseItemToRow(item);
    expect(row.validationStatus).toBe("valid");
    expect(row.workflowState).toBe("draft");
    expect(row.source).toBe("curriculum");
    expect(row.confidenceLevel).toBe("high");
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
          validation_valid: true,
          validation_errors: 0,
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
    expect(published?.validationStatus).toBe("valid");

    const pending = rows.find((row) => row.slug === "drug-pending");
    expect(pending?.source).toBe("curriculum");
    expect(pending?.validationStatus).toBe("pending");
  });

  it("surfaces invalid package validation on graph drugs", () => {
    const rows = buildDrugRows({
      drugs: [
        {
          id: "drug-1",
          slug: "drug-published",
          label: "Published drug",
          status: "published",
          validation_valid: false,
          validation_errors: 2,
        },
      ],
      curriculum: null,
      drafts: [],
      reviews: [],
    });

    expect(rows[0]?.validationStatus).toBe("invalid");
  });
});

describe("filterDrugRows", () => {
  const rows = buildDrugRows({
    drugs: [
      {
        id: "1",
        slug: "alpha",
        label: "Alpha",
        status: "published",
        confidence_score: 0.9,
        validation_valid: true,
        validation_errors: 0,
      },
    ],
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
