"use client";

import { useRouter } from "next/navigation";
import { ArrowDown, ArrowUp, ArrowUpDown } from "lucide-react";
import Link from "next/link";
import { Badge } from "@/components/ui/badge";
import { ConfidenceBadge } from "@/components/ui/confidence-badge";
import { StatusBadge } from "@/components/ui/status-badge";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { ValidationBadge } from "@/components/ui/validation-badge";
import type { SortDirection, SortField } from "./types";
import type { DrugBrowserRow } from "./types";
import { DrugRowActions } from "./drug-row-actions";
import { drugEditorHref } from "./utils";

interface DrugTableProps {
  rows: DrugBrowserRow[];
  sortField: SortField;
  sortDirection: SortDirection;
  onSort: (field: SortField) => void;
}

function SortIcon({ field, activeField, direction }: { field: SortField; activeField: SortField; direction: SortDirection }) {
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
  field: SortField;
  activeField: SortField;
  direction: SortDirection;
  onSort: (field: SortField) => void;
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

function workflowStatusValue(row: DrugBrowserRow): "draft" | "processing" | "active" | "inactive" {
  if (row.workflowState === "draft") return "draft";
  if (row.workflowState === "review") return "processing";
  if (row.status === "published" || row.curriculumStatus === "published") return "active";
  return "inactive";
}

export function DrugTable({ rows, sortField, sortDirection, onSort }: DrugTableProps) {
  const router = useRouter();

  function openDrugEditor(slug: string) {
    router.push(`/knowledge/drugs/${slug}`);
  }

  return (
    <Table>
      <TableHeader>
        <TableRow>
          <SortableHeader
            label="Drug"
            field="label"
            activeField={sortField}
            direction={sortDirection}
            onSort={onSort}
          />
          <SortableHeader
            label="Slug"
            field="slug"
            activeField={sortField}
            direction={sortDirection}
            onSort={onSort}
          />
          <SortableHeader
            label="Module"
            field="module"
            activeField={sortField}
            direction={sortDirection}
            onSort={onSort}
          />
          <SortableHeader
            label="Status"
            field="status"
            activeField={sortField}
            direction={sortDirection}
            onSort={onSort}
          />
          <SortableHeader
            label="Confidence"
            field="confidence"
            activeField={sortField}
            direction={sortDirection}
            onSort={onSort}
          />
          <TableHead>Validation</TableHead>
          <TableHead className="w-[4rem] text-right">Actions</TableHead>
        </TableRow>
      </TableHeader>
      <TableBody>
        {rows.map((row) => (
          <TableRow
            key={`${row.source}-${row.slug}`}
            className="cursor-pointer hover:bg-muted/50"
            tabIndex={0}
            role="link"
            aria-label={`Open drug editor for ${row.label}`}
            onClick={() => openDrugEditor(row.slug)}
            onKeyDown={(event) => {
              if (event.key === "Enter" || event.key === " ") {
                event.preventDefault();
                openDrugEditor(row.slug);
              }
            }}
          >
            <TableCell>
              <Link
                href={drugEditorHref(row.slug)}
                className="font-medium hover:text-primary hover:underline"
              >
                {row.label}
              </Link>
              {row.source === "curriculum" && (
                <p className="text-xs text-muted-foreground">Curriculum queue</p>
              )}
            </TableCell>
            <TableCell>
              <Link href={drugEditorHref(row.slug)} className="hover:text-primary">
                <code className="rounded bg-muted px-1.5 py-0.5 text-xs hover:bg-muted/80">
                  {row.slug}
                </code>
              </Link>
            </TableCell>
            <TableCell className="text-muted-foreground">{row.module ?? "—"}</TableCell>
            <TableCell>
              <StatusBadge
                status={workflowStatusValue(row)}
                label={
                  row.workflowState
                    ? row.workflowState
                    : row.curriculumStatus ?? row.status
                }
              />
            </TableCell>
            <TableCell>
              {row.confidenceLevel ? (
                <ConfidenceBadge
                  level={row.confidenceLevel}
                  score={
                    row.confidenceScore !== null
                      ? Math.round(row.confidenceScore * 100)
                      : undefined
                  }
                />
              ) : (
                <Badge variant="muted">—</Badge>
              )}
            </TableCell>
            <TableCell>
              <ValidationBadge status={row.validationStatus} />
            </TableCell>
            <TableCell className="text-right" onClick={(event) => event.stopPropagation()}>
              <DrugRowActions row={row} />
            </TableCell>
          </TableRow>
        ))}
      </TableBody>
    </Table>
  );
}
