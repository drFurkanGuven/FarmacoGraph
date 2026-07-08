"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { ChevronDown, Moon, Sun, Laptop } from "lucide-react";
import { useTheme } from "next-themes";
import { Button } from "@/components/ui/button";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { useAuth } from "@/lib/auth/context";
import { cn } from "@/lib/utils";

interface TopNavProps {
  onOpenCommand: () => void;
}

export function TopNav({ onOpenCommand }: TopNavProps) {
  const { session, workspaces, activeWorkspace, setActiveWorkspace } = useAuth();
  const { setTheme, theme } = useTheme();
  const pathname = usePathname();

  const title =
    pathname === "/"
      ? "Dashboard"
      : pathname.split("/").filter(Boolean).slice(-1)[0]?.replace(/-/g, " ") ?? "Studio";

  return (
    <header className="sticky top-0 z-30 flex h-14 items-center gap-3 border-b bg-background/80 px-4 backdrop-blur md:px-6">
      <div className="min-w-0 flex-1">
        <p className="text-xs font-medium uppercase tracking-wider text-muted-foreground">Curation Studio</p>
        <h1 className="truncate text-lg font-semibold capitalize">{title}</h1>
      </div>

      <Button variant="outline" size="sm" className="hidden md:inline-flex" onClick={onOpenCommand}>
        <span className="text-muted-foreground">Search</span>
        <kbd className="ml-2 rounded border bg-muted px-1.5 py-0.5 text-[10px] font-medium">⌘K</kbd>
      </Button>

      <DropdownMenu>
        <DropdownMenuTrigger asChild>
          <Button variant="outline" size="sm" className="max-w-[180px] justify-between">
            <span className="truncate">{activeWorkspace.name}</span>
            <ChevronDown className="opacity-60" />
          </Button>
        </DropdownMenuTrigger>
        <DropdownMenuContent align="end">
          <DropdownMenuLabel>Workspace</DropdownMenuLabel>
          <DropdownMenuSeparator />
          {workspaces.map((ws) => (
            <DropdownMenuItem key={ws.id} onClick={() => setActiveWorkspace(ws)}>
              {ws.name}
            </DropdownMenuItem>
          ))}
        </DropdownMenuContent>
      </DropdownMenu>

      <DropdownMenu>
        <DropdownMenuTrigger asChild>
          <Button variant="ghost" size="icon" aria-label="Toggle theme">
            <Sun className="h-4 w-4 rotate-0 scale-100 transition-all dark:-rotate-90 dark:scale-0" />
            <Moon className="absolute h-4 w-4 rotate-90 scale-0 transition-all dark:rotate-0 dark:scale-100" />
          </Button>
        </DropdownMenuTrigger>
        <DropdownMenuContent align="end">
          <DropdownMenuItem onClick={() => setTheme("light")}>
            <Sun className="mr-2 h-4 w-4" /> Light
          </DropdownMenuItem>
          <DropdownMenuItem onClick={() => setTheme("dark")}>
            <Moon className="mr-2 h-4 w-4" /> Dark
          </DropdownMenuItem>
          <DropdownMenuItem onClick={() => setTheme("system")}>
            <Laptop className="mr-2 h-4 w-4" /> System
          </DropdownMenuItem>
          <DropdownMenuSeparator />
          <DropdownMenuLabel className="text-xs text-muted-foreground">Current: {theme}</DropdownMenuLabel>
        </DropdownMenuContent>
      </DropdownMenu>

      <Link
        href="/settings"
        className={cn(
          "flex h-9 w-9 items-center justify-center rounded-full bg-primary/10 text-sm font-semibold text-primary",
          "ring-2 ring-transparent transition hover:ring-primary/30",
        )}
        aria-label="Profile and settings"
      >
        {session.displayName.charAt(0).toUpperCase()}
      </Link>
    </header>
  );
}
