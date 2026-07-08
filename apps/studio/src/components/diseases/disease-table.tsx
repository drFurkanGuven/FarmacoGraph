"use client";

import { useRouter } from "next/navigation";
import Link from "next/link";
import { ArrowDown, ArrowUp, ArrowUpDown } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { ValidationBadge } from "@/components/ui/validation-badge";
import type { DiseaseBrowseItem, DiseaseSortDirection, DiseaseSortField } from "./types";

interface DiseaseTableProps {
  rows: DiseaseBrowseItem[];
  sortField: DiseaseSortField;
  sortDirection: DiseaseSortDirection;
  onSort: (field: DiseaseSortField) => void;
}

function SortIcon({
  field,
  activeField,
  direction,
}: {
  field: DiseaseSortField;
  activeField: DiseaseSortField;
  direction: DiseaseSortDirection;
}) {
  if (field !== activeField) return <ArrowUpDown className="h-3.5 w-3.5 opacity-40" />;
  return direction === "asc" ? <ArrowUp className="h-3.5 w-3.5" /> : <ArrowDown className="h-3.5 w-3.5" />;
}

export function DiseaseTable({ rows, sortField, sortDirection, onSort }: DiseaseTableProps) {
  const router = useRouter();

  function openEditor(slug: string) {
    router.push(`/knowledge/diseases/${slug}`);
  }

  return (
    <Table>
      <TableHeader>
        <TableRow>
          <TableHead>
            <button type="button" className="inline-flex items-center gap-1.5" onClick={() => onSort("label")}>
              Disease <SortIcon field="label" activeField={sortField} direction={sortDirection} />
            </button>
          </TableHead>
          <TableHead>
            <button type="button" className="inline-flex items-center gap-1.5" onClick={() => onSort("slug")}>
              Slug <SortIcon field="slug" activeField={sortField} direction={sortDirection} />
            </button>
          </TableHead>
          <TableHead>Workflow</TableHead>
          <TableHead>Validation</TableHead>
        </TableRow>
      </TableHeader>
      <TableBody>
        {rows.map((row) => (
          <TableRow
            key={row.slug}
            className="cursor-pointer hover:bg-muted/50"
            onClick={() => openEditor(row.slug)}
          >
            <TableCell>
              <Link href={`/knowledge/diseases/${row.slug}`} className="font-medium hover:underline">
                {row.label}
              </Link>
            </TableCell>
            <TableCell>
              <code className="rounded bg-muted px-1.5 py-0.5 text-xs">{row.slug}</code>
            </TableCell>
            <TableCell>
              {row.workflow_state ? (
                <Badge variant="outline">{row.workflow_state}</Badge>
              ) : (
                <Badge variant="muted">no workflow</Badge>
              )}
            </TableCell>
            <TableCell>
              <ValidationBadge
                status={
                  row.validation_valid === true
                    ? "valid"
                    : row.validation_errors
                      ? "invalid"
                      : "pending"
                }
              />
            </TableCell>
          </TableRow>
        ))}
      </TableBody>
    </Table>
  );
}
