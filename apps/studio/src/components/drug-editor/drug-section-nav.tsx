"use client";

import { cn } from "@/lib/utils";
import { Button } from "@/components/ui/button";
import { ScrollArea } from "@/components/ui/scroll-area";
import { DRUG_EDITOR_SECTIONS } from "./sections";

export interface DrugSectionNavProps {
  activeSectionId: string;
  dirtySections: string[];
  onSelect: (sectionId: string) => void;
  className?: string;
  orientation?: "vertical" | "horizontal";
}

export function DrugSectionNav({
  activeSectionId,
  dirtySections,
  onSelect,
  className,
  orientation = "vertical",
}: DrugSectionNavProps) {
  const isHorizontal = orientation === "horizontal";

  return (
    <ScrollArea className={cn(isHorizontal ? "w-full" : "h-full", className)}>
      <nav
        className={cn(
          "gap-1",
          isHorizontal ? "flex w-max min-w-full px-1 pb-1" : "flex flex-col p-2",
        )}
        aria-label="Drug editor sections"
      >
        {DRUG_EDITOR_SECTIONS.map((section) => {
          const isActive = section.id === activeSectionId;
          const isDirty = dirtySections.includes(section.id);

          return (
            <Button
              key={section.id}
              type="button"
              variant={isActive ? "secondary" : "ghost"}
              size="sm"
              className={cn(
                "justify-start",
                isHorizontal ? "shrink-0" : "w-full",
                isActive && "font-medium",
              )}
              onClick={() => onSelect(section.id)}
            >
              <span>{section.title}</span>
              {isDirty && <span className="ml-auto text-[10px] uppercase tracking-wide text-amber-500">Edited</span>}
            </Button>
          );
        })}
      </nav>
    </ScrollArea>
  );
}
