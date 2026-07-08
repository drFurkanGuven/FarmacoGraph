"use client";

import { usePathname } from "next/navigation";
import { useState } from "react";
import { Sidebar } from "@/components/layout/sidebar";
import { TopNav } from "@/components/layout/top-nav";
import { CommandPalette } from "@/components/layout/command-palette";
import { AuthGate } from "@/lib/auth/guards";
import { isLoginPath } from "@/lib/auth/routes";

export function AppShell({ children }: { children: React.ReactNode }) {
  const pathname = usePathname();
  const [collapsed, setCollapsed] = useState(false);
  const [commandOpen, setCommandOpen] = useState(false);

  // Use isLoginPath so trailingSlash `/login/` still skips the chrome shell.
  if (isLoginPath(pathname ?? "")) {
    return <>{children}</>;
  }

  return (
    <div className="flex min-h-screen bg-background">
      <Sidebar collapsed={collapsed} onToggle={() => setCollapsed((v) => !v)} />
      <div className="flex min-w-0 flex-1 flex-col">
        <TopNav onOpenCommand={() => setCommandOpen(true)} />
        <main className="flex-1 overflow-auto p-4 md:p-6">
          <AuthGate>{children}</AuthGate>
        </main>
      </div>
      <CommandPalette open={commandOpen} onOpenChange={setCommandOpen} />
    </div>
  );
}
