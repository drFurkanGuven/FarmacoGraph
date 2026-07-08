import { Badge, type BadgeProps } from "@/components/ui/badge";
import { cn } from "@/lib/utils";

export type ConfidenceLevel = "high" | "medium" | "low";

const LEVEL_MAP: Record<ConfidenceLevel, NonNullable<BadgeProps["variant"]>> = {
  high: "success",
  medium: "warning",
  low: "muted",
};

const LEVEL_LABELS: Record<ConfidenceLevel, string> = {
  high: "High",
  medium: "Medium",
  low: "Low",
};

export interface ConfidenceBadgeProps extends Omit<BadgeProps, "variant" | "children"> {
  level: ConfidenceLevel;
  /** Show numeric score alongside level */
  score?: number;
}

/**
 * Badge for confidence or certainty levels.
 */
function ConfidenceBadge({ level, score, className, ...props }: ConfidenceBadgeProps) {
  return (
    <Badge variant={LEVEL_MAP[level]} className={cn("capitalize", className)} {...props}>
      {LEVEL_LABELS[level]}
      {score !== undefined && <span className="ml-1 tabular-nums opacity-80">({score}%)</span>}
    </Badge>
  );
}

export { ConfidenceBadge };
