"use client";

import { useMemo, useState } from "react";
import { Check, Loader2, Search, X } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import { useCuratorMechanismFragments } from "@/lib/api/react-query/hooks";
import type { MechanismFragmentRef } from "./mechanism-pathway";

interface MechanismPickerProps {
  selectedIds: string[];
  disabled?: boolean;
  onChange: (nextIds: string[], meta?: MechanismFragmentRef[]) => void;
}

export function MechanismPicker({ selectedIds, disabled = false, onChange }: MechanismPickerProps) {
  const [search, setSearch] = useState("");
  const query = useCuratorMechanismFragments({ search, limit: 80 });
  const rows = query.data?.data ?? [];
  const selectedSet = useMemo(() => new Set(selectedIds), [selectedIds]);
  const selectedRows = rows.filter((row) => selectedSet.has(row.entity_id));
  const missingSelectedIds = selectedIds.filter((id) => !selectedRows.some((row) => row.entity_id === id));

  function metaFor(ids: string[]): MechanismFragmentRef[] {
    return ids
      .map((id) => {
        const row = rows.find((entry) => entry.entity_id === id);
        if (!row) return { id };
        return {
          id: row.entity_id,
          slug: row.slug,
          label: row.label,
          description: row.description,
        };
      })
      .filter(Boolean);
  }

  function toggle(entityId: string) {
    if (disabled) return;
    const nextIds = selectedSet.has(entityId)
      ? selectedIds.filter((id) => id !== entityId)
      : [...selectedIds, entityId];
    onChange(nextIds, metaFor(nextIds));
  }

  function remove(entityId: string) {
    if (disabled) return;
    const nextIds = selectedIds.filter((id) => id !== entityId);
    onChange(nextIds, metaFor(nextIds));
  }

  return (
    <div className="space-y-4">
      <div className="space-y-1.5">
        <label className="text-sm font-medium text-muted-foreground" htmlFor="mechanism-picker-search">
          Mechanism roots
        </label>
        <div className="relative">
          <Search className="absolute left-3 top-2.5 h-4 w-4 text-muted-foreground" />
          <Input
            id="mechanism-picker-search"
            className="pl-9"
            placeholder="Search mechanism fragments..."
            value={search}
            disabled={disabled}
            onChange={(event) => setSearch(event.target.value)}
          />
        </div>
        <p className="text-[0.8rem] text-muted-foreground">
          Select MechanismFragment roots. Flat HAS_MECHANISM_ROOT edges are written into the package for
          publish.
        </p>
      </div>

      {selectedIds.length > 0 && (
        <div className="flex flex-wrap gap-2">
          {selectedRows.map((row) => (
            <Badge key={row.entity_id} variant="secondary" className="gap-1.5">
              {row.label}
              <button type="button" onClick={() => remove(row.entity_id)} aria-label={`Remove ${row.label}`}>
                <X className="h-3 w-3" />
              </button>
            </Badge>
          ))}
          {missingSelectedIds.map((id) => (
            <Badge key={id} variant="outline" className="gap-1.5">
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
            Loading mechanism fragments...
          </p>
        ) : rows.length === 0 ? (
          <p className="p-3 text-sm text-muted-foreground">No mechanism fragments found.</p>
        ) : (
          <ul className="max-h-80 overflow-y-auto">
            {rows.map((row) => {
              const selected = selectedSet.has(row.entity_id);
              return (
                <li
                  key={row.entity_id}
                  className="flex items-center justify-between gap-3 border-b p-3 last:border-b-0"
                >
                  <button
                    type="button"
                    className="flex min-w-0 flex-1 items-center gap-3 text-left"
                    disabled={disabled}
                    onClick={() => toggle(row.entity_id)}
                  >
                    <span className="flex h-5 w-5 shrink-0 items-center justify-center rounded border">
                      {selected && <Check className="h-3.5 w-3.5" />}
                    </span>
                    <span className="min-w-0">
                      <span className="block truncate text-sm font-medium">{row.label}</span>
                      <span className="block truncate text-xs text-muted-foreground">{row.slug}</span>
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
