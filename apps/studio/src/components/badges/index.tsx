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
