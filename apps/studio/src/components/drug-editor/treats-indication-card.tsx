"use client";

import { useState } from "react";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";
import { useLanguage } from "@/lib/i18n/context";
import { TREATS_EVIDENCE_LEVELS, type TreatsIndicationProperties } from "./treats-relationships";
import { TreatsIndicationEvidence } from "./treats-indication-evidence";
import type { DrugEvidenceAttachment } from "./evidence-types";
import { evaluateTreatsIndicationReadiness } from "./treats-indication-status";

export interface TreatsIndicationCardProps {
  label: string;
  slug?: string;
  properties: TreatsIndicationProperties;
  curatorAttestation: boolean;
  attachments: DrugEvidenceAttachment[];
  evidenceLoading?: boolean;
  disabled?: boolean;
  onChange: (patch: Partial<TreatsIndicationProperties>) => void;
  /** Inline quick-create: returns after the record is attached + linked. */
  onQuickCreate?: (title: string) => Promise<void>;
  quickCreatePending?: boolean;
}

function readinessBadgeVariant(
  status: ReturnType<typeof evaluateTreatsIndicationReadiness>["status"]
): "success" | "warning" | "danger" {
  switch (status) {
    case "ready":
      return "success";
    case "partial":
      return "warning";
    case "missing":
      return "danger";
  }
}

export function TreatsIndicationCard({
  label,
  slug,
  properties,
  curatorAttestation,
  attachments,
  evidenceLoading = false,
  disabled = false,
  onChange,
  onQuickCreate,
  quickCreatePending = false,
}: TreatsIndicationCardProps) {
  const { t } = useLanguage();
  const readiness = evaluateTreatsIndicationReadiness(properties, curatorAttestation);
  const readinessText =
    readiness.status === "ready"
      ? t("treats.statusReady", "Ready")
      : readiness.status === "partial"
        ? t("treats.statusPartial", "Partial")
        : t("treats.statusMissing", "Missing");
  const needsAttestation =
    properties.evidence_level === "expert_consensus" &&
    readiness.missing.includes("curator_attestation");

  return (
    <div className="space-y-4 rounded-lg border bg-card/40 p-4">
      <div className="flex flex-wrap items-start justify-between gap-2">
        <div>
          <p className="text-sm font-medium">{label}</p>
          {slug ? <p className="text-xs text-muted-foreground">{slug}</p> : null}
          <p className="mt-1 text-xs text-muted-foreground">
            {t(
              "treats.clinicalExplanationHint",
              "Publish requires a clinical rationale, confidence metadata, and evidence level on each TREATS edge. Use expert consensus when you attest the link in Provenance without a separate citation."
            )}
          </p>
        </div>
        <Badge variant={readinessBadgeVariant(readiness.status)}>{readinessText}</Badge>
      </div>

      {needsAttestation ? (
        <p className="rounded-md border border-amber-500/30 bg-amber-500/10 px-3 py-2 text-xs text-amber-900 dark:text-amber-100">
          {t(
            "treats.attestationWarning",
            "Expert consensus requires curator attestation in the Provenance section, or attach supporting evidence below."
          )}
        </p>
      ) : null}

      <div className="space-y-2">
        <Label htmlFor={`treats-explanation-${slug ?? label}`}>
          {t("treats.clinicalExplanation", "Clinical explanation")}
        </Label>
        <Textarea
          id={`treats-explanation-${slug ?? label}`}
          rows={3}
          disabled={disabled}
          placeholder={t(
            "treats.clinicalExplanationPlaceholder",
            "Why does this drug treat this condition?"
          )}
          value={properties.explanation}
          onChange={(event) => onChange({ explanation: event.target.value })}
        />
      </div>

      <div className="grid gap-4 sm:grid-cols-2">
        <div className="space-y-2">
          <Label htmlFor={`treats-confidence-${slug ?? label}`}>
            {t("treats.confidence", "Confidence score (0–1)")}
          </Label>
          <Input
            id={`treats-confidence-${slug ?? label}`}
            type="number"
            min={0}
            max={1}
            step={0.05}
            disabled={disabled}
            value={properties.confidence_score}
            onChange={(event) => {
              const parsed = Number.parseFloat(event.target.value);
              onChange({
                confidence_score: Number.isFinite(parsed) ? Math.min(1, Math.max(0, parsed)) : 0,
              });
            }}
          />
        </div>

        <div className="space-y-2">
          <Label htmlFor={`treats-evidence-level-${slug ?? label}`}>
            {t("treats.evidenceLevel", "Evidence level")}
          </Label>
          <select
            id={`treats-evidence-level-${slug ?? label}`}
            disabled={disabled}
            value={properties.evidence_level}
            onChange={(event) => onChange({ evidence_level: event.target.value })}
            className={cn(
              "flex h-10 w-full rounded-md border border-input bg-background px-3 py-2 text-sm",
              "ring-offset-background focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring",
              disabled && "cursor-not-allowed opacity-50"
            )}
          >
            {TREATS_EVIDENCE_LEVELS.map((option) => (
              <option key={option.value} value={option.value}>
                {option.label}
              </option>
            ))}
          </select>
        </div>
      </div>

      <TreatsIndicationEvidence
        selectedIds={properties.evidence_ids ?? []}
        attachments={attachments}
        loading={evidenceLoading}
        disabled={disabled}
        onChange={(evidenceIds) => onChange({ evidence_ids: evidenceIds })}
      />
      {onQuickCreate && (
        <QuickCreateEvidence
          disabled={disabled || quickCreatePending}
          pending={quickCreatePending}
          onCreate={onQuickCreate}
        />
      )}
    </div>
  );
}

function QuickCreateEvidence({
  disabled,
  pending,
  onCreate,
}: {
  disabled: boolean;
  pending: boolean;
  onCreate: (title: string) => Promise<void>;
}) {
  const { t } = useLanguage();
  const [title, setTitle] = useState("");
  const [error, setError] = useState<string | null>(null);

  async function handleCreate() {
    if (!title.trim() || pending) return;
    setError(null);
    try {
      await onCreate(title.trim());
      setTitle("");
    } catch (err) {
      setError(err instanceof Error ? err.message : "Evidence quick-create failed.");
    }
  }

  return (
    <div className="space-y-2 rounded-md border border-dashed px-3 py-3">
      <p className="text-xs font-medium">
        {t("treats.quickCreateTitle", "Quick create and link evidence")}
      </p>
      <p className="text-xs text-muted-foreground">
        {t(
          "treats.quickCreateHint",
          "Title and type are enough — the record is created, attached to the drug, and linked to this indication."
        )}
      </p>
      <div className="flex gap-2">
        <Input
          value={title}
          disabled={disabled}
          onChange={(event) => setTitle(event.target.value)}
          placeholder={t("treats.quickCreatePlaceholder", "Citation or source title")}
          onKeyDown={(event) => {
            if (event.key === "Enter") {
              event.preventDefault();
              void handleCreate();
            }
          }}
        />
        <Button
          type="button"
          size="sm"
          variant="secondary"
          disabled={disabled || !title.trim()}
          onClick={() => void handleCreate()}
        >
          {pending ? "..." : t("treats.quickCreateButton", "Create and link")}
        </Button>
      </div>
      {error && <p className="text-xs text-destructive">{error}</p>}
    </div>
  );
}
