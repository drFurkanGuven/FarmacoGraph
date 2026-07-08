import { Badge, type BadgeProps } from "@/components/ui/badge";
import { cn } from "@/lib/utils";

export type StatusValue = "active" | "inactive" | "draft" | "archived" | "error" | "processing";

const STATUS_MAP: Record<StatusValue, { label: string; variant: NonNullable<BadgeProps["variant"]> }> = {
  active: { label: "Active", variant: "success" },
  inactive: { label: "Inactive", variant: "muted" },
  draft: { label: "Draft", variant: "warning" },
  archived: { label: "Archived", variant: "secondary" },
  error: { label: "Error", variant: "danger" },
  processing: { label: "Processing", variant: "outline" },
};

export interface StatusBadgeProps extends Omit<BadgeProps, "variant" | "children"> {
  status: StatusValue;
  /** Override default label */
  label?: string;
  /** Show pulsing dot for live/processing states */
  showDot?: boolean;
}

/**
 * Badge for entity or workflow status.
 */
function StatusBadge({ status, label, showDot, className, ...props }: StatusBadgeProps) {
  const config = STATUS_MAP[status];
  const pulse = showDot ?? status === "processing";

  return (
    <Badge variant={config.variant} className={cn("gap-1.5", className)} {...props}>
      {pulse && (
        <span className="relative flex h-2 w-2">
          <span className="absolute inline-flex h-full w-full animate-ping rounded-full bg-current opacity-40" />
          <span className="relative inline-flex h-2 w-2 rounded-full bg-current" />
        </span>
      )}
      {label ?? config.label}
    </Badge>
  );
}

export { StatusBadge };
