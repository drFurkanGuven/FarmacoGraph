"use client";

import { ArrowDown, ArrowUp, ArrowUpDown, Pencil } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { ConfidenceBadge } from "@/components/ui/confidence-badge";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { StatusBadge } from "@/components/ui/status-badge";
import { EvidenceTypeBadge } from "./evidence-type-badge";
import type { EvidenceBrowserRow, EvidenceSortField, SortDirection } from "./types";
import { qualityToConfidenceLevel } from "./utils";

interface EvidenceTableProps {
  rows: EvidenceBrowserRow[];
  sortField: EvidenceSortField;
  sortDirection: SortDirection;
  onSort: (field: EvidenceSortField) => void;
  onOpen: (id: string) => void;
  onEdit: (id: string) => void;
}

function SortIcon({
  field,
  activeField,
  direction,
}: {
  field: EvidenceSortField;
  activeField: EvidenceSortField;
  direction: SortDirection;
}) {
  if (field !== activeField) return <ArrowUpDown className="h-3.5 w-3.5 opacity-40" />;
  return direction === "asc" ? <ArrowUp className="h-3.5 w-3.5" /> : <ArrowDown className="h-3.5 w-3.5" />;
}

function SortableHeader({
  label,
  field,
  activeField,
  direction,
  onSort,
}: {
  label: string;
  field: EvidenceSortField;
  activeField: EvidenceSortField;
  direction: SortDirection;
  onSort: (field: EvidenceSortField) => void;
}) {
  return (
    <TableHead>
      <button
        type="button"
        className="inline-flex items-center gap-1.5 hover:text-foreground"
        onClick={() => onSort(field)}
      >
        {label}
        <SortIcon field={field} activeField={activeField} direction={direction} />
      </button>
    </TableHead>
  );
}

function statusVariant(status: string | null): "active" | "draft" | "processing" | "inactive" {
  switch (status) {
    case "published":
      return "active";
    case "draft":
      return "draft";
    case "review":
      return "processing";
    default:
      return "inactive";
  }
}

export function EvidenceTable({
  rows,
  sortField,
  sortDirection,
  onSort,
  onOpen,
  onEdit,
}: EvidenceTableProps) {
  return (
    <Table>
      <TableHeader>
        <TableRow>
          <SortableHeader
            label="Title"
            field="label"
            activeField={sortField}
            direction={sortDirection}
            onSort={onSort}
          />
          <SortableHeader
            label="Type"
            field="evidenceType"
            activeField={sortField}
            direction={sortDirection}
            onSort={onSort}
          />
          <SortableHeader
            label="Year"
            field="year"
            activeField={sortField}
            direction={sortDirection}
            onSort={onSort}
          />
          <SortableHeader
            label="Quality"
            field="qualityScore"
            activeField={sortField}
            direction={sortDirection}
            onSort={onSort}
          />
          <TableHead>Status</TableHead>
          <SortableHeader
            label="Score"
            field="score"
            activeField={sortField}
            direction={sortDirection}
            onSort={onSort}
          />
          <TableHead className="w-[5rem] text-right">Actions</TableHead>
        </TableRow>
      </TableHeader>
      <TableBody>
        {rows.map((row) => {
          const confidence = qualityToConfidenceLevel(row.qualityScore);
          return (
            <TableRow
              key={row.id}
              className="cursor-pointer hover:bg-muted/50"
              tabIndex={0}
              role="button"
              aria-label={`Open evidence ${row.label}`}
              onClick={() => onOpen(row.id)}
              onKeyDown={(event) => {
                if (event.key === "Enter" || event.key === " ") {
                  event.preventDefault();
                  onOpen(row.id);
                }
              }}
            >
              <TableCell>
                <p className="font-medium">{row.label}</p>
                {row.snippet && <p className="mt-1 line-clamp-2 text-xs text-muted-foreground">{row.snippet}</p>}
                <code className="mt-1 inline-block rounded bg-muted px-1.5 py-0.5 text-[10px] text-muted-foreground">
                  {row.id}
                </code>
              </TableCell>
              <TableCell>
                <EvidenceTypeBadge type={row.evidenceType} />
              </TableCell>
              <TableCell className="tabular-nums text-muted-foreground">{row.year ?? "—"}</TableCell>
              <TableCell>
                {confidence ? (
                  <ConfidenceBadge
                    level={confidence}
                    score={row.qualityScore !== null ? Math.round(row.qualityScore * 100) : undefined}
                  />
                ) : (
                  <Badge variant="muted">—</Badge>
                )}
              </TableCell>
              <TableCell>
                {row.status ? (
                  <StatusBadge status={statusVariant(row.status)} label={row.status} />
                ) : (
                  <Badge variant="muted">—</Badge>
                )}
              </TableCell>
              <TableCell className="tabular-nums text-muted-foreground">
                {row.searchScore !== null ? row.searchScore.toFixed(2) : "—"}
              </TableCell>
              <TableCell className="text-right" onClick={(event) => event.stopPropagation()}>
                <Button variant="ghost" size="sm" aria-label={`Edit ${row.label}`} onClick={() => onEdit(row.id)}>
                  <Pencil className="h-4 w-4" />
                </Button>
              </TableCell>
            </TableRow>
          );
        })}
      </TableBody>
    </Table>
  );
}
