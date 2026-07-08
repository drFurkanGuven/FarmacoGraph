"use client";

import { Badge } from "@/components/ui/badge";
import type { OntologyEvidenceType } from "@/lib/api/evidence";
import { formatEvidenceTypeLabel } from "./utils";

const TYPE_VARIANTS: Record<string, "default" | "secondary" | "success" | "warning" | "muted"> = {
  rct: "success",
  meta_analysis: "success",
  systematic_review: "success",
  pubmed_article: "default",
  clinical_guideline: "default",
  fda_label: "warning",
  ema_smpc: "warning",
  who_guideline: "secondary",
  nice_guideline: "secondary",
  review_article: "secondary",
  expert_consensus: "muted",
  textbook: "muted",
};

interface EvidenceTypeBadgeProps {
  type?: OntologyEvidenceType | string | null;
  className?: string;
}

export function EvidenceTypeBadge({ type, className }: EvidenceTypeBadgeProps) {
  const key = type ?? "unknown";
  const variant = TYPE_VARIANTS[key] ?? "secondary";
  return (
    <Badge variant={variant} className={className}>
      {formatEvidenceTypeLabel(type ?? null)}
    </Badge>
  );
}
