"use client";

import { useMemo, useState } from "react";
import { Check, Loader2, Search, X } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import { useCuratorDrugClasses } from "@/lib/api/react-query/hooks";

interface DrugClassPickerProps {
  selectedIds: string[];
  module?: string | null;
  disabled?: boolean;
  onChange: (nextIds: string[], catalog: Array<{ id: string; slug: string; label: string }>) => void;
}

export function DrugClassPicker({
  selectedIds,
  module,
  disabled = false,
  onChange,
}: DrugClassPickerProps) {
  const [search, setSearch] = useState("");
  const query = useCuratorDrugClasses({ module: module || undefined });
  const rows = useMemo(() => query.data?.data ?? [], [query.data?.data]);
  const selectedSet = useMemo(() => new Set(selectedIds), [selectedIds]);

  const filtered = useMemo(() => {
    const q = search.trim().toLowerCase();
    if (!q) return rows;
    return rows.filter(
      (row) =>
        row.label.toLowerCase().includes(q) ||
        row.slug.toLowerCase().includes(q) ||
        row.id.toLowerCase().includes(q),
    );
  }, [rows, search]);

  const selectedRows = rows.filter((row) => selectedSet.has(row.id));
  const missingSelectedIds = selectedIds.filter((id) => !selectedRows.some((row) => row.id === id));

  function emit(nextIds: string[]) {
    onChange(
      nextIds,
      rows.map((row) => ({ id: row.id, slug: row.slug, label: row.label })),
    );
  }

  function toggle(entityId: string) {
    if (disabled) return;
    if (selectedSet.has(entityId)) {
      emit(selectedIds.filter((id) => id !== entityId));
      return;
    }
    emit([...selectedIds, entityId]);
  }

  function remove(entityId: string) {
    if (disabled) return;
    emit(selectedIds.filter((id) => id !== entityId));
  }

  return (
    <div className="space-y-4">
      <div className="space-y-1.5">
        <label className="text-sm font-medium text-muted-foreground" htmlFor="drug-class-picker-search">
          Drug classes
        </label>
        <div className="relative">
          <Search className="absolute left-3 top-2.5 h-4 w-4 text-muted-foreground" />
          <Input
            id="drug-class-picker-search"
            className="pl-9"
            placeholder="Search drug classes..."
            value={search}
            disabled={disabled}
            onChange={(event) => setSearch(event.target.value)}
          />
        </div>
        <p className="text-[0.8rem] text-muted-foreground">
          Select DrugClass nodes from the curator catalog. BELONGS_TO stores canonical class entity IDs.
        </p>
      </div>

      {selectedIds.length > 0 && (
        <div className="flex flex-wrap gap-2">
          {selectedRows.map((row) => (
            <Badge key={row.id} variant="secondary" className="gap-1.5">
              {row.label}
              <button type="button" onClick={() => remove(row.id)} aria-label={`Remove ${row.label}`}>
                <X className="h-3 w-3" />
              </button>
            </Badge>
          ))}
          {missingSelectedIds.map((id) => (
            <Badge key={id} variant="outline" className="gap-1.5 font-mono text-[10px]">
              {id}
              <button type="button" onClick={() => remove(id)} aria-label={`Remove ${id}`}>
                <X className="h-3 w-3" />
              </button>
            </Badge>
          ))}
        </div>
      )}

      <div className="rounded-md border">
        {query.isLoading ? (
          <p className="flex items-center gap-2 p-3 text-sm text-muted-foreground">
            <Loader2 className="h-4 w-4 animate-spin" />
            Loading drug classes...
          </p>
        ) : filtered.length === 0 ? (
          <p className="p-3 text-sm text-muted-foreground">No drug classes found.</p>
        ) : (
          <ul className="max-h-80 overflow-y-auto">
            {filtered.map((row) => {
              const selected = selectedSet.has(row.id);
              return (
                <li
                  key={row.id}
                  className="flex items-center justify-between gap-3 border-b p-3 last:border-b-0"
                >
                  <button
                    type="button"
                    className="flex min-w-0 flex-1 items-center gap-3 text-left"
                    disabled={disabled}
                    onClick={() => toggle(row.id)}
                  >
                    <span className="flex h-5 w-5 shrink-0 items-center justify-center rounded border">
                      {selected && <Check className="h-3.5 w-3.5" />}
                    </span>
                    <span className="min-w-0">
                      <span className="block truncate text-sm font-medium">{row.label}</span>
                      <span className="block truncate text-xs text-muted-foreground">
                        {row.slug} · <span className="font-mono">{row.id}</span>
                      </span>
                    </span>
                  </button>
                </li>
              );
            })}
          </ul>
        )}
      </div>
    </div>
  );
}
