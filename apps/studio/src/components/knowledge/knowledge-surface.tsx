"use client";

import Link from "next/link";
import { useSearchParams } from "next/navigation";
import type { LucideIcon } from "lucide-react";
import { ArrowRight, BookOpen, FlaskConical, GitBranch, ShieldCheck } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";

interface SurfaceLink {
  label: string;
  href: string;
  icon: LucideIcon;
  description: string;
}

interface SurfaceSignal {
  label: string;
  value: string;
  tone?: "success" | "warning" | "muted";
}

interface KnowledgeSurfaceProps {
  eyebrow: string;
  title: string;
  description: string;
  status: string;
  primary: SurfaceLink;
  links: SurfaceLink[];
  signals: SurfaceSignal[];
  deferred: string[];
}

function withDrugContext(href: string, drug: string | null) {
  if (!drug) return href;
  if (href.includes(encodeURIComponent(drug))) return href;
  const separator = href.includes("?") ? "&" : "?";
  return `${href}${separator}drug=${encodeURIComponent(drug)}`;
}

export function KnowledgeSurface({
  eyebrow,
  title,
  description,
  status,
  primary,
  links,
  signals,
  deferred,
}: KnowledgeSurfaceProps) {
  const searchParams = useSearchParams();
  const focusedDrug = searchParams.get("drug");
  const PrimaryIcon = primary.icon;

  return (
    <div className="mx-auto max-w-6xl space-y-6 animate-fade-in">
      <div className="flex flex-col gap-3 md:flex-row md:items-end md:justify-between">
        <div className="space-y-2">
          <div className="flex flex-wrap items-center gap-2">
            <p className="text-xs font-medium uppercase tracking-wide text-muted-foreground">{eyebrow}</p>
            <Badge variant="muted">{status}</Badge>
            {focusedDrug && <Badge variant="outline">Drug: {focusedDrug}</Badge>}
          </div>
          <h2 className="text-2xl font-semibold tracking-tight">{title}</h2>
          <p className="max-w-2xl text-sm text-muted-foreground">{description}</p>
        </div>
        <Button asChild>
          <Link href={withDrugContext(primary.href, focusedDrug)}>
            <PrimaryIcon className="h-4 w-4" />
            {primary.label}
          </Link>
        </Button>
      </div>

      <div className="grid gap-3 md:grid-cols-3">
        {signals.map((signal) => (
          <Card key={signal.label} className="rounded-md">
            <CardHeader className="pb-2">
              <CardTitle className="text-sm">{signal.label}</CardTitle>
            </CardHeader>
            <CardContent>
              <Badge variant={signal.tone ?? "muted"}>{signal.value}</Badge>
            </CardContent>
          </Card>
        ))}
      </div>

      <div className="grid gap-4 lg:grid-cols-[minmax(0,1fr)_360px]">
        <Card className="rounded-md">
          <CardHeader>
            <CardTitle className="text-base">Connected workflow</CardTitle>
            <CardDescription>This surface is linked to the live curation path without inventing unsupported CRUD.</CardDescription>
          </CardHeader>
          <CardContent className="grid gap-3 md:grid-cols-2">
            {links.map((item) => {
              const ItemIcon = item.icon;
              return (
                <Button
                  key={`${item.href}:${item.label}`}
                  asChild
                  variant="outline"
                  className="h-auto justify-start whitespace-normal p-3 text-left"
                >
                  <Link href={withDrugContext(item.href, focusedDrug)}>
                    <ItemIcon className="mt-0.5 h-4 w-4" />
                    <span className="min-w-0">
                      <span className="block text-sm font-medium">{item.label}</span>
                      <span className="block text-xs font-normal leading-relaxed text-muted-foreground">
                        {item.description}
                      </span>
                    </span>
                    <ArrowRight className="ml-auto h-4 w-4" />
                  </Link>
                </Button>
              );
            })}
          </CardContent>
        </Card>

        <Card className="rounded-md">
          <CardHeader>
            <CardTitle className="text-base">Intentionally deferred</CardTitle>
            <CardDescription>These need backend contracts before editor UI.</CardDescription>
          </CardHeader>
          <CardContent>
            <ul className="space-y-2 text-sm text-muted-foreground">
              {deferred.map((item) => (
                <li key={item} className="flex gap-2 rounded-md border bg-muted/30 px-3 py-2">
                  <ShieldCheck className="mt-0.5 h-4 w-4 shrink-0" />
                  <span>{item}</span>
                </li>
              ))}
            </ul>
          </CardContent>
        </Card>
      </div>
    </div>
  );
}

export const commonKnowledgeLinks: SurfaceLink[] = [
  {
    label: "Open Drug Editor",
    href: "/knowledge/drugs",
    icon: FlaskConical,
    description: "Return to the canonical curation workspace.",
  },
  {
    label: "Review Evidence",
    href: "/knowledge/evidence",
    icon: ShieldCheck,
    description: "Browse evidence and attach records from the editor.",
  },
  {
    label: "Check Validation",
    href: "/validation",
    icon: BookOpen,
    description: "Inspect publish readiness and blocking issues.",
  },
  {
    label: "View Graph Context",
    href: "/graph",
    icon: GitBranch,
    description: "See the graph surface state for the focused drug.",
  },
];
