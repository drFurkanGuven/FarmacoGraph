"use client";

import { AuthProvider } from "@/lib/auth/context";
import { LanguageProvider } from "@/lib/i18n/context";
import { PresentationProvider } from "@/components/knowledge/presentation";
import { QueryProvider } from "@/providers/query-provider";
import { ThemeProvider } from "@/providers/theme-provider";
import { NotificationProvider } from "@/providers/notification-provider";
import { ErrorBoundary } from "@/components/layout/error-boundary";
import { UIModeProvider } from "@/lib/ui-mode/context";

export function Providers({ children }: { children: React.ReactNode }) {
  return (
    <ThemeProvider>
      <UIModeProvider>
        <LanguageProvider>
          <PresentationProvider>
            <QueryProvider>
              <ErrorBoundary>
                <AuthProvider>
                  {children}
                  <NotificationProvider />
                </AuthProvider>
              </ErrorBoundary>
            </QueryProvider>
          </PresentationProvider>
        </LanguageProvider>
      </UIModeProvider>
    </ThemeProvider>
  );
}
