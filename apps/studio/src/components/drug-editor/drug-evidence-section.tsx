"use client";

import { AlertTriangle, FileText, Link2, Loader2, Plus, Search, Unlink } from "lucide-react";
import { useCallback, useState } from "react";
import {
  ConfidenceBadge,
  EmptyState,
  ErrorState,
  EvidenceBadge,
  type EvidenceType,
} from "@/components/ui";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { SearchInput } from "@/components/ui/search-input";
import { Skeleton } from "@/components/ui/skeleton";
import { cn } from "@/lib/utils";
import {
  EVIDENCE_TYPE_OPTIONS,
  evidenceTypeLabel,
  formatQualityScore,
  isEvidenceAlreadyAttached,
} from "./evidence-helpers";
import type { CreateEvidenceInput, DrugEvidenceContext } from "./evidence-types";
import { useDrugEvidence } from "./use-drug-evidence";

export interface DrugEvidenceSectionProps extends DrugEvidenceContext {
  disabled?: boolean;
  className?: string;
}

function evidenceBadgeType(evidenceType: string): EvidenceType {
  if (evidenceType.includes("fda") || evidenceType.includes("rct") || evidenceType.includes("meta")) {
    return "primary";
  }
  if (evidenceType.includes("review") || evidenceType.includes("guideline")) {
    return "secondary";
  }
  if (evidenceType.includes("expert") || evidenceType.includes("textbook")) {
    return "tertiary";
  }
  return "secondary";
}

function SummaryMetric({
  label,
  value,
  hint,
}: {
  label: string;
  value: string | number;
  hint?: string;
}) {
  return (
    <div className="rounded-lg border bg-card/60 p-3">
      <p className="text-xs text-muted-foreground">{label}</p>
      <p className="text-lg font-semibold tabular-nums">{value}</p>
      {hint && <p className="mt-0.5 text-[11px] text-muted-foreground">{hint}</p>}
    </div>
  );
}

export function DrugEvidenceSection({
  drugId,
  entityId,
  slug,
  validation,
  disabled = false,
  className,
}: DrugEvidenceSectionProps) {
  const evidence = useDrugEvidence({ drugId, entityId, slug, validation });
  const [attachOpen, setAttachOpen] = useState(false);
  const [createOpen, setCreateOpen] = useState(false);
  const [searchQuery, setSearchQuery] = useState("");
  const [createForm, setCreateForm] = useState<CreateEvidenceInput>({
    title: "",
    evidence_type: "pubmed_article",
    quality_score: 0.5,
    year: null,
    extract: "",
  });

  const handleSearch = useCallback(async () => {
    if (!searchQuery.trim()) return;
    try {
      await evidence.searchEvidence(searchQuery.trim());
    } catch {
      // useDrugEvidence exposes the mutation error through actionError.
    }
  }, [evidence, searchQuery]);

  const handleAttach = useCallback(
    async (evidenceId: string) => {
      try {
        await evidence.attachEvidence(evidenceId);
        setAttachOpen(false);
        setSearchQuery("");
      } catch {
        // useDrugEvidence exposes the mutation error through actionError.
      }
    },
    [evidence],
  );

  const handleDetach = useCallback(
    async (evidenceId: string) => {
      try {
        await evidence.detachEvidence(evidenceId);
      } catch {
        // useDrugEvidence exposes the mutation error through actionError.
      }
    },
    [evidence],
  );

  const handleCreate = useCallback(async () => {
    if (!createForm.title.trim()) return;
    try {
      await evidence.createAndAttachEvidence({
        ...createForm,
        title: createForm.title.trim(),
        extract: createForm.extract?.trim() || null,
      });
      setCreateOpen(false);
      setCreateForm({
        title: "",
        evidence_type: "pubmed_article",
        quality_score: 0.5,
        year: null,
        extract: "",
      });
    } catch {
      // useDrugEvidence exposes the mutation error through actionError.
    }
  }, [createForm, evidence]);

  if (evidence.loading) {
    return (
      <div className={cn("space-y-4", className)}>
        <Skeleton className="h-8 w-48" />
        <div className="grid gap-3 sm:grid-cols-3">
          <Skeleton className="h-20" />
          <Skeleton className="h-20" />
          <Skeleton className="h-20" />
        </div>
        <Skeleton className="h-40" />
      </div>
    );
  }

  if (evidence.error) {
    return (
      <div className={cn("space-y-4", className)}>
        <div>
          <h2 className="text-lg font-semibold tracking-tight">Evidence</h2>
          <p className="mt-1 text-sm text-muted-foreground">
            Citations and provenance linked to this drug via the evidence API.
          </p>
        </div>
        <ErrorState
          title="Unable to load evidence"
          message={evidence.error}
          onRetry={() => void evidence.refetch()}
          retryLabel="Try again"
        />
      </div>
    );
  }

  return (
    <div className={cn("space-y-6", className)}>
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div>
          <h2 className="text-lg font-semibold tracking-tight">Evidence</h2>
          <p className="mt-1 text-sm text-muted-foreground">
            Attached citations, validation gaps, and evidence quality for this drug package.
          </p>
        </div>
        <div className="flex flex-wrap gap-2">
          <Button
            variant="outline"
            size="sm"
            disabled={disabled || evidence.isMutating}
            onClick={() => setAttachOpen(true)}
          >
            <Link2 className="h-4 w-4" />
            Attach existing
          </Button>
          <Button
            variant="default"
            size="sm"
            disabled={disabled || evidence.isMutating}
            onClick={() => setCreateOpen(true)}
          >
            <Plus className="h-4 w-4" />
            Create evidence
          </Button>
        </div>
      </div>

      <div className="grid gap-3 sm:grid-cols-3">
        <SummaryMetric label="Attached" value={evidence.summary.attachedCount} />
        <SummaryMetric
          label="Missing"
          value={evidence.summary.missingCount}
          hint={evidence.summary.missingCount > 0 ? "From validation dry-run" : "No gaps reported"}
        />
        <SummaryMetric
          label="Avg. quality"
          value={formatQualityScore(evidence.summary.averageQuality)}
          hint={
            evidence.summary.qualityLevel !== "none"
              ? `${evidence.summary.qualityLevel} confidence`
              : undefined
          }
        />
      </div>

      {evidence.actionError && (
        <div className="rounded-md border border-destructive/40 bg-destructive/5 px-3 py-2 text-sm text-destructive">
          {evidence.actionError}
        </div>
      )}

      <Card>
        <CardHeader className="pb-3">
          <CardTitle className="flex items-center gap-2 text-sm">
            <FileText className="h-4 w-4" />
            Attached evidence
          </CardTitle>
          <CardDescription>Evidence nodes linked to this drug through the public API.</CardDescription>
        </CardHeader>
        <CardContent>
          {evidence.attachments.length === 0 ? (
            <EmptyState
              title="No evidence attached"
              description="Attach an existing evidence record or create a new structural citation entry."
              actionLabel="Attach existing"
              onAction={() => setAttachOpen(true)}
              className="py-8"
            />
          ) : (
            <ul className="space-y-2">
              {evidence.attachments.map((attachment) => (
                <li
                  key={attachment.evidence_id}
                  className="flex flex-wrap items-start justify-between gap-3 rounded-lg border bg-muted/20 px-3 py-2.5"
                >
                  <div className="min-w-0 space-y-1">
                    <div className="flex flex-wrap items-center gap-2">
                      <p className="text-sm font-medium">{attachment.evidence.title}</p>
                      <EvidenceBadge
                        type={evidenceBadgeType(attachment.evidence.evidence_type)}
                        label={evidenceTypeLabel(attachment.evidence.evidence_type)}
                      />
                      <ConfidenceBadge
                        level={attachment.evidence.quality_score >= 0.8 ? "high" : attachment.evidence.quality_score >= 0.5 ? "medium" : "low"}
                        score={Math.round(attachment.evidence.quality_score * 100)}
                      />
                    </div>
                    <p className="font-mono text-[11px] text-muted-foreground">{attachment.evidence.id}</p>
                  </div>
                  <Button
                    variant="ghost"
                    size="sm"
                    disabled={disabled || evidence.isMutating}
                    onClick={() => void handleDetach(attachment.evidence_id)}
                  >
                    {evidence.isMutating ? (
                      <Loader2 className="h-4 w-4 animate-spin" />
                    ) : (
                      <Unlink className="h-4 w-4" />
                    )}
                    Detach
                  </Button>
                </li>
              ))}
            </ul>
          )}
        </CardContent>
      </Card>

      <Card>
        <CardHeader className="pb-3">
          <CardTitle className="flex items-center gap-2 text-sm">
            <AlertTriangle className="h-4 w-4" />
            Missing evidence
          </CardTitle>
          <CardDescription>Validation issues that reference missing or insufficient evidence.</CardDescription>
        </CardHeader>
        <CardContent>
          {evidence.missingRequirements.length === 0 ? (
            <p className="text-sm text-muted-foreground">
              No missing-evidence issues reported by the latest validation dry-run.
            </p>
          ) : (
            <ul className="space-y-2">
              {evidence.missingRequirements.map((requirement) => (
                <li
                  key={requirement.id}
                  className="rounded-md border border-amber-500/30 bg-amber-500/5 px-3 py-2 text-sm"
                >
                  <p>{requirement.message}</p>
                  {(requirement.field || requirement.relationship_type) && (
                    <p className="mt-1 font-mono text-[11px] text-muted-foreground">
                      {[requirement.field, requirement.relationship_type].filter(Boolean).join(" · ")}
                    </p>
                  )}
                </li>
              ))}
            </ul>
          )}
        </CardContent>
      </Card>

      <Dialog open={attachOpen} onOpenChange={setAttachOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Attach existing evidence</DialogTitle>
            <DialogDescription>Search the evidence catalog and link a record to this drug.</DialogDescription>
          </DialogHeader>
          <div className="space-y-3">
            <div className="flex gap-2">
              <SearchInput
                value={searchQuery}
                onChange={(event) => setSearchQuery(event.target.value)}
                placeholder="Search by title or ID"
                onKeyDown={(event) => {
                  if (event.key === "Enter") {
                    event.preventDefault();
                    void handleSearch();
                  }
                }}
              />
              <Button
                type="button"
                variant="secondary"
                disabled={evidence.searchPending || !searchQuery.trim()}
                onClick={() => void handleSearch()}
              >
                {evidence.searchPending ? (
                  <Loader2 className="h-4 w-4 animate-spin" />
                ) : (
                  <Search className="h-4 w-4" />
                )}
              </Button>
            </div>
            {evidence.searchResults.length === 0 ? (
              <p className="text-sm text-muted-foreground">Search to find evidence records to attach.</p>
            ) : (
              <ul className="max-h-64 space-y-2 overflow-auto">
                {evidence.searchResults.map((item) => {
                  const attached = isEvidenceAlreadyAttached(evidence.attachments, item.id);
                  return (
                    <li
                      key={item.id}
                      className="flex items-center justify-between gap-2 rounded-md border px-3 py-2"
                    >
                      <div className="min-w-0">
                        <p className="truncate text-sm font-medium">{item.title}</p>
                        <p className="font-mono text-[11px] text-muted-foreground">{item.id}</p>
                      </div>
                      <Button
                        size="sm"
                        variant="outline"
                        disabled={attached || evidence.isMutating}
                        onClick={() => void handleAttach(item.id)}
                      >
                        {attached ? "Attached" : "Attach"}
                      </Button>
                    </li>
                  );
                })}
              </ul>
            )}
          </div>
        </DialogContent>
      </Dialog>

      <Dialog open={createOpen} onOpenChange={setCreateOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Create evidence</DialogTitle>
            <DialogDescription>
              Create a structural evidence record and attach it to this drug. No biomedical assertions are inferred.
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-4">
            <div className="space-y-2">
              <Label htmlFor="evidence-title">Title</Label>
              <Input
                id="evidence-title"
                value={createForm.title}
                onChange={(event) => setCreateForm((current) => ({ ...current, title: event.target.value }))}
                placeholder="Citation or source title"
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="evidence-type">Evidence type</Label>
              <select
                id="evidence-type"
                className="flex h-9 w-full rounded-md border border-input bg-transparent px-3 py-1 text-sm shadow-sm"
                value={createForm.evidence_type}
                onChange={(event) =>
                  setCreateForm((current) => ({ ...current, evidence_type: event.target.value }))
                }
              >
                {EVIDENCE_TYPE_OPTIONS.map((option) => (
                  <option key={option.value} value={option.value}>
                    {option.label}
                  </option>
                ))}
              </select>
            </div>
            <div className="space-y-2">
              <Label htmlFor="evidence-quality">Quality score (0–1)</Label>
              <Input
                id="evidence-quality"
                type="number"
                min={0}
                max={1}
                step={0.05}
                value={createForm.quality_score}
                onChange={(event) =>
                  setCreateForm((current) => ({
                    ...current,
                    quality_score: Number(event.target.value),
                  }))
                }
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="evidence-year">Year (optional)</Label>
              <Input
                id="evidence-year"
                type="number"
                value={createForm.year ?? ""}
                onChange={(event) =>
                  setCreateForm((current) => ({
                    ...current,
                    year: event.target.value ? Number(event.target.value) : null,
                  }))
                }
              />
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setCreateOpen(false)}>
              Cancel
            </Button>
            <Button
              disabled={!createForm.title.trim() || evidence.isMutating}
              onClick={() => void handleCreate()}
            >
              {evidence.isMutating ? <Loader2 className="h-4 w-4 animate-spin" /> : "Create and attach"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
