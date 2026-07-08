import * as React from "react";
import { AlertCircle, RefreshCw } from "lucide-react";
import { cn } from "@/lib/utils";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";

export interface ErrorStateProps extends React.HTMLAttributes<HTMLDivElement> {
  /** Error title */
  title?: string;
  /** Error message or description */
  message: string;
  /** Retry button label */
  retryLabel?: string;
  /** Called when retry is clicked */
  onRetry?: () => void;
  /** Render as inline card (default) or bare */
  variant?: "card" | "inline";
}

/**
 * Generic error state for failed data loads and API errors.
 */
function ErrorState({
  title = "Something went wrong",
  message,
  retryLabel = "Try again",
  onRetry,
  variant = "card",
  className,
  ...props
}: ErrorStateProps) {
  const content = (
    <>
      <div className="flex items-center gap-2">
        <AlertCircle className="h-4 w-4 shrink-0 text-destructive" />
        <p className="text-sm font-medium">{title}</p>
      </div>
      <p className="text-sm text-muted-foreground">{message}</p>
      {onRetry && (
        <Button variant="outline" size="sm" className="mt-2" onClick={onRetry}>
          <RefreshCw className="h-3.5 w-3.5" />
          {retryLabel}
        </Button>
      )}
    </>
  );

  if (variant === "inline") {
    return (
      <div
        className={cn("rounded-md border border-destructive/40 bg-destructive/5 p-4 space-y-2", className)}
        role="alert"
        {...props}
      >
        {content}
      </div>
    );
  }

  return (
    <Card className={cn("border-destructive/40 bg-destructive/5", className)} role="alert" {...props}>
      <CardHeader className="pb-2">
        <CardTitle className="flex items-center gap-2 text-sm">
          <AlertCircle className="h-4 w-4 text-destructive" />
          {title}
        </CardTitle>
      </CardHeader>
      <CardContent className="space-y-2 text-sm text-muted-foreground">
        <p>{message}</p>
        {onRetry && (
          <Button variant="outline" size="sm" onClick={onRetry}>
            <RefreshCw className="h-3.5 w-3.5" />
            {retryLabel}
          </Button>
        )}
      </CardContent>
    </Card>
  );
}

export { ErrorState };
