"use client";

import { AlertTriangle, FileText, Loader2 } from "lucide-react";
import { ConfidenceBadge } from "@/components/ui";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { formatQualityScore } from "./evidence-helpers";
import type { DrugEvidenceContext } from "./evidence-types";
import { useDrugEvidence } from "./use-drug-evidence";

export interface DrugEvidencePanelProps extends DrugEvidenceContext {
  onOpenSection?: () => void;
  compact?: boolean;
  className?: string;
}

export function DrugEvidencePanel({
  drugId,
  entityId,
  slug,
  validation,
  onOpenSection,
  compact = false,
  className,
}: DrugEvidencePanelProps) {
  const evidence = useDrugEvidence({ drugId, entityId, slug, validation });

  return (
    <Card className={className}>
      <CardHeader className={compact ? "p-3 pb-2" : "pb-3"}>
        <CardTitle className="flex items-center gap-2 text-sm">
          <FileText className="h-4 w-4" />
          Evidence
        </CardTitle>
        {!compact && <CardDescription>Attached citations and validation gaps for this drug.</CardDescription>}
      </CardHeader>
      <CardContent className={compact ? "space-y-2 p-3 pt-0" : "space-y-3"}>
        {evidence.loading ? (
          <div className="flex items-center gap-2 text-sm text-muted-foreground">
            <Loader2 className="h-4 w-4 animate-spin" />
            Loading evidence…
          </div>
        ) : evidence.error ? (
          <p className="text-sm text-destructive">{evidence.error}</p>
        ) : (
          <>
            <div className="grid grid-cols-2 gap-2 text-sm">
              <div className="rounded-md border bg-muted/30 px-2.5 py-2">
                <p className="text-[11px] text-muted-foreground">Attached</p>
                <p className="font-medium tabular-nums">{evidence.summary.attachedCount}</p>
              </div>
              <div className="rounded-md border bg-muted/30 px-2.5 py-2">
                <p className="text-[11px] text-muted-foreground">Missing</p>
                <p className="font-medium tabular-nums">{evidence.summary.missingCount}</p>
              </div>
            </div>

            <div className="flex items-center justify-between gap-2 text-sm">
              <span className="text-muted-foreground">Quality</span>
              {evidence.summary.qualityLevel === "none" ? (
                <span className="text-muted-foreground">No attachments</span>
              ) : (
                <ConfidenceBadge
                  level={evidence.summary.qualityLevel}
                  score={
                    evidence.summary.averageQuality !== null
                      ? Math.round(evidence.summary.averageQuality * 100)
                      : undefined
                  }
                />
              )}
            </div>

            {!compact && (
              <p className="text-xs text-muted-foreground">
                Average score: {formatQualityScore(evidence.summary.averageQuality)}
                {evidence.summary.lowQualityCount > 0
                  ? ` · ${evidence.summary.lowQualityCount} low-quality attachment${evidence.summary.lowQualityCount === 1 ? "" : "s"}`
                  : ""}
              </p>
            )}

            {evidence.summary.missingCount > 0 && (
              <div className="flex items-start gap-2 rounded-md border border-amber-500/30 bg-amber-500/5 px-2.5 py-2 text-xs text-amber-700 dark:text-amber-300">
                <AlertTriangle className="mt-0.5 h-3.5 w-3.5 shrink-0" />
                <span>
                  {evidence.summary.missingCount} missing-evidence issue
                  {evidence.summary.missingCount === 1 ? "" : "s"} from validation.
                </span>
              </div>
            )}
          </>
        )}

        {onOpenSection && (
          <Button variant="outline" size="sm" className="w-full" onClick={onOpenSection}>
            Open evidence section
          </Button>
        )}
      </CardContent>
    </Card>
  );
}
