import { Badge, type BadgeProps } from "@/components/ui/badge";
import { cn } from "@/lib/utils";

export type EvidenceType = "primary" | "secondary" | "tertiary" | "unsupported";

const TYPE_MAP: Record<EvidenceType, { label: string; variant: NonNullable<BadgeProps["variant"]> }> = {
  primary: { label: "Primary", variant: "success" },
  secondary: { label: "Secondary", variant: "default" },
  tertiary: { label: "Tertiary", variant: "secondary" },
  unsupported: { label: "Unsupported", variant: "muted" },
};

export interface EvidenceBadgeProps extends Omit<BadgeProps, "variant" | "children"> {
  type?: EvidenceType;
  /** Custom label — overrides type default */
  label?: string;
}

/**
 * Badge for evidence strength or source classification.
 */
function EvidenceBadge({ type = "secondary", label, className, ...props }: EvidenceBadgeProps) {
  const config = TYPE_MAP[type];
  return (
    <Badge variant={config.variant} className={cn(className)} {...props}>
      {label ?? config.label}
    </Badge>
  );
}

export { EvidenceBadge };
