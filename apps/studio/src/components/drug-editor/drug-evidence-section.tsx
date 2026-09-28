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
import { useLanguage } from "@/lib/i18n/context";
import { getConstraintHint } from "@/lib/i18n/dictionaries";
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
  /** TREATS disease options for linking a newly created record to an indication. */
  treatsOptions?: Array<{ id: string; label: string }>;
  /** Called after create+attach when the curator linked the record to an indication. */
  onLinkToIndication?: (evidenceId: string, diseaseId: string) => void;
}

function evidenceBadgeType(evidenceType: string): EvidenceType {
  if (
    evidenceType.includes("fda") ||
    evidenceType.includes("rct") ||
    evidenceType.includes("meta")
  ) {
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
  treatsOptions = [],
  onLinkToIndication,
}: DrugEvidenceSectionProps) {
  const { t, locale } = useLanguage();
  const evidence = useDrugEvidence({ drugId, entityId, slug, validation });
  const [attachOpen, setAttachOpen] = useState(false);
  const [createOpen, setCreateOpen] = useState(false);
  const [searchQuery, setSearchQuery] = useState("");
  const [createForm, setCreateForm] = useState<CreateEvidenceInput>({
    title: "",
    evidence_type: "pubmed_article",
    quality_score: 0.5,
    year: null,
    authors: [],
    journal: null,
    supports_claim: null,
    extract: "",
  });
  const [linkDiseaseId, setLinkDiseaseId] = useState("");

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
    [evidence]
  );

  const handleDetach = useCallback(
    async (evidenceId: string) => {
      try {
        await evidence.detachEvidence(evidenceId);
      } catch {
        // useDrugEvidence exposes the mutation error through actionError.
      }
    },
    [evidence]
  );

  const handleCreate = useCallback(async () => {
    if (!createForm.title.trim()) return;
    try {
      const created = await evidence.createAndAttachEvidence({
        ...createForm,
        title: createForm.title.trim(),
        authors: createForm.authors?.filter(Boolean) ?? [],
        journal: createForm.journal?.trim() || null,
        supports_claim: createForm.supports_claim?.trim() || null,
        extract: createForm.extract?.trim() || null,
      });
      if (linkDiseaseId && onLinkToIndication) {
        onLinkToIndication(created.id, linkDiseaseId);
      }
      setCreateOpen(false);
      setCreateForm({
        title: "",
        evidence_type: "pubmed_article",
        quality_score: 0.5,
        year: null,
        authors: [],
        journal: null,
        supports_claim: null,
        extract: "",
      });
      setLinkDiseaseId("");
    } catch {
      // useDrugEvidence exposes the mutation error through actionError.
    }
  }, [createForm, evidence, linkDiseaseId, onLinkToIndication]);

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
          <h2 className="text-lg font-semibold tracking-tight">
            {t("evidence.title", "Evidence")}
          </h2>
          <p className="mt-1 text-sm text-muted-foreground">
            {t(
              "evidence.subtitle",
              "Citations and provenance linked to this drug via the evidence API."
            )}
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
          <h2 className="text-lg font-semibold tracking-tight">
            {t("evidence.title", "Evidence")}
          </h2>
          <p className="mt-1 text-sm text-muted-foreground">
            {t(
              "evidence.subtitle",
              "Attached citations, validation gaps, and evidence quality for this drug package."
            )}
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
            {t("evidence.attachExisting", "Attach existing")}
          </Button>
          <Button
            variant="default"
            size="sm"
            disabled={disabled || evidence.isMutating}
            onClick={() => setCreateOpen(true)}
          >
            <Plus className="h-4 w-4" />
            {t("evidence.createEvidence", "Create evidence")}
          </Button>
        </div>
      </div>

      <div className="grid gap-3 sm:grid-cols-3">
        <SummaryMetric
          label={t("evidence.attached", "Attached")}
          value={evidence.summary.attachedCount}
        />
        <SummaryMetric
          label={t("evidence.missing", "Missing")}
          value={evidence.summary.missingCount}
          hint={
            evidence.summary.missingCount > 0
              ? t("evidence.missingHintSome", "From validation dry-run")
              : t("evidence.missingHintNone", "No gaps reported")
          }
        />
        <SummaryMetric
          label={t("evidence.avgQuality", "Avg. quality")}
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
            {t("evidence.attachedEvidence", "Attached evidence")}
          </CardTitle>
          <CardDescription>
            {t(
              "evidence.attachedEvidenceHint",
              "Evidence nodes linked to this drug through the public API."
            )}
          </CardDescription>
        </CardHeader>
        <CardContent>
          {evidence.attachments.length === 0 ? (
            <EmptyState
              title={t("evidence.noEvidence", "No evidence attached")}
              description={t(
                "evidence.noEvidenceHint",
                "Attach an existing evidence record or create a new structural citation entry."
              )}
              actionLabel={t("evidence.attachExisting", "Attach existing")}
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
                        level={
                          attachment.evidence.quality_score >= 0.8
                            ? "high"
                            : attachment.evidence.quality_score >= 0.5
                              ? "medium"
                              : "low"
                        }
                        score={Math.round(attachment.evidence.quality_score * 100)}
                      />
                    </div>
                    <p className="font-mono text-[11px] text-muted-foreground">
                      {attachment.evidence.id}
                    </p>
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
            {t("evidence.missingEvidence", "Missing evidence")}
          </CardTitle>
          <CardDescription>
            {t(
              "evidence.missingEvidenceHint",
              "Validation issues that reference missing or insufficient evidence."
            )}
          </CardDescription>
        </CardHeader>
        <CardContent>
          {evidence.missingRequirements.length === 0 ? (
            <p className="text-sm text-muted-foreground">
              {t(
                "evidence.noMissing",
                "No missing-evidence issues reported by the latest validation dry-run."
              )}
            </p>
          ) : (
            <ul className="space-y-2">
              {evidence.missingRequirements.map((requirement) => {
                const hint = getConstraintHint(requirement.constraint_id, locale);
                return (
                  <li
                    key={requirement.id}
                    className="rounded-md border border-amber-500/30 bg-amber-500/5 px-3 py-2 text-sm"
                  >
                    <p>{requirement.message}</p>
                    {hint && (
                      <p className="mt-1 text-xs text-amber-800 dark:text-amber-200">{hint}</p>
                    )}
                    {(requirement.field || requirement.relationship_type) && (
                      <p className="mt-1 font-mono text-[11px] text-muted-foreground">
                        {[requirement.field, requirement.relationship_type]
                          .filter(Boolean)
                          .join(" · ")}
                      </p>
                    )}
                  </li>
                );
              })}
            </ul>
          )}
        </CardContent>
      </Card>

      <Dialog open={attachOpen} onOpenChange={setAttachOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>{t("evidence.searchTitle", "Attach existing evidence")}</DialogTitle>
            <DialogDescription>
              {t(
                "evidence.searchHint",
                "Search the evidence catalog and link a record to this drug."
              )}
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-3">
            <div className="flex gap-2">
              <SearchInput
                value={searchQuery}
                onChange={(event) => setSearchQuery(event.target.value)}
                placeholder={t("evidence.searchPlaceholder", "Search by title or ID")}
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
              <p className="text-sm text-muted-foreground">
                {t("evidence.searchEmpty", "Search to find evidence records to attach.")}
              </p>
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
                        {attached
                          ? t("evidence.attachedLabel", "Attached")
                          : t("evidence.attachLabel", "Attach")}
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
            <DialogTitle>{t("evidence.createTitle", "Create evidence")}</DialogTitle>
            <DialogDescription>
              {t(
                "evidence.createHint",
                "Create a structural evidence record and attach it to this drug. No biomedical assertions are inferred."
              )}
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-4">
            <div className="space-y-2">
              <Label htmlFor="evidence-title">{t("evidence.fieldTitle", "Title")}</Label>
              <Input
                id="evidence-title"
                value={createForm.title}
                onChange={(event) =>
                  setCreateForm((current) => ({ ...current, title: event.target.value }))
                }
                placeholder={t("evidence.fieldTitlePlaceholder", "Citation or source title")}
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="evidence-type">{t("evidence.fieldType", "Evidence type")}</Label>
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
            <div className="grid gap-4 sm:grid-cols-2">
              <div className="space-y-2">
                <Label htmlFor="evidence-quality">
                  {t("evidence.fieldQuality", "Quality score (0–1)")}
                </Label>
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
                <Label htmlFor="evidence-year">{t("evidence.fieldYear", "Year (optional)")}</Label>
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
            <div className="space-y-2">
              <Label htmlFor="evidence-authors">
                {t("evidence.fieldAuthors", "Authors (comma-separated)")}
              </Label>
              <Input
                id="evidence-authors"
                value={(createForm.authors ?? []).join(", ")}
                onChange={(event) =>
                  setCreateForm((current) => ({
                    ...current,
                    authors: event.target.value
                      .split(",")
                      .map((author) => author.trim())
                      .filter(Boolean),
                  }))
                }
                placeholder="Yusuf S, Sleight P"
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="evidence-journal">
                {t("evidence.fieldJournal", "Journal / source")}
              </Label>
              <Input
                id="evidence-journal"
                value={createForm.journal ?? ""}
                onChange={(event) =>
                  setCreateForm((current) => ({ ...current, journal: event.target.value }))
                }
                placeholder={t("evidence.fieldJournalPlaceholder", "Journal or regulator")}
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="evidence-supports-claim">
                {t("evidence.fieldSupportsClaim", "Supports claim")}
              </Label>
              <Input
                id="evidence-supports-claim"
                value={createForm.supports_claim ?? ""}
                onChange={(event) =>
                  setCreateForm((current) => ({
                    ...current,
                    supports_claim: event.target.value,
                  }))
                }
                placeholder={t(
                  "evidence.fieldSupportsClaimPlaceholder",
                  "What clinical assertion does this support?"
                )}
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="evidence-extract">{t("evidence.fieldExtract", "Extract")}</Label>
              <Input
                id="evidence-extract"
                value={createForm.extract ?? ""}
                onChange={(event) =>
                  setCreateForm((current) => ({ ...current, extract: event.target.value }))
                }
                placeholder={t(
                  "evidence.fieldExtractPlaceholder",
                  "Relevant quote or summary from the source"
                )}
              />
            </div>
            {treatsOptions.length > 0 && (
              <div className="space-y-2">
                <Label htmlFor="evidence-link-indication">
                  {t("evidence.fieldLinkIndication", "Link to indication (optional)")}
                </Label>
                <select
                  id="evidence-link-indication"
                  className="flex h-9 w-full rounded-md border border-input bg-transparent px-3 py-1 text-sm shadow-sm"
                  value={linkDiseaseId}
                  onChange={(event) => setLinkDiseaseId(event.target.value)}
                >
                  <option value="">
                    {t(
                      "evidence.fieldLinkIndicationNone",
                      "Don't link — select later from the indication card"
                    )}
                  </option>
                  {treatsOptions.map((option) => (
                    <option key={option.id} value={option.id}>
                      {option.label}
                    </option>
                  ))}
                </select>
              </div>
            )}
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setCreateOpen(false)}>
              {t("evidence.cancel", "Cancel")}
            </Button>
            <Button
              disabled={!createForm.title.trim() || evidence.isMutating}
              onClick={() => void handleCreate()}
            >
              {evidence.isMutating ? (
                <Loader2 className="h-4 w-4 animate-spin" />
              ) : (
                t("evidence.createAndAttach", "Create and attach")
              )}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
