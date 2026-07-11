"use client";

import { ArrowUpDown, Filter, RotateCcw } from "lucide-react";
import { Button } from "@/components/ui/button";
import { SearchInput } from "@/components/ui/search-input";
import type { ModuleItem } from "@/lib/api/types";
import type { DrugBrowserFilters } from "./types";

interface DrugFiltersProps {
  filters: DrugBrowserFilters;
  modules: ModuleItem[];
  onChange: (patch: Partial<DrugBrowserFilters>) => void;
  onReset: () => void;
  isSearching: boolean;
  totalItems: number;
}

const STATUS_OPTIONS: { value: DrugBrowserFilters["status"]; label: string }[] = [
  { value: "all", label: "All statuses" },
  { value: "published", label: "Published" },
  { value: "pending", label: "Curriculum pending" },
  { value: "draft", label: "Draft workflow" },
  { value: "review", label: "In review" },
];

const VALIDATION_OPTIONS: { value: DrugBrowserFilters["validation"]; label: string }[] = [
  { value: "all", label: "All validation" },
  { value: "valid", label: "Valid" },
  { value: "pending", label: "Pending" },
  { value: "invalid", label: "Invalid" },
];

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

export function DrugFilters({
  filters,
  modules,
  onChange,
  onReset,
  isSearching,
  totalItems,
}: DrugFiltersProps) {
  const moduleOptions = [
    { value: "all" as const, label: "All modules" },
    ...modules.map((module) => ({
      value: module.slug,
      label: `${module.name} (${module.drug_count})`,
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
            placeholder="Search drugs by name or slug (min 2 characters)…"
            aria-label="Search drugs"
            containerClassName="max-w-xl"
          />
          {isSearching && (
            <p className="mt-1 text-xs text-muted-foreground">
              Showing search results from the curator drug browser.
            </p>
          )}
        </div>
        <div className="flex items-center gap-2 text-sm text-muted-foreground">
          <Filter className="h-4 w-4" />
          <span>
            {totalItems} {totalItems === 1 ? "drug" : "drugs"}
          </span>
          <Button variant="ghost" size="sm" onClick={onReset}>
            <RotateCcw className="h-3.5 w-3.5" />
            Reset
          </Button>
        </div>
      </div>

      <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
        <FilterSelect
          label="Module"
          value={filters.module}
          options={moduleOptions}
          onChange={(module) => onChange({ module })}
        />
        <FilterSelect
          label="Status"
          value={filters.status}
          options={STATUS_OPTIONS}
          onChange={(status) => onChange({ status })}
        />
        <FilterSelect
          label="Validation"
          value={filters.validation}
          options={VALIDATION_OPTIONS}
          onChange={(validation) => onChange({ validation })}
        />
        <div className="flex flex-col justify-end">
          <div className="flex h-9 items-center gap-2 rounded-md border border-dashed px-3 text-xs text-muted-foreground">
            <ArrowUpDown className="h-3.5 w-3.5" />
            Click column headers to sort
          </div>
        </div>
      </div>
    </div>
  );
}
