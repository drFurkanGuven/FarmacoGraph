"use client";

import { FileText, Loader2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Label } from "@/components/ui/label";
import { cn } from "@/lib/utils";
import type { DrugEvidenceAttachment } from "./evidence-types";

export interface TreatsIndicationEvidenceProps {
  selectedIds: string[];
  attachments: DrugEvidenceAttachment[];
  loading?: boolean;
  disabled?: boolean;
  onChange: (evidenceIds: string[]) => void;
}

export function TreatsIndicationEvidence({
  selectedIds,
  attachments,
  loading = false,
  disabled = false,
  onChange,
}: TreatsIndicationEvidenceProps) {
  const selected = new Set(selectedIds);

  function toggleEvidence(evidenceId: string) {
    if (disabled) return;
    const next = new Set(selected);
    if (next.has(evidenceId)) {
      next.delete(evidenceId);
    } else {
      next.add(evidenceId);
    }
    onChange([...next]);
  }

  return (
    <div className="space-y-2">
      <Label>Supporting evidence (optional for expert consensus + attestation)</Label>
      <p className="text-xs text-muted-foreground">
        Link citations already attached to this drug. Selected records are written to the TREATS edge as
        evidence_ids and mirrored as SUPPORTED_BY rows for publish validation (FG-C012).
      </p>

      {loading ? (
        <div className="flex items-center gap-2 rounded-md border border-dashed px-3 py-4 text-sm text-muted-foreground">
          <Loader2 className="h-4 w-4 animate-spin" />
          Loading attached evidence…
        </div>
      ) : attachments.length === 0 ? (
        <div className="rounded-md border border-dashed px-3 py-4 text-sm text-muted-foreground">
          No evidence attached to this drug yet. Attach records in the Evidence section, then return here to
          link them to this indication.
        </div>
      ) : (
        <ul className="space-y-2">
          {attachments.map((attachment) => {
            const evidenceId = attachment.evidence_id;
            const isSelected = selected.has(evidenceId);
            return (
              <li key={evidenceId}>
                <Button
                  type="button"
                  variant={isSelected ? "secondary" : "outline"}
                  disabled={disabled}
                  onClick={() => toggleEvidence(evidenceId)}
                  className={cn(
                    "h-auto w-full justify-start gap-3 px-3 py-2 text-left font-normal",
                    isSelected && "border-primary/40",
                  )}
                >
                  <FileText className="h-4 w-4 shrink-0 text-muted-foreground" />
                  <span className="min-w-0 flex-1">
                    <span className="block truncate text-sm font-medium">{attachment.evidence.title}</span>
                    <span className="block truncate text-xs text-muted-foreground">
                      {attachment.evidence.evidence_type}
                      {attachment.evidence.year ? ` · ${attachment.evidence.year}` : ""}
                    </span>
                  </span>
                  <span className="text-xs tabular-nums text-muted-foreground">
                    {Math.round(attachment.evidence.quality_score * 100)}%
                  </span>
                </Button>
              </li>
            );
          })}
        </ul>
      )}
    </div>
  );
}
