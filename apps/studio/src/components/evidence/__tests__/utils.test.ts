import { describe, expect, it } from "vitest";
import type { EvidenceSearchHit } from "@/lib/api/evidence";
import type { EvidenceBrowserFilters } from "../types";
import {
  filterEvidenceRows,
  formatEvidenceTypeLabel,
  paginateRows,
  qualityToConfidenceLevel,
  searchHitToRow,
  sortEvidenceRows,
  totalPages,
} from "../utils";

const sampleHit: EvidenceSearchHit = {
  entity: {
    id: "evidence:1",
    type: "Evidence",
    slug: "study-a",
    label: "Study A",
    evidence_type: "rct",
    year: 2020,
    quality_score: 0.82,
    status: "published",
  },
  score: 0.91,
  snippet: "Primary endpoint met.",
};

describe("evidence utils", () => {
  it("maps search hits to browser rows", () => {
    const row = searchHitToRow(sampleHit);
    expect(row.label).toBe("Study A");
    expect(row.evidenceType).toBe("rct");
    expect(row.searchScore).toBe(0.91);
  });

  it("filters by evidence type and quality", () => {
    const rows = [
      searchHitToRow(sampleHit),
      searchHitToRow({
        ...sampleHit,
        entity: { ...sampleHit.entity, id: "evidence:2", evidence_type: "textbook", quality_score: 0.2 },
      }),
    ];
    const filters: EvidenceBrowserFilters = {
      query: "study",
      evidenceType: "rct",
      minQuality: 0.5,
      yearFrom: null,
      yearTo: null,
      status: "all",
    };
    expect(filterEvidenceRows(rows, filters)).toHaveLength(1);
  });

  it("sorts and paginates rows", () => {
    const rows = [
      searchHitToRow(sampleHit),
      searchHitToRow({
        ...sampleHit,
        entity: { ...sampleHit.entity, id: "evidence:2", label: "Beta Review" },
        score: 0.4,
      }),
    ];
    const sorted = sortEvidenceRows(rows, "label", "desc");
    expect(sorted[0].label).toBe("Study A");
    expect(paginateRows(sorted, 1, 1)).toHaveLength(1);
    expect(totalPages(3, 2)).toBe(2);
  });

  it("formats evidence type labels", () => {
    expect(formatEvidenceTypeLabel("meta_analysis")).toBe("Meta Analysis");
  });

  it("maps quality score to confidence level", () => {
    expect(qualityToConfidenceLevel(0.9)).toBe("high");
    expect(qualityToConfidenceLevel(0.5)).toBe("medium");
    expect(qualityToConfidenceLevel(0.1)).toBe("low");
  });
});
