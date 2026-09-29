import { Badge, type BadgeProps } from "@/components/ui/badge";
import { cn } from "@/lib/utils";

export function ValidationBadge({ status }: { status: "valid" | "invalid" | "pending" }) {
  const map: Record<typeof status, { label: string; variant: BadgeProps["variant"] }> = {
    valid: { label: "Valid", variant: "success" },
    invalid: { label: "Invalid", variant: "danger" },
    pending: { label: "Pending", variant: "warning" },
  };
  const { label, variant } = map[status];
  return <Badge variant={variant}>{label}</Badge>;
}

export function ConfidenceBadge({ level }: { level: "high" | "medium" | "low" }) {
  const variant = level === "high" ? "success" : level === "medium" ? "warning" : "muted";
  return <Badge variant={variant}>{level}</Badge>;
}

export function RelationshipBadge({ type }: { type: string }) {
  return (
    <Badge variant="outline" className={cn("font-mono text-[10px] uppercase tracking-wide")}>
      {type}
    </Badge>
  );
}

export function EvidenceBadge() {
  return <Badge variant="secondary">Evidence</Badge>;
}

export function PhaseBadge({ phase }: { phase: string }) {
  return (
    <Badge variant="muted" className="text-[10px]">
      {phase}
    </Badge>
  );
}

/**
 * Marks a drug as curator-authored or as externally imported.
 *
 * PrimeKG drugs are ingested with curation_status="external": they are
 * discoverable in the catalog but carry no curator review and no evidence
 * linkage. Presenting them with the same affordances as reviewed content
 * would misrepresent the product, so they are labelled instead.
 */
export function DrugProvenanceBadge({
  curationStatus,
  source,
  className,
}: {
  curationStatus?: string | null;
  source?: string | null;
  className?: string;
}) {
  if (curationStatus !== "external" && source !== "primekg") return null;
  return (
    <Badge
      variant="warning"
      className={cn("text-[10px]", className)}
      title="PrimeKG'den içe aktarıldı. Küratör incelemesi yoktur, kanıt bağlı değildir ve klinik karar için kullanılmamalıdır. / Imported from PrimeKG: no curator review, no evidence linkage, not for clinical decisions."
    >
      Harici veri · PrimeKG
    </Badge>
  );
}
