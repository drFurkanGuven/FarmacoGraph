"use client";

import { AuthProvider } from "@/lib/auth/context";
import { QueryProvider } from "@/providers/query-provider";
import { ThemeProvider } from "@/providers/theme-provider";
import { NotificationProvider } from "@/providers/notification-provider";
import { ErrorBoundary } from "@/components/layout/error-boundary";

export function Providers({ children }: { children: React.ReactNode }) {
  return (
    <ThemeProvider>
      <QueryProvider>
        <ErrorBoundary>
          <AuthProvider>
            {children}
            <NotificationProvider />
          </AuthProvider>
        </ErrorBoundary>
      </QueryProvider>
    </ThemeProvider>
  );
}
