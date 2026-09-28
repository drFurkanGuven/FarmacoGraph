"use client";

import { AlertCircle, Check, Cloud, Loader2 } from "lucide-react";
import { cn } from "@/lib/utils";
import { Button } from "@/components/ui/button";
import { useLanguage } from "@/lib/i18n/context";
import { describeSaveStrategy } from "./autosave";
import type { SaveStatus } from "./types";

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
  const { t, locale } = useLanguage();
  const statusCopy: Record<SaveStatus, string> = {
    idle: locale === "tr" ? "Tüm değişiklikler kaydedildi" : "All changes saved",
    pending: locale === "tr" ? "Kaydedilmemiş değişiklik" : "Unsaved changes",
    saving: locale === "tr" ? "Kaydediliyor…" : "Saving…",
    saved: locale === "tr" ? "Kaydedildi" : "Saved",
    error: locale === "tr" ? "Kayıt başarısız" : "Save failed",
  };
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
      <span>{statusCopy[status]}</span>
      {status === "saved" && lastSavedAt && (
        <span className="hidden sm:inline">· {formatSavedAt(lastSavedAt)}</span>
      )}
      {strategy && status === "saved" && (
        <span className="hidden md:inline">
          · {describeSaveStrategy(strategy as "curator_package")}
        </span>
      )}
      {status === "error" && onRetry && (
        <Button variant="ghost" size="sm" className="h-6 px-2 text-xs" onClick={onRetry}>
          {t("common.retry", "Retry")}
        </Button>
      )}
      {status === "error" && error && (
        <span className="max-w-[14rem] truncate text-destructive" title={error}>
          {error}
        </span>
      )}
    </div>
  );
}
