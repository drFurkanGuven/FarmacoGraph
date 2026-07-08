import { Badge, type BadgeProps } from "@/components/ui/badge";

export type ValidationStatus = "valid" | "invalid" | "pending";

const STATUS_MAP: Record<ValidationStatus, { label: string; variant: NonNullable<BadgeProps["variant"]> }> = {
  valid: { label: "Valid", variant: "success" },
  invalid: { label: "Invalid", variant: "danger" },
  pending: { label: "Pending", variant: "warning" },
};

export interface ValidationBadgeProps extends Omit<BadgeProps, "variant" | "children"> {
  status: ValidationStatus;
  /** Override default label */
  label?: string;
}

/**
 * Badge for validation outcomes (valid, invalid, pending).
 */
function ValidationBadge({ status, label, ...props }: ValidationBadgeProps) {
  const config = STATUS_MAP[status];
  return (
    <Badge variant={config.variant} {...props}>
      {label ?? config.label}
    </Badge>
  );
}

export { ValidationBadge };
