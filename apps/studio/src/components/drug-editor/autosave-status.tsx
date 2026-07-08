"use client";

import { AlertCircle, Check, Cloud, Loader2 } from "lucide-react";
import { cn } from "@/lib/utils";
import { Button } from "@/components/ui/button";
import { describeSaveStrategy } from "./autosave";
import type { SaveStatus } from "./types";

const STATUS_COPY: Record<SaveStatus, string> = {
  idle: "All changes saved",
  pending: "Unsaved changes",
  saving: "Saving…",
  saved: "Saved",
  error: "Save failed",
};

export interface AutosaveStatusProps {
  status: SaveStatus;
  error?: string | null;
  lastSavedAt?: string | null;
  strategy?: string | null;
  onRetry?: () => void;
  className?: string;
}

function formatSavedAt(value: string): string {
  return new Intl.DateTimeFormat(undefined, {
    hour: "numeric",
    minute: "2-digit",
    second: "2-digit",
  }).format(new Date(value));
}

export function AutosaveStatus({
  status,
  error,
  lastSavedAt,
  strategy,
  onRetry,
  className,
}: AutosaveStatusProps) {
  const icon =
    status === "saving" ? (
      <Loader2 className="h-3.5 w-3.5 animate-spin" />
    ) : status === "error" ? (
      <AlertCircle className="h-3.5 w-3.5 text-destructive" />
    ) : status === "pending" ? (
      <Cloud className="h-3.5 w-3.5 text-amber-500" />
    ) : (
      <Check className="h-3.5 w-3.5 text-emerald-500" />
    );

  return (
    <div className={cn("flex items-center gap-2 text-xs text-muted-foreground", className)}>
      {icon}
      <span>{STATUS_COPY[status]}</span>
      {status === "saved" && lastSavedAt && (
        <span className="hidden sm:inline">· {formatSavedAt(lastSavedAt)}</span>
      )}
      {strategy && status === "saved" && (
        <span className="hidden md:inline">· {describeSaveStrategy(strategy as "drug_patch" | "curator_draft")}</span>
      )}
      {status === "error" && onRetry && (
        <Button variant="ghost" size="sm" className="h-6 px-2 text-xs" onClick={onRetry}>
          Retry
        </Button>
      )}
      {status === "error" && error && <span className="sr-only">{error}</span>}
    </div>
  );
}
