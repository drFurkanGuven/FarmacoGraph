"use client";

import Link from "next/link";
import { LogIn, RefreshCw } from "lucide-react";
import { ApiError } from "@/lib/api";
import { useLanguage } from "@/lib/i18n/context";
import { cn } from "@/lib/utils";

export interface ApiErrorPanelProps {
  error: unknown;
  onRetry?: () => void;
  className?: string;
}

/**
 * Honest API failure surface for reader pages.
 *
 * - 401/403: explicit login call-to-action, never a silent fallback.
 * - Anything else: unreachable notice + "no sample data shown" guarantee.
 */
export function ApiErrorPanel({ error, onRetry, className }: ApiErrorPanelProps) {
  const { t } = useLanguage();
  const status = error instanceof ApiError ? error.status : null;
  const message =
    typeof error === "string" && error
      ? error
      : error instanceof ApiError && error.message
        ? error.message
        : error instanceof Error
          ? error.message
          : t("error.unknown", "Request failed.");
  const needsLogin = status === 401 || status === 403;

  return (
    <div
      className={cn(
        "rounded-xl border border-destructive/40 bg-destructive/5 p-6 text-sm space-y-3",
        className
      )}
    >
      <p className="font-semibold text-destructive">
        {needsLogin
          ? t("error.loginRequired", "Sign-in required")
          : t("error.unreachable", "Knowledge API unreachable")}
      </p>
      <p className="text-muted-foreground">{message}</p>
      {needsLogin ? (
        <p className="text-xs text-muted-foreground">
          {t(
            "error.loginHint",
            "This view needs an authenticated session. Public preview is disabled by the server."
          )}
        </p>
      ) : (
        <p className="text-xs text-muted-foreground">
          {t(
            "error.noSample",
            "No sample data is shown instead — check that the API is running and reachable, then retry."
          )}
        </p>
      )}
      <div className="flex flex-wrap gap-2">
        {needsLogin && (
          <Link
            href="/login"
            className="px-3 py-1.5 rounded-lg bg-primary text-primary-foreground text-xs font-semibold inline-flex items-center gap-1.5"
          >
            <LogIn className="w-3.5 h-3.5" />
            {t("error.signIn", "Sign in")}
          </Link>
        )}
        {onRetry && (
          <button
            onClick={onRetry}
            className="px-3 py-1.5 rounded-lg border bg-background text-xs font-semibold inline-flex items-center gap-1.5"
          >
            <RefreshCw className="w-3.5 h-3.5" />
            {t("common.retry", "Retry")}
          </button>
        )}
      </div>
    </div>
  );
}
