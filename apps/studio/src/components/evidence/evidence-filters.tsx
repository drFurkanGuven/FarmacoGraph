"use client";

import { Filter, Plus, RotateCcw } from "lucide-react";
import { Button } from "@/components/ui/button";
import { SearchInput } from "@/components/ui/search-input";
import { ONTOLOGY_EVIDENCE_TYPES } from "@/lib/api/evidence";
import type { EvidenceBrowserFilters } from "./types";
import { formatEvidenceTypeLabel } from "./utils";

interface EvidenceFiltersProps {
  filters: EvidenceBrowserFilters;
  onChange: (patch: Partial<EvidenceBrowserFilters>) => void;
  onReset: () => void;
  onCreate: () => void;
  totalItems: number;
  evidenceCount: number | null;
  isSearching: boolean;
  isIdLookup: boolean;
}

function FilterSelect<T extends string>({
  label,
  value,
  options,
  onChange,
}: {
  label: string;
  value: T;
  options: { value: T; label: string }[];
  onChange: (value: T) => void;
}) {
  return (
    <label className="flex flex-col gap-1 text-xs">
      <span className="font-medium text-muted-foreground">{label}</span>
      <select
        className="h-9 rounded-md border border-input bg-background px-3 text-sm shadow-sm focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-ring"
        value={value}
        onChange={(event) => onChange(event.target.value as T)}
        aria-label={label}
      >
        {options.map((option) => (
          <option key={option.value} value={option.value}>
            {option.label}
          </option>
        ))}
      </select>
    </label>
  );
}

const STATUS_OPTIONS: { value: EvidenceBrowserFilters["status"]; label: string }[] = [
  { value: "all", label: "All statuses" },
  { value: "published", label: "Published" },
  { value: "approved", label: "Approved" },
  { value: "review", label: "In review" },
  { value: "draft", label: "Draft" },
  { value: "deprecated", label: "Deprecated" },
];

export function EvidenceFilters({
  filters,
  onChange,
  onReset,
  onCreate,
  totalItems,
  evidenceCount,
  isSearching,
  isIdLookup,
}: EvidenceFiltersProps) {
  const typeOptions = [
    { value: "all" as const, label: "All types" },
    ...ONTOLOGY_EVIDENCE_TYPES.map((type) => ({
      value: type,
      label: formatEvidenceTypeLabel(type),
    })),
  ];

  return (
    <div className="space-y-4">
      <div className="flex flex-col gap-3 lg:flex-row lg:items-end lg:justify-between">
        <div className="flex-1">
          <SearchInput
            value={filters.query}
            onChange={(event) => onChange({ query: event.target.value })}
            onClear={() => onChange({ query: "" })}
            placeholder="Search evidence (min 2 chars) or paste evidence UUID…"
            aria-label="Search evidence"
            containerClassName="max-w-xl"
          />
          {isSearching && (
            <p className="mt-1 text-xs text-muted-foreground">
              Search results from GET /search?types=evidence
            </p>
          )}
          {isIdLookup && (
            <p className="mt-1 text-xs text-muted-foreground">Direct lookup via GET /evidence/{"{id}"}</p>
          )}
          {evidenceCount !== null && (
            <p className="mt-1 text-xs text-muted-foreground">
              Dataset contains {evidenceCount} evidence {evidenceCount === 1 ? "node" : "nodes"} (GET /statistics)
            </p>
          )}
        </div>
        <div className="flex flex-wrap items-center gap-2">
          <div className="flex items-center gap-2 text-sm text-muted-foreground">
            <Filter className="h-4 w-4" />
            <span>
              {totalItems} {totalItems === 1 ? "result" : "results"}
            </span>
            <Button variant="ghost" size="sm" onClick={onReset}>
              <RotateCcw className="h-3.5 w-3.5" />
              Reset
            </Button>
          </div>
          <Button size="sm" onClick={onCreate}>
            <Plus className="h-4 w-4" />
            New evidence
          </Button>
        </div>
      </div>

      <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
        <FilterSelect
          label="Evidence type"
          value={filters.evidenceType}
          options={typeOptions}
          onChange={(evidenceType) => onChange({ evidenceType })}
        />
        <FilterSelect
          label="Status"
          value={filters.status}
          options={STATUS_OPTIONS}
          onChange={(status) => onChange({ status })}
        />
        <label className="flex flex-col gap-1 text-xs">
          <span className="font-medium text-muted-foreground">Min quality (0–1)</span>
          <input
            type="number"
            min={0}
            max={1}
            step={0.05}
            className="h-9 rounded-md border border-input bg-background px-3 text-sm shadow-sm focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-ring"
            value={filters.minQuality ?? ""}
            onChange={(event) =>
              onChange({
                minQuality: event.target.value === "" ? null : Number(event.target.value),
              })
            }
            aria-label="Minimum quality score"
          />
        </label>
        <div className="grid grid-cols-2 gap-2">
          <label className="flex flex-col gap-1 text-xs">
            <span className="font-medium text-muted-foreground">Year from</span>
            <input
              type="number"
              className="h-9 rounded-md border border-input bg-background px-3 text-sm shadow-sm focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-ring"
              value={filters.yearFrom ?? ""}
              onChange={(event) =>
                onChange({
                  yearFrom: event.target.value === "" ? null : Number(event.target.value),
                })
              }
              aria-label="Year from"
            />
          </label>
          <label className="flex flex-col gap-1 text-xs">
            <span className="font-medium text-muted-foreground">Year to</span>
            <input
              type="number"
              className="h-9 rounded-md border border-input bg-background px-3 text-sm shadow-sm focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-ring"
              value={filters.yearTo ?? ""}
              onChange={(event) =>
                onChange({
                  yearTo: event.target.value === "" ? null : Number(event.target.value),
                })
              }
              aria-label="Year to"
            />
          </label>
        </div>
      </div>
    </div>
  );
}
