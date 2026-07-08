import * as React from "react";
import { Inbox } from "lucide-react";
import { cn } from "@/lib/utils";
import { Button } from "@/components/ui/button";

export interface EmptyStateProps extends React.HTMLAttributes<HTMLDivElement> {
  /** Primary heading */
  title: string;
  /** Supporting description */
  description?: string;
  /** Optional icon — defaults to Inbox */
  icon?: React.ReactNode;
  /** Optional action button label */
  actionLabel?: string;
  /** Called when action button is clicked */
  onAction?: () => void;
}

/**
 * Generic empty state for lists, tables, and panels with no data.
 */
function EmptyState({
  title,
  description,
  icon,
  actionLabel,
  onAction,
  className,
  children,
  ...props
}: EmptyStateProps) {
  return (
    <div
      className={cn("flex flex-col items-center justify-center rounded-lg border border-dashed px-6 py-12 text-center", className)}
      {...props}
    >
      <div className="mb-4 flex h-12 w-12 items-center justify-center rounded-full bg-muted text-muted-foreground">
        {icon ?? <Inbox className="h-6 w-6" />}
      </div>
      <h3 className="text-sm font-medium">{title}</h3>
      {description && <p className="mt-1 max-w-sm text-sm text-muted-foreground">{description}</p>}
      {children}
      {actionLabel && onAction && (
        <Button variant="outline" size="sm" className="mt-4" onClick={onAction}>
          {actionLabel}
        </Button>
      )}
    </div>
  );
}

export { EmptyState };
